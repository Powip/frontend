/**
 * Tests: ReconciliationLinkDialog (FEAT-17 Anexo A — bandeja de reconciliación)
 *
 * Comportamiento verificado:
 * 1. `target: null` no renderiza nada.
 * 2. Con `target` presente, muestra ambos lados: "Provisional (venta)" (con
 *    el `variant_name`/SKU/atributos del item de la tarea) y "Variante en
 *    Powip" (con `product_name`/`sku`/atributos de la variante elegida),
 *    más el texto "Las próximas ventas de esta variante descontarán
 *    stock..." y la advertencia "Esta acción no se puede deshacer.".
 * 3. Cancelar NO llama a `resolveReconciliationLink` y dispara `onClose`.
 * 4. Confirmar llama a `resolveReconciliationLink(task.id, variant.variant_id)`
 *    y, si resuelve, muestra `toast.success`, llama a `onSuccess(task.id)` y
 *    luego a `onClose`.
 * 5. El botón "Confirmar vinculación" muestra "Vinculando..." mientras la
 *    mutación está en curso.
 * 6. Si `resolveReconciliationLink` rechaza la promesa, se muestra
 *    `toast.error` y el diálogo sigue abierto (no se llama a `onClose`).
 *
 * Mocks aplicados:
 * - @/services/reconciliationTask.service → `resolveReconciliationLink` +
 *   `getReconciliationTaskErrorMessage` (devuelve el `fallback` recibido).
 * - sonner → toast.success/error.
 * - AlertDialog (Radix) → SIN mockear, es seguro en jsdom (no depende de
 *   pointer capture / ResizeObserver como sí lo hace Select).
 */

import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ── Mocks de infraestructura ─────────────────────────────────────────────────

jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('@/services/reconciliationTask.service', () => ({
  resolveReconciliationLink: jest.fn(),
  getReconciliationTaskErrorMessage: jest.fn(
    (_error: unknown, fallback: string) => fallback,
  ),
}));

// ── Imports bajo prueba (después de los mocks) ────────────────────────────────

import { toast } from 'sonner';
import {
  resolveReconciliationLink,
  type ReconciliationTask,
  type ReconciliationTaskItem,
} from '@/services/reconciliationTask.service';
import {
  ReconciliationLinkDialog,
  type ReconciliationLinkTargetVariant,
} from '../ReconciliationLinkDialog';

// ── Casts ────────────────────────────────────────────────────────────────────

const mockResolveLink = jest.mocked(resolveReconciliationLink);
const mockToast = toast as jest.Mocked<typeof toast>;

// ── Fixtures ─────────────────────────────────────────────────────────────────

function makeItem(overrides: Partial<ReconciliationTaskItem> = {}): ReconciliationTaskItem {
  return {
    variant_id: null,
    product_id: null,
    variant_name: 'Zapatilla Roja Talla 40',
    sku: null,
    company_sku: 'ZAP-ROJA-40',
    external_id: 'ext-shopify-1',
    source: 'shopify',
    confidence: 0,
    attribute_values: { color: 'Rojo', talla: '40' },
    ...overrides,
  };
}

function makeProvisionalTask(overrides: Partial<ReconciliationTask> = {}): ReconciliationTask {
  return {
    id: 'task-prov-1',
    companyId: 'company-1',
    type: 'provisional',
    status: 'pending',
    confidenceLevel: null,
    dedupeKey: null,
    resolvedByUserId: null,
    resolvedAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    items: [makeItem()],
    ...overrides,
  };
}

function makeVariant(
  overrides: Partial<ReconciliationLinkTargetVariant> = {},
): ReconciliationLinkTargetVariant {
  return {
    variant_id: 'variant-existing-99',
    product_name: 'Zapatilla Roja Talla 40 (Powip)',
    sku: 'ZAP-ROJA-40-POWIP',
    attribute_values: { color: 'Rojo', material: 'Cuero' },
    ...overrides,
  };
}

function makeTarget(overrides: {
  task?: ReconciliationTask;
  variant?: ReconciliationLinkTargetVariant;
} = {}) {
  return {
    task: overrides.task ?? makeProvisionalTask(),
    variant: overrides.variant ?? makeVariant(),
  };
}

// ── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  mockResolveLink.mockResolvedValue(makeProvisionalTask({ status: 'confirmed' }));
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe('ReconciliationLinkDialog', () => {
  it('target: null no renderiza nada', () => {
    render(
      <ReconciliationLinkDialog target={null} onClose={jest.fn()} onSuccess={jest.fn()} />,
    );

    expect(screen.queryByText(/vincular a variante existente/i)).not.toBeInTheDocument();
  });

  it('muestra ambos lados (provisional y variante en Powip) con sus atributos, y la advertencia de acción irreversible', () => {
    const target = makeTarget();
    render(
      <ReconciliationLinkDialog target={target} onClose={jest.fn()} onSuccess={jest.fn()} />,
    );

    expect(screen.getByText(/vincular a variante existente/i)).toBeInTheDocument();

    // Cada lado se scopea con `within()` sobre su columna (ubicada a partir
    // del título "Provisional (venta)" / "Variante en Powip" y su
    // `.closest('div')` contenedor): el SKU de la variante de Powip
    // ("ZAP-ROJA-40-POWIP") contiene como substring el SKU del provisional
    // ("ZAP-ROJA-40"), así que sin scopear por columna una búsqueda laxa
    // matchea ambos lados a la vez.
    const provisionalColumn = within(
      screen.getByText('Provisional (venta)').closest('div') as HTMLElement,
    );
    expect(provisionalColumn.getByText('Zapatilla Roja Talla 40')).toBeInTheDocument();
    expect(provisionalColumn.getByText('SKU: ZAP-ROJA-40')).toBeInTheDocument();
    expect(provisionalColumn.getByText('Rojo · 40')).toBeInTheDocument();

    const powipColumn = within(
      screen.getByText('Variante en Powip').closest('div') as HTMLElement,
    );
    expect(powipColumn.getByText('Zapatilla Roja Talla 40 (Powip)')).toBeInTheDocument();
    expect(powipColumn.getByText('SKU: ZAP-ROJA-40-POWIP')).toBeInTheDocument();
    expect(powipColumn.getByText('Rojo · Cuero')).toBeInTheDocument();

    expect(
      screen.getByText(
        /las próximas ventas de esta variante descontarán stock de la variante de powip/i,
      ),
    ).toBeInTheDocument();
    expect(screen.getByText(/esta acción no se puede deshacer/i)).toBeInTheDocument();
  });

  describe('cancelar', () => {
    it('NO llama a resolveReconciliationLink y dispara onClose', async () => {
      const target = makeTarget();
      const onClose = jest.fn();
      render(
        <ReconciliationLinkDialog target={target} onClose={onClose} onSuccess={jest.fn()} />,
      );

      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: /cancelar/i }));

      expect(mockResolveLink).not.toHaveBeenCalled();
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('confirmar la vinculación', () => {
    it('llama a resolveReconciliationLink con el id de la tarea y el variant_id de la variante elegida', async () => {
      const target = makeTarget();
      render(
        <ReconciliationLinkDialog target={target} onClose={jest.fn()} onSuccess={jest.fn()} />,
      );

      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: /confirmar vinculación/i }));

      await waitFor(() =>
        expect(mockResolveLink).toHaveBeenCalledWith('task-prov-1', 'variant-existing-99'),
      );
      expect(mockToast.success).toHaveBeenCalledWith('Variante vinculada correctamente');
    });

    it('muestra "Vinculando..." en el botón mientras la mutación está en curso', async () => {
      const target = makeTarget();
      let resolveLink!: (value: ReconciliationTask) => void;
      mockResolveLink.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveLink = resolve;
          }),
      );
      render(
        <ReconciliationLinkDialog target={target} onClose={jest.fn()} onSuccess={jest.fn()} />,
      );

      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: /confirmar vinculación/i }));

      expect(await screen.findByText(/vinculando\.\.\./i)).toBeInTheDocument();

      resolveLink(makeProvisionalTask({ status: 'confirmed' }));

      await waitFor(() =>
        expect(screen.queryByText(/vinculando\.\.\./i)).not.toBeInTheDocument(),
      );
    });

    it('tras confirmar exitosamente, llama a onSuccess(taskId) y luego a onClose', async () => {
      const target = makeTarget();
      const onClose = jest.fn();
      const onSuccess = jest.fn().mockResolvedValue(undefined);
      render(
        <ReconciliationLinkDialog target={target} onClose={onClose} onSuccess={onSuccess} />,
      );

      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: /confirmar vinculación/i }));

      await waitFor(() => expect(onSuccess).toHaveBeenCalledWith('task-prov-1'));
      await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    });
  });

  describe('manejo de errores', () => {
    it('si resolveReconciliationLink rechaza, muestra toast.error y no cierra el diálogo', async () => {
      const target = makeTarget();
      const onClose = jest.fn();
      mockResolveLink.mockRejectedValueOnce(new Error('falla de red'));
      render(
        <ReconciliationLinkDialog target={target} onClose={onClose} onSuccess={jest.fn()} />,
      );

      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: /confirmar vinculación/i }));

      expect(
        await screen.findByRole('button', { name: /confirmar vinculación/i }),
      ).toBeInTheDocument();
      expect(mockToast.error).toHaveBeenCalledWith('No se pudo vincular la variante');
      expect(onClose).not.toHaveBeenCalled();
    });
  });
});
