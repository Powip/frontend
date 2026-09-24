/**
 * Tests: ReconciliationMergeDialog (FEAT-17 Anexo B — "Unificar" con detalle
 * de producto + flujo de 2 pasos)
 *
 * Comportamiento verificado:
 * 1. `task: null` no renderiza nada.
 * 2. El título muestra "Unificar · {nombre de la sugerida}".
 * 3. Preselecciona como ganador el candidato con `is_suggested_winner: true`,
 *    sin importar su posición dentro de `task.items` (radios identificados
 *    por `aria-label`, ya no envueltos en `<label>`).
 * 4. Cambiar la selección de ganador (radio) + confirmar recalcula
 *    correctamente `loser_variant_ids` como el resto de los ids del cluster.
 * 5. Confirmar con la preselección por defecto llama a
 *    `resolveReconciliationMerge(taskId, winnerId, loserIds)` con los ids
 *    correctos (contrato de merge sin cambios).
 * 6. "Cancelar" (paso 1) NO llama a `resolveReconciliationMerge` y dispara
 *    `onClose`.
 * 7. "← Volver" (paso 2) vuelve al paso 1 sin cerrar el diálogo ni llamar a
 *    `resolveReconciliationMerge`.
 * 8. Mientras se aplica la unificación se ve "Aplicando..." con spinner y
 *    "← Volver"/"Aplicar unificación" quedan deshabilitados.
 * 9. Si `resolveReconciliationMerge` rechaza, se muestra `toast.error` (con
 *    el fallback genérico o el mensaje puntual del backend) y el diálogo
 *    sigue abierto en el paso de vista previa (no se llama a `onClose`).
 * 10. Los textos de irreversibilidad ("no se puede deshacer" / "quedan
 *     inactivas") sólo aparecen en el paso 2 (vista previa), no en el 1.
 * 11. Con el detalle (`getReconciliationTaskDetails`) resuelto OK: expandir
 *     una candidata ("Ver detalle") muestra descripción, marca, categoría y
 *     la tabla de variantes hermanas del producto con su SKU, precio y
 *     stock (de `getStockByVariants`).
 * 12. La vista previa muestra el stock total antes → después (suma de las
 *     candidatas que se fusionan) en la ganadora.
 * 13. Si `getReconciliationTaskDetails` falla: se muestra el aviso de
 *     fallback, las tarjetas caen a la info básica de `task.items` (sin
 *     botón "Ver detalle") y el merge se puede aplicar igual.
 * 14. Si sólo `getStockByVariants` falla: el stock de cada candidata y de
 *     la vista previa se muestra como "—" (en vez de romper la UI).
 *
 * Mocks aplicados:
 * - @/services/reconciliationTask.service → `resolveReconciliationMerge`,
 *   `getReconciliationTaskErrorMessage` (por defecto devuelve el `fallback`
 *   recibido) y `getReconciliationTaskDetails` (nuevo, FEAT-17 Anexo B).
 * - @/services/inventoryItems.service → `getStockByVariants` (nuevo).
 * - sonner → toast.success/error.
 * - AlertDialog (Radix) → SIN mockear, es seguro en jsdom.
 * - El componente usa react-query (`useReconciliationTaskDetails` +
 *   `useReconciliationStockByVariants`) contra los services mockeados
 *   arriba, así que el render se envuelve en un `QueryClientProvider` real
 *   (`retry: false`) — mismo patrón que `ReconciliationTab.test.tsx`.
 */

import { render, screen, waitFor, within } from '@testing-library/react';
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
  resolveReconciliationMerge: jest.fn(),
  getReconciliationTaskErrorMessage: jest.fn(
    (_error: unknown, fallback: string) => fallback,
  ),
  getReconciliationTaskDetails: jest.fn(),
}));

jest.mock('@/services/inventoryItems.service', () => ({
  getStockByVariants: jest.fn(),
}));

// ── Imports bajo prueba (después de los mocks) ────────────────────────────────

import { toast } from 'sonner';
import {
  resolveReconciliationMerge,
  getReconciliationTaskErrorMessage,
  getReconciliationTaskDetails,
  type ReconciliationTask,
  type ReconciliationTaskItem,
  type ReconciliationTaskDetails,
  type ReconciliationTaskDetailCandidate,
} from '@/services/reconciliationTask.service';
import { getStockByVariants, type VariantStock } from '@/services/inventoryItems.service';
import { ReconciliationMergeDialog } from '../ReconciliationMergeDialog';

// ── Casts ────────────────────────────────────────────────────────────────────

const mockResolveMerge = jest.mocked(resolveReconciliationMerge);
const mockGetErrorMessage = jest.mocked(getReconciliationTaskErrorMessage);
const mockGetTaskDetails = jest.mocked(getReconciliationTaskDetails);
const mockGetStock = jest.mocked(getStockByVariants);
const mockToast = toast as jest.Mocked<typeof toast>;

// ── Fixtures: task (básico, siempre disponible aunque falle el detalle) ───────

function makeItem(overrides: Partial<ReconciliationTaskItem> = {}): ReconciliationTaskItem {
  return {
    variant_id: 'variant-x',
    product_id: 'product-x',
    variant_name: 'Producto X',
    sku: 'SKU-X',
    company_sku: null,
    external_id: 'ext-x',
    source: 'shopify',
    confidence: 0.8,
    ...overrides,
  };
}

/**
 * Cluster de 3 candidatos donde el sugerido (Producto B) NO es el primero
 * del array — a propósito, para verificar que la preselección se basa en
 * `is_suggested_winner`, no en la posición. Nombres/SKUs/orígenes
 * coinciden con los de `makeCandidateA/B/C` (el detalle enriquecido) para
 * no tener que distinguir "nombre del item" vs "nombre del detalle" en los
 * asserts.
 */
function makeClusterTask(overrides: Partial<ReconciliationTask> = {}): ReconciliationTask {
  return {
    id: 'task-cluster-1',
    companyId: 'company-1',
    type: 'duplicate_cluster',
    status: 'pending',
    confidenceLevel: 0.85,
    dedupeKey: null,
    resolvedByUserId: null,
    resolvedAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    items: [
      makeItem({
        variant_id: 'variant-a',
        variant_name: 'Producto A',
        sku: 'SKU-A',
        source: 'shopify',
        confidence: 0.9,
      }),
      makeItem({
        variant_id: 'variant-b',
        variant_name: 'Producto B',
        sku: 'SKU-B',
        source: 'aliclik',
        confidence: 0.95,
        is_suggested_winner: true,
      }),
      makeItem({
        variant_id: 'variant-c',
        variant_name: 'Producto C',
        sku: 'SKU-C',
        source: 'yavendio',
        confidence: 0.7,
      }),
    ],
    ...overrides,
  };
}

// ── Fixtures: detalle enriquecido (getReconciliationTaskDetails) ──────────────

function makeCandidateA(): ReconciliationTaskDetailCandidate {
  return {
    variant_id: 'variant-a',
    is_suggested_winner: false,
    confidence: 0.9,
    source: 'shopify',
    variant: {
      id: 'variant-a',
      sku: 'SKU-A',
      company_sku: null,
      attribute_values: { color: 'Rojo' },
      price: 45,
      cost: 20,
      is_active: true,
      merged_into: null,
    },
    product: {
      id: 'product-a',
      name: 'Producto A',
      description: 'Zapatilla deportiva colorida y cómoda',
      image_url: null,
      brand: { id: 'brand-a', name: 'Marca A' },
      category: { id: 'cat-a', name: 'Calzado' },
      subcategory: null,
      external_source: 'shopify',
      variants: [
        {
          id: 'variant-a',
          sku: 'SKU-A',
          company_sku: null,
          attribute_values: { color: 'Rojo' },
          price: 45,
          is_active: true,
        },
        {
          id: 'variant-a-sibling',
          sku: 'SKU-A-38',
          company_sku: null,
          attribute_values: { color: 'Rojo', talla: '38' },
          price: 45,
          is_active: true,
        },
      ],
    },
  };
}

function makeCandidateB(): ReconciliationTaskDetailCandidate {
  return {
    variant_id: 'variant-b',
    is_suggested_winner: true,
    confidence: 0.95,
    source: 'aliclik',
    variant: {
      id: 'variant-b',
      sku: 'SKU-B',
      company_sku: null,
      attribute_values: {},
      price: 60,
      cost: 30,
      is_active: true,
      merged_into: null,
    },
    product: {
      id: 'product-b',
      name: 'Producto B',
      description: 'Descripción B',
      image_url: null,
      brand: { id: 'brand-b', name: 'Marca B' },
      category: { id: 'cat-b', name: 'Ropa' },
      subcategory: { id: 'sub-b', name: 'Camisetas' },
      external_source: 'aliclik',
      variants: [
        {
          id: 'variant-b',
          sku: 'SKU-B',
          company_sku: null,
          attribute_values: {},
          price: 60,
          is_active: true,
        },
      ],
    },
  };
}

function makeCandidateC(): ReconciliationTaskDetailCandidate {
  return {
    variant_id: 'variant-c',
    is_suggested_winner: false,
    confidence: 0.7,
    source: 'yavendio',
    variant: {
      id: 'variant-c',
      sku: 'SKU-C',
      company_sku: null,
      attribute_values: {},
      price: 20,
      cost: null,
      is_active: true,
      merged_into: null,
    },
    product: {
      id: 'product-c',
      name: 'Producto C',
      description: null,
      image_url: null,
      brand: null,
      category: null,
      subcategory: null,
      external_source: 'yavendio',
      variants: [
        {
          id: 'variant-c',
          sku: 'SKU-C',
          company_sku: null,
          attribute_values: {},
          price: 20,
          is_active: true,
        },
      ],
    },
  };
}

function makeTaskDetails(
  candidates: ReconciliationTaskDetailCandidate[] = [
    makeCandidateA(),
    makeCandidateB(),
    makeCandidateC(),
  ],
): ReconciliationTaskDetails {
  return { task_id: 'task-cluster-1', candidates };
}

// Stock de las 4 variantes que puede llegar a pedir el diálogo (3 candidatas
// + la hermana de "Producto A"). Diseñado para que el total (5+2+10+3 = 20)
// dé el mismo "después" (18, sin contar la propia ganadora) sin importar
// cuál de las 3 candidatas del cluster gane — sólo cambia el "antes".
const STOCK_FIXTURE: VariantStock[] = [
  { variant_id: 'variant-a', quantity: 5, reserved_quantity: 1, available: 4, inventories: [] },
  {
    variant_id: 'variant-a-sibling',
    quantity: 2,
    reserved_quantity: 0,
    available: 2,
    inventories: [],
  },
  { variant_id: 'variant-b', quantity: 10, reserved_quantity: 2, available: 8, inventories: [] },
  { variant_id: 'variant-c', quantity: 3, reserved_quantity: 0, available: 3, inventories: [] },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function buildWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  function QueryWrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }
  QueryWrapper.displayName = 'QueryWrapper';
  return QueryWrapper;
}

function renderDialog(
  task: ReconciliationTask | null,
  onClose: () => void = jest.fn(),
  onSuccess: () => Promise<void> | void = jest.fn(),
) {
  const Wrapper = buildWrapper();
  return render(
    <Wrapper>
      <ReconciliationMergeDialog task={task} onClose={onClose} onSuccess={onSuccess} />
    </Wrapper>,
  );
}

/** Único `<span>` cuyo texto matchea `regex` — evita el falso-positivo de
 * `getByText` con regex contra los `<div>` ancestros que también contienen
 * ese texto (mismo substring, más contenido alrededor). */
function getBySpanText(regex: RegExp): HTMLElement {
  return screen.getByText(
    (_, element) => element?.tagName === 'SPAN' && regex.test(element.textContent ?? ''),
  );
}

/** Texto completo de la tarjeta-stat (label + valor) que contiene `labelRegex`
 * — usado para las filas "Stock total antes → después" / "Reservas antes →
 * después" de la vista previa, cuyo valor vive en un `<p>` hermano del label. */
function getStatCardText(labelRegex: RegExp): string {
  const label = screen.getByText(labelRegex);
  return label.closest('div')?.textContent ?? '';
}

// ── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  mockResolveMerge.mockResolvedValue(makeClusterTask({ status: 'confirmed' }));
  mockGetTaskDetails.mockResolvedValue(makeTaskDetails());
  mockGetStock.mockResolvedValue(STOCK_FIXTURE);
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe('ReconciliationMergeDialog', () => {
  it('task: null no renderiza nada', () => {
    renderDialog(null);

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('el título muestra "Unificar · {nombre de la sugerida}"', async () => {
    renderDialog(makeClusterTask());

    expect(await screen.findByText('Unificar · Producto B')).toBeInTheDocument();
  });

  describe('preselección del ganador sugerido', () => {
    it('preselecciona el candidato con is_suggested_winner: true, sin importar su posición', async () => {
      renderDialog(makeClusterTask());

      const radios = (await screen.findAllByRole('radio')) as HTMLInputElement[];
      expect(radios).toHaveLength(3);
      expect(radios[0]).not.toBeChecked(); // Producto A
      expect(radios[1]).toBeChecked(); // Producto B (sugerido)
      expect(radios[2]).not.toBeChecked(); // Producto C

      expect(
        screen.getByRole('radio', { name: 'Elegir "Producto B" como la que queda en Powip' }),
      ).toBeChecked();
    });
  });

  describe('confirmar la fusión', () => {
    it('con la preselección por defecto, llama a resolveReconciliationMerge con winner/loser ids correctos', async () => {
      renderDialog(makeClusterTask());
      await screen.findAllByRole('radio');

      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: /vista previa/i }));
      await user.click(screen.getByRole('button', { name: /aplicar unificación/i }));

      await waitFor(() =>
        expect(mockResolveMerge).toHaveBeenCalledWith('task-cluster-1', 'variant-b', [
          'variant-a',
          'variant-c',
        ]),
      );
      expect(mockToast.success).toHaveBeenCalledWith(
        'Cluster de duplicados fusionado correctamente',
      );
    });

    it('tras confirmar exitosamente, llama a onSuccess y luego a onClose', async () => {
      const onClose = jest.fn();
      const onSuccess = jest.fn().mockResolvedValue(undefined);
      renderDialog(makeClusterTask(), onClose, onSuccess);
      await screen.findAllByRole('radio');

      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: /vista previa/i }));
      await user.click(screen.getByRole('button', { name: /aplicar unificación/i }));

      await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    });

    it('cambiar la selección de ganador recalcula loser_variant_ids como el resto del cluster', async () => {
      renderDialog(makeClusterTask());
      const radios = (await screen.findAllByRole('radio')) as HTMLInputElement[];

      const user = userEvent.setup();
      await user.click(radios[2]); // Producto C
      expect(radios[2]).toBeChecked();
      expect(radios[1]).not.toBeChecked();

      await user.click(screen.getByRole('button', { name: /vista previa/i }));
      await user.click(screen.getByRole('button', { name: /aplicar unificación/i }));

      await waitFor(() =>
        expect(mockResolveMerge).toHaveBeenCalledWith('task-cluster-1', 'variant-c', [
          'variant-a',
          'variant-b',
        ]),
      );
    });
  });

  describe('cancelar (paso 1)', () => {
    it('"Cancelar" NO llama a resolveReconciliationMerge y dispara onClose', async () => {
      const onClose = jest.fn();
      renderDialog(makeClusterTask(), onClose);
      await screen.findAllByRole('radio');

      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: /cancelar/i }));

      expect(mockResolveMerge).not.toHaveBeenCalled();
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('"← Volver" (paso 2)', () => {
    it('vuelve al paso 1 sin cerrar el diálogo ni aplicar el merge', async () => {
      const onClose = jest.fn();
      renderDialog(makeClusterTask(), onClose);
      await screen.findAllByRole('radio');

      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: /vista previa/i }));
      expect(
        await screen.findByRole('button', { name: /aplicar unificación/i }),
      ).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: /volver/i }));

      expect(await screen.findByRole('button', { name: /vista previa/i })).toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: /aplicar unificación/i }),
      ).not.toBeInTheDocument();
      expect(mockResolveMerge).not.toHaveBeenCalled();
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe('spinner y disabled mientras se aplica', () => {
    it('muestra "Aplicando..." y deshabilita "← Volver" / "Aplicar unificación"', async () => {
      let resolvePromise!: (value: ReconciliationTask) => void;
      mockResolveMerge.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolvePromise = resolve;
          }),
      );
      renderDialog(makeClusterTask());
      await screen.findAllByRole('radio');

      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: /vista previa/i }));
      await user.click(screen.getByRole('button', { name: /aplicar unificación/i }));

      expect(await screen.findByText(/aplicando/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /volver/i })).toBeDisabled();
      expect(screen.getByRole('button', { name: /aplicando/i })).toBeDisabled();

      resolvePromise(makeClusterTask({ status: 'confirmed' }));
      await waitFor(() => expect(screen.queryByText(/aplicando/i)).not.toBeInTheDocument());
    });
  });

  describe('manejo de errores', () => {
    it('si resolveReconciliationMerge rechaza, muestra toast.error y mantiene el diálogo abierto en vista previa', async () => {
      const onClose = jest.fn();
      mockResolveMerge.mockRejectedValueOnce(new Error('falla de red'));
      renderDialog(makeClusterTask(), onClose);
      await screen.findAllByRole('radio');

      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: /vista previa/i }));
      await user.click(screen.getByRole('button', { name: /aplicar unificación/i }));

      expect(
        await screen.findByRole('button', { name: /aplicar unificación/i }),
      ).toBeInTheDocument();
      expect(mockToast.error).toHaveBeenCalledWith('No se pudo resolver el merge del cluster');
      expect(onClose).not.toHaveBeenCalled();
    });

    it('si rechaza con un mensaje puntual del backend, el toast muestra ese mensaje (no el fallback)', async () => {
      const conflictMessage =
        'No se pueden fusionar variantes con atributos distintos (color/talle/etc.). Revisá el cluster.';
      mockResolveMerge.mockRejectedValueOnce({
        response: { data: { message: conflictMessage } },
      });
      mockGetErrorMessage.mockImplementationOnce((error: unknown, fallback: string) => {
        const apiError = error as { response?: { data?: { message?: string } } };
        return apiError?.response?.data?.message ?? fallback;
      });
      renderDialog(makeClusterTask());
      await screen.findAllByRole('radio');

      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: /vista previa/i }));
      await user.click(screen.getByRole('button', { name: /aplicar unificación/i }));

      await waitFor(() => expect(mockToast.error).toHaveBeenCalledWith(conflictMessage));
      expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    });
  });

  describe('textos de irreversibilidad', () => {
    it('sólo aparecen en el paso de vista previa, no en el de selección', async () => {
      renderDialog(makeClusterTask());
      await screen.findAllByRole('radio');

      expect(screen.queryByText(/esta acción no se puede deshacer/i)).not.toBeInTheDocument();
      expect(
        screen.queryByText(/las variantes que se fusionan quedan inactivas/i),
      ).not.toBeInTheDocument();

      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: /vista previa/i }));

      expect(await screen.findByText(/esta acción no se puede deshacer/i)).toBeInTheDocument();
      expect(
        screen.getByText(/las variantes que se fusionan quedan inactivas/i),
      ).toBeInTheDocument();
    });
  });

  describe('detalle de producto (getReconciliationTaskDetails OK)', () => {
    it('expandir una candidata muestra descripción, marca, categoría, variantes hermanas con su stock y precio', async () => {
      renderDialog(makeClusterTask());
      const expandButtons = await screen.findAllByRole('button', { name: /ver detalle/i });
      expect(expandButtons).toHaveLength(3);

      const user = userEvent.setup();
      await user.click(expandButtons[0]); // Producto A

      expect(
        screen.getByText(/zapatilla deportiva colorida y cómoda/i),
      ).toBeInTheDocument();
      expect(getBySpanText(/marca a/i)).toBeInTheDocument();
      expect(getBySpanText(/calzado/i)).toBeInTheDocument();

      // Variante hermana del mismo producto (no es una de las candidatas del
      // cluster) con su propio SKU, precio y stock.
      const siblingSkuCell = screen.getByText('SKU-A-38');
      const siblingRow = siblingSkuCell.closest('tr');
      expect(siblingRow).not.toBeNull();
      const cells = within(siblingRow as HTMLElement).getAllByRole('cell');
      expect(cells[2].textContent).toEqual(expect.stringContaining('45')); // precio
      expect(cells[3].textContent).toEqual(expect.stringContaining('2')); // stock
    });

    it('la vista previa muestra el stock total antes → después (suma de las variantes que se fusionan) en la ganadora', async () => {
      renderDialog(makeClusterTask());
      await screen.findAllByRole('radio');

      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: /vista previa/i }));

      await waitFor(() =>
        expect(getStatCardText(/stock total antes → después/i)).toContain('10 → 18'),
      );
      expect(getStatCardText(/reservas antes → después/i)).toContain('2 → 3');
    });
  });

  describe('fallback cuando falla el detalle (getReconciliationTaskDetails)', () => {
    it('muestra el aviso, cae a la info básica (sin "Ver detalle") y el merge se puede aplicar igual', async () => {
      mockGetTaskDetails.mockRejectedValueOnce(new Error('boom'));
      const onClose = jest.fn();
      const onSuccess = jest.fn().mockResolvedValue(undefined);
      renderDialog(makeClusterTask(), onClose, onSuccess);

      expect(
        await screen.findByText(/no se pudo cargar el detalle de los productos/i),
      ).toBeInTheDocument();

      const radios = await screen.findAllByRole('radio');
      expect(radios).toHaveLength(3);
      expect(screen.queryByRole('button', { name: /ver detalle/i })).not.toBeInTheDocument();

      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: /vista previa/i }));
      await user.click(screen.getByRole('button', { name: /aplicar unificación/i }));

      await waitFor(() =>
        expect(mockResolveMerge).toHaveBeenCalledWith('task-cluster-1', 'variant-b', [
          'variant-a',
          'variant-c',
        ]),
      );
      expect(mockToast.success).toHaveBeenCalledWith(
        'Cluster de duplicados fusionado correctamente',
      );
      await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    });
  });

  describe('fallback cuando sólo falla el stock (getStockByVariants)', () => {
    it('muestra "—" en el stock de las candidatas y en la vista previa', async () => {
      mockGetStock.mockRejectedValueOnce(new Error('stock down'));
      renderDialog(makeClusterTask());

      await screen.findAllByRole('radio');
      await waitFor(() => expect(screen.getAllByText(/stock —/i).length).toBeGreaterThan(0));

      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: /vista previa/i }));

      // Con `stockQuery.isError` el sumbox NO arma un "antes → después" con
      // un "0" inventado: muestra sólo "—" (el label sigue teniendo su
      // propia flecha "antes → después", pero el valor no).
      await waitFor(() =>
        expect(getStatCardText(/stock total antes → después/i)).toMatch(/—$/),
      );
      expect(getStatCardText(/stock total antes → después/i)).not.toMatch(/\d/);
      expect(getStatCardText(/reservas antes → después/i)).toMatch(/—$/);
      expect(getStatCardText(/reservas antes → después/i)).not.toMatch(/\d/);
    });
  });

  describe('mientras se está calculando el stock (getStockByVariants pendiente)', () => {
    it('la vista previa muestra "Calculando…" y no "0 → 0"', async () => {
      let resolveStock!: (value: VariantStock[]) => void;
      mockGetStock.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveStock = resolve;
          }),
      );
      renderDialog(makeClusterTask());
      await screen.findAllByRole('radio');

      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: /vista previa/i }));

      expect(await screen.findAllByText(/calculando…/i)).toHaveLength(2);
      expect(screen.queryByText(/0 → 0/)).not.toBeInTheDocument();

      resolveStock(STOCK_FIXTURE);
      await waitFor(() =>
        expect(getStatCardText(/stock total antes → después/i)).toContain('10 → 18'),
      );
    });
  });
});
