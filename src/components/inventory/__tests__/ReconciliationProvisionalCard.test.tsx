/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Tests: ReconciliationProvisionalCard (FEAT-17 Anexo A — bandeja de
 * reconciliación)
 *
 * Comportamiento verificado:
 * 1. Sin sugerencias (`item.suggestions` vacío/ausente): muestra el botón
 *    "Confirmar como nuevo" (sin el bloque "¿Es la misma?") y lo clickea
 *    llama a `onConfirmNew`.
 * 2. Con 1 sugerencia: muestra el bloque "¿Es la misma?" con el nombre de la
 *    sugerencia y el badge de coincidencia correspondiente ("SKU igual" /
 *    "Nombre y atributos" / "Nombre parecido" según `match`). "Sí, es la
 *    misma → unificar" llama a `onLinkToVariant` con la sugerencia. "No, es
 *    nueva → crear" llama a `onConfirmNew`.
 * 3. Con 2-3 sugerencias: se muestran las "pills" de selección; cambiar de
 *    pill cambia la sugerencia mostrada (badge) y la que efectivamente se
 *    pasa a `onLinkToVariant` al confirmar.
 * 4. El chip de atributos de la línea externa (`item.attribute_values`) se
 *    muestra como "Azul · M".
 * 5. Buscador ("Buscar otra variante", vía `useReconciliationVariantSearch`
 *    real + `searchReconciliationVariants` mockeado, con fake timers para
 *    el debounce de 300ms):
 *    - Con menos de 2 caracteres no dispara la búsqueda (mensaje "Escribí
 *      al menos 2 caracteres para buscar").
 *    - Con resultados, seleccionar uno llama a `onLinkToVariant` con la
 *      variante elegida.
 *    - Sin resultados, muestra "No se encontraron variantes".
 *    - Si la búsqueda falla, muestra `toast.error`.
 *
 * Mocks aplicados:
 * - @/services/reconciliationTask.service → `searchReconciliationVariants` +
 *   `getReconciliationTaskErrorMessage` (devuelve el `fallback` recibido).
 *   `resolveReconciliationLink` y demás mutaciones NO se mockean acá: la
 *   tarjeta nunca las llama directo, sólo delega a los callbacks
 *   (`onConfirmNew`, `onReject`, `onLinkToVariant`) que recibe por props.
 * - sonner → toast.success/error.
 * - @/components/ui/combobox → stub simple (input + botones por opción) en
 *   vez del Popover/ScrollArea real de Radix: sólo se necesita disparar
 *   `onSearchChange` al tipear y `onValueChange` al "seleccionar" una
 *   opción, sin la complejidad de abrir un Popover en jsdom.
 * - El componente usa el hook real `useReconciliationVariantSearch`
 *   (react-query), así que los tests se envuelven en `QueryClientProvider`
 *   (retry: false), mismo patrón que `useUpsellRecords.test.ts`.
 */

import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

// ── Mocks de infraestructura ─────────────────────────────────────────────────

jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('@/services/reconciliationTask.service', () => ({
  searchReconciliationVariants: jest.fn(),
  getReconciliationTaskErrorMessage: jest.fn(
    (_error: unknown, fallback: string) => fallback,
  ),
}));

/**
 * Stub de Combobox: un `<input>` con `aria-label` = `searchPlaceholder` que
 * dispara `onSearchChange` en cada cambio, y un botón por opción (texto =
 * `option.label`) que dispara `onValueChange(option.value)` al clickearlo —
 * equivalente funcional al Popover real para lo que necesita esta tarjeta.
 */
jest.mock('@/components/ui/combobox', () => {
  const React = require('react');

  interface StubOption {
    value: string;
    label: string;
  }

  const Combobox = ({
    options,
    onValueChange,
    onSearchChange,
    searchPlaceholder,
    emptyMessage,
    isLoading,
    disabled,
  }: {
    options?: StubOption[];
    onValueChange?: (value: string) => void;
    onSearchChange?: (query: string) => void;
    searchPlaceholder?: string;
    emptyMessage?: string;
    isLoading?: boolean;
    disabled?: boolean;
  }) => (
    <div>
      <input
        aria-label={searchPlaceholder}
        disabled={disabled}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
          onSearchChange?.(e.target.value)
        }
      />
      {isLoading && <span>Buscando…</span>}
      {(options ?? []).length === 0 ? (
        <span>{emptyMessage}</span>
      ) : (
        (options ?? []).map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onValueChange?.(option.value)}
          >
            {option.label}
          </button>
        ))
      )}
    </div>
  );

  return { Combobox };
});

// ── Imports bajo prueba (después de los mocks) ────────────────────────────────

import { toast } from 'sonner';
import {
  searchReconciliationVariants,
  type ReconciliationTask,
  type ReconciliationTaskItem,
  type ReconciliationTaskSuggestion,
  type VariantSearchResult,
} from '@/services/reconciliationTask.service';
import { ReconciliationProvisionalCard } from '../ReconciliationProvisionalCard';

// ── Casts ────────────────────────────────────────────────────────────────────

const mockSearchVariants = jest.mocked(searchReconciliationVariants);
const mockToast = toast as jest.Mocked<typeof toast>;

// ── Fixtures ─────────────────────────────────────────────────────────────────

function makeItem(overrides: Partial<ReconciliationTaskItem> = {}): ReconciliationTaskItem {
  return {
    variant_id: null,
    product_id: null,
    variant_name: 'Campera Azul Talle M',
    sku: null,
    company_sku: 'CAM-AZUL-M',
    external_id: 'ext-shopify-1',
    source: 'shopify',
    confidence: 0,
    attribute_values: { color: 'Azul', talla: 'M' },
    ...overrides,
  };
}

function makeTask(overrides: Partial<ReconciliationTask> = {}): ReconciliationTask {
  return {
    id: 'task-prov-1',
    companyId: 'company-1',
    type: 'provisional',
    status: 'pending',
    items: [makeItem()],
    confidenceLevel: null,
    dedupeKey: null,
    resolvedByUserId: null,
    resolvedAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeSuggestion(
  overrides: Partial<ReconciliationTaskSuggestion> = {},
): ReconciliationTaskSuggestion {
  return {
    variant_id: 'variant-sug-1',
    product_name: 'Campera Azul M (Powip)',
    sku: 'CAM-AZUL-M-EXIST',
    company_sku: null,
    attribute_values: { color: 'Azul', talla: 'M' },
    match: 'sku',
    score: 0.95,
    ...overrides,
  };
}

function buildWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  function QueryWrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  }
  QueryWrapper.displayName = 'QueryWrapper';
  return QueryWrapper;
}

interface RenderCardOverrides {
  task?: ReconciliationTask;
  isSelected?: boolean;
  isProcessing?: boolean;
  onToggleSelected?: jest.Mock;
  onConfirmNew?: jest.Mock;
  onReject?: jest.Mock;
  onLinkToVariant?: jest.Mock;
}

function renderCard(overrides: RenderCardOverrides = {}) {
  const props = {
    task: overrides.task ?? makeTask(),
    isSelected: overrides.isSelected ?? false,
    isProcessing: overrides.isProcessing ?? false,
    onToggleSelected: overrides.onToggleSelected ?? jest.fn(),
    onConfirmNew: overrides.onConfirmNew ?? jest.fn(),
    onReject: overrides.onReject ?? jest.fn(),
    onLinkToVariant: overrides.onLinkToVariant ?? jest.fn(),
  };
  const Wrapper = buildWrapper();
  render(
    <Wrapper>
      <ReconciliationProvisionalCard {...props} />
    </Wrapper>,
  );
  return props;
}

// ── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  mockSearchVariants.mockResolvedValue([]);
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe('ReconciliationProvisionalCard', () => {
  describe('sin sugerencias', () => {
    it('muestra "Confirmar como nuevo" (sin el bloque "¿Es la misma?") y lo clickea llama a onConfirmNew', async () => {
      const onConfirmNew = jest.fn();
      renderCard({ task: makeTask({ items: [makeItem()] }), onConfirmNew });

      expect(screen.queryByText('¿Es la misma?')).not.toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /confirmar como nuevo/i }),
      ).toBeInTheDocument();

      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: /confirmar como nuevo/i }));

      expect(onConfirmNew).toHaveBeenCalledTimes(1);
    });
  });

  describe('con 1 sugerencia', () => {
    it('muestra el bloque "¿Es la misma?" con el badge "SKU igual" cuando match es sku', () => {
      renderCard({
        task: makeTask({
          items: [makeItem({ suggestions: [makeSuggestion({ match: 'sku' })] })],
        }),
      });

      expect(screen.getByText('¿Es la misma?')).toBeInTheDocument();
      expect(screen.getByText('Campera Azul M (Powip)')).toBeInTheDocument();
      expect(screen.getByText('SKU igual')).toBeInTheDocument();
    });

    it('muestra el badge "Nombre y atributos" cuando match es name_attributes', () => {
      renderCard({
        task: makeTask({
          items: [
            makeItem({ suggestions: [makeSuggestion({ match: 'name_attributes' })] }),
          ],
        }),
      });

      expect(screen.getByText('Nombre y atributos')).toBeInTheDocument();
    });

    it('muestra el badge "Nombre parecido" cuando match es name', () => {
      renderCard({
        task: makeTask({
          items: [makeItem({ suggestions: [makeSuggestion({ match: 'name' })] })],
        }),
      });

      expect(screen.getByText('Nombre parecido')).toBeInTheDocument();
    });

    it('"Sí, es la misma → unificar" llama a onLinkToVariant con la sugerencia', async () => {
      const onLinkToVariant = jest.fn();
      const suggestion = makeSuggestion();
      renderCard({
        task: makeTask({ items: [makeItem({ suggestions: [suggestion] })] }),
        onLinkToVariant,
      });

      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: /sí, es la misma → unificar/i }));

      expect(onLinkToVariant).toHaveBeenCalledWith(suggestion);
    });

    it('"No, es nueva → crear" llama a onConfirmNew', async () => {
      const onConfirmNew = jest.fn();
      renderCard({
        task: makeTask({ items: [makeItem({ suggestions: [makeSuggestion()] })] }),
        onConfirmNew,
      });

      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: /no, es nueva → crear/i }));

      expect(onConfirmNew).toHaveBeenCalledTimes(1);
    });
  });

  describe('con 2-3 sugerencias', () => {
    it('cambiar la pill seleccionada cambia la sugerencia mostrada y la que se pasa a onLinkToVariant', async () => {
      const suggestion1 = makeSuggestion({
        variant_id: 'variant-sug-1',
        product_name: 'Campera Azul M (Powip)',
        sku: 'CAM-AZUL-M-EXIST',
        match: 'sku',
      });
      const suggestion2 = makeSuggestion({
        variant_id: 'variant-sug-2',
        product_name: 'Campera Celeste M',
        sku: 'CAM-CEL-M',
        match: 'name_attributes',
      });
      const suggestion3 = makeSuggestion({
        variant_id: 'variant-sug-3',
        product_name: 'Campera Azul Grande',
        sku: 'CAM-AZUL-G',
        match: 'name',
      });
      const onLinkToVariant = jest.fn();

      renderCard({
        task: makeTask({
          items: [makeItem({ suggestions: [suggestion1, suggestion2, suggestion3] })],
        }),
        onLinkToVariant,
      });

      // Por defecto se muestra la primera sugerencia (orden del backend).
      expect(screen.getByText('SKU igual')).toBeInTheDocument();

      const user = userEvent.setup();
      await user.click(
        screen.getByRole('button', { name: /campera celeste m · cam-cel-m/i }),
      );

      expect(screen.getByText('Nombre y atributos')).toBeInTheDocument();
      expect(screen.queryByText('SKU igual')).not.toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: /sí, es la misma → unificar/i }));

      expect(onLinkToVariant).toHaveBeenCalledWith(suggestion2);
      expect(onLinkToVariant).not.toHaveBeenCalledWith(suggestion1);
    });
  });

  describe('chip de atributos de la línea externa', () => {
    it('muestra "Azul · M" a partir de item.attribute_values', () => {
      renderCard({
        task: makeTask({
          items: [makeItem({ attribute_values: { color: 'Azul', talla: 'M' } })],
        }),
      });

      expect(screen.getByText('Azul · M')).toBeInTheDocument();
    });
  });

  describe('buscador ("Buscar otra variante")', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('con menos de 2 caracteres no dispara la búsqueda', async () => {
      const user = userEvent.setup({ delay: null });
      renderCard();

      await user.type(screen.getByLabelText('Nombre, SKU...'), 'a');

      act(() => {
        jest.advanceTimersByTime(300);
      });

      expect(mockSearchVariants).not.toHaveBeenCalled();
      expect(
        screen.getByText('Escribí al menos 2 caracteres para buscar'),
      ).toBeInTheDocument();
    });

    it('con resultados, seleccionar uno llama a onLinkToVariant con la variante elegida', async () => {
      const result: VariantSearchResult = {
        variant_id: 'variant-found-1',
        product_name: 'Campera Azul M (encontrada)',
        sku: 'CAM-AZUL-M-FOUND',
        company_sku: null,
        attribute_values: { color: 'Azul', talla: 'M' },
      };
      mockSearchVariants.mockResolvedValue([result]);
      const onLinkToVariant = jest.fn();
      const user = userEvent.setup({ delay: null });

      renderCard({ onLinkToVariant });

      await user.type(screen.getByLabelText('Nombre, SKU...'), 'campera');

      act(() => {
        jest.advanceTimersByTime(300);
      });

      await waitFor(() => expect(mockSearchVariants).toHaveBeenCalledWith('campera'));

      const optionButton = await screen.findByRole('button', {
        name: 'Campera Azul M (encontrada)',
      });
      await user.click(optionButton);

      expect(onLinkToVariant).toHaveBeenCalledWith(result);
    });

    it('sin resultados muestra "No se encontraron variantes"', async () => {
      mockSearchVariants.mockResolvedValue([]);
      const user = userEvent.setup({ delay: null });

      renderCard();

      await user.type(screen.getByLabelText('Nombre, SKU...'), 'inexistente');

      act(() => {
        jest.advanceTimersByTime(300);
      });

      await waitFor(() => expect(mockSearchVariants).toHaveBeenCalledWith('inexistente'));
      expect(await screen.findByText('No se encontraron variantes')).toBeInTheDocument();
    });

    it('si la búsqueda falla, muestra toast.error', async () => {
      mockSearchVariants.mockRejectedValue(new Error('falla de red'));
      const user = userEvent.setup({ delay: null });

      renderCard();

      await user.type(screen.getByLabelText('Nombre, SKU...'), 'campera');

      act(() => {
        jest.advanceTimersByTime(300);
      });

      await waitFor(() =>
        expect(mockToast.error).toHaveBeenCalledWith('No se pudieron buscar variantes'),
      );
    });
  });
});
