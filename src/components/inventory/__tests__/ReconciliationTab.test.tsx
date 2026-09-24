/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Tests: ReconciliationTab (FEAT-17 Anexo A — bandeja de reconciliación)
 *
 * Comportamiento verificado:
 * 1. Estado de carga: mientras `listReconciliationTasks` está pendiente no se
 *    muestran ni las secciones ni el estado vacío.
 * 2. Estado vacío: cuando la lista resuelve `[]` se muestra el mensaje "No hay
 *    tareas de reconciliación...".
 * 3. Con una mezcla de `type: 'provisional' | 'manual' | 'duplicate_cluster'`
 *    se renderizan las 3 secciones con sus items correspondientes.
 * 4. Cambiar el filtro de Tipo o Estado dispara un nuevo `listReconciliationTasks`
 *    con los params `{ type, status }` actualizados.
 * 5. "Confirmar como nuevo" en un provisional (sin sugerencias, via
 *    `ReconciliationProvisionalCard`) llama a `confirmReconciliationProvisional`
 *    con el id correcto y refresca la lista.
 * 6. "Sí, es la misma → unificar" en un provisional CON sugerencia NO ejecuta
 *    el service directo al click: abre `ReconciliationLinkDialog` ("Vincular
 *    a variante existente") con la sugerencia elegida como variante destino.
 *    Recién al confirmar ahí se llama a `resolveReconciliationLink` con
 *    `(taskId, variant_id de la sugerencia)`.
 * 7. Los 3 botones "Rechazar" (provisional/manual/cluster) NO ejecutan el
 *    service directo al click: abren `ReconciliationRejectDialog` ("Rechazar
 *    tarea de reconciliación"). Recién al confirmar ahí se llama a
 *    `rejectReconciliationTask` con el id correcto.
 * 8. Selección múltiple: FEAT-17 hotfix — `BULK_SELECTABLE_TYPES` ya no
 *    incluye `duplicate_cluster`, así que solo las filas `provisional`
 *    muestran checkbox. Seleccionar un provisional + "Confirmar
 *    seleccionadas" abre el diálogo de confirmación (texto actualizado:
 *    "Los provisionales seleccionados se confirmarán...") y, al confirmar,
 *    llama a `bulkConfirmReconciliationTasks` con el id seleccionado.
 * 9. Si una acción individual rechaza la promesa, se muestra `toast.error` (con
 *    el fallback del propio componente) y el componente no se rompe (el item
 *    sigue visible, el botón vuelve a estar habilitado).
 * 10. Cola manual: NO se renderiza el botón "Confirmar como nuevo" ni el
 *     buscador de variantes ("Buscar otra variante") para items
 *     `type: 'manual'`, solo "Rechazar" — esos items no pasan por
 *     `ReconciliationProvisionalCard`.
 * 11. FEAT-17 Anexo B (rediseño de la sección de clusters): "Revisar y
 *     unificar" en un cluster está habilitado (solo se deshabilita mientras
 *     `isProcessing`) y el click abre `ReconciliationMergeDialog`
 *     ("Unificar · {nombre de la sugerida}"). Ya no se muestra ningún
 *     `Alert` de "Fusión de duplicados pausada" sobre la sección de
 *     clusters. Los clusters siguen sin checkbox de selección (ver punto 8
 *     — `BULK_SELECTABLE_TYPES` solo incluye `provisional`), pero "Son
 *     distintos" (el rechazo del cluster, ya no dice "Rechazar") sigue
 *     habilitado y abre `ReconciliationRejectDialog` igual que en el resto
 *     de los tipos.
 * 12. Con `companyId: undefined`, `loadTasks` corta antes de llamar a
 *     `listReconciliationTasks`, sale de `isLoading` y muestra directamente
 *     el estado vacío (sin pasar por el skeleton).
 * 13. FEAT-17 Anexo B — la franja ámbar "Todas están en {canal}" se muestra
 *     bajo la grilla de candidatas de un cluster cuando TODAS comparten el
 *     mismo `source`, y no aparece si difieren.
 *
 * Mocks aplicados:
 * - @/services/reconciliationTask.service → las 7 funciones de siempre +
 *   `searchReconciliationVariants` (usada por el buscador de
 *   `ReconciliationProvisionalCard`, resuelta con `[]` por defecto — acá no
 *   se ejercita el buscador, ya cubierto en
 *   `ReconciliationProvisionalCard.test.tsx`) + el helper
 *   `getReconciliationTaskErrorMessage` (se mockea devolviendo directamente
 *   el `fallback` recibido) + `getReconciliationTaskDetails` (FEAT-17 Anexo
 *   B, usado por `ReconciliationMergeDialog` — se resuelve con candidatas
 *   vacías por defecto, ya que el detalle enriquecido en sí se cubre en
 *   `ReconciliationMergeDialog.test.tsx`).
 * - @/services/inventoryItems.service → `getStockByVariants` (ídem, usado
 *   por `ReconciliationMergeDialog`, resuelto con `[]` por defecto).
 * - sonner → toast.success/error.
 * - @/components/ui/select → `<select>` nativo (mismo patrón que
 *   ExcelImportWizard.test.tsx / SendToEvaGuideModal.test.tsx): Radix Select
 *   dispara APIs de browser (pointer capture / scroll) no implementadas en
 *   jsdom. Los 2 selects del componente (Tipo, Estado) se distinguen por
 *   orden con `getAllByRole('combobox')` (mismo patrón que
 *   packs-promos/page.test.tsx).
 * - AlertDialog y Checkbox (Radix) → SIN mockear: a diferencia de Select, no
 *   dependen de pointer capture / ResizeObserver, funcionan normalmente sobre
 *   jsdom.
 * - `ReconciliationProvisionalCard` usa el hook real
 *   `useReconciliationVariantSearch` (react-query) para su buscador, así que
 *   `renderTab` envuelve en `QueryClientProvider` (retry: false), mismo
 *   patrón que `useUpsellRecords.test.ts`.
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
  listReconciliationTasks: jest.fn(),
  getReconciliationTask: jest.fn(),
  resolveReconciliationLink: jest.fn(),
  resolveReconciliationMerge: jest.fn(),
  confirmReconciliationProvisional: jest.fn(),
  rejectReconciliationTask: jest.fn(),
  bulkConfirmReconciliationTasks: jest.fn(),
  searchReconciliationVariants: jest.fn(),
  getReconciliationTaskErrorMessage: jest.fn(
    (_error: unknown, fallback: string) => fallback,
  ),
  // FEAT-17 Anexo B — usado por `ReconciliationMergeDialog` (react-query).
  // Resuelto con candidatas vacías por defecto: el diálogo cae al nombre
  // básico de `task.items` para el título, que es lo único que estos tests
  // necesitan (el detalle enriquecido en sí ya se cubre en
  // `ReconciliationMergeDialog.test.tsx`).
  getReconciliationTaskDetails: jest.fn(),
}));

// FEAT-17 Anexo B — usado por `ReconciliationMergeDialog` para el stock de
// la vista previa (react-query). Resuelto con `[]` por defecto.
jest.mock('@/services/inventoryItems.service', () => ({
  getStockByVariants: jest.fn(),
}));

/**
 * Mock de Radix Select → <select> nativo. Idéntico al usado en
 * ExcelImportWizard.test.tsx / SendToEvaGuideModal.test.tsx.
 */
jest.mock('@/components/ui/select', () => {
  const React = require('react');

  function extractText(node: unknown): string {
    if (node === null || node === undefined) return '';
    if (typeof node === 'string' || typeof node === 'number') return String(node);
    if (typeof node === 'boolean') return '';
    if (Array.isArray(node)) return node.map(extractText).join('');
    if (typeof node === 'object' && node !== null && 'props' in node) {
      const el = node as { props: { children?: unknown } };
      return extractText(el.props.children);
    }
    return '';
  }

  const Select = ({
    value,
    onValueChange,
    children,
  }: {
    value?: string;
    onValueChange?: (v: string) => void;
    children?: React.ReactNode;
  }) => {
    const options: { value: string; label: string }[] = [];
    React.Children.forEach(
      children,
      (child: React.ReactElement<{ children?: React.ReactNode }>) => {
        if (!child || !child.props) return;
        if (child.props.children) {
          React.Children.forEach(
            child.props.children,
            (item: React.ReactElement<{ value?: string; children?: React.ReactNode }>) => {
              if (item && item.props && item.props.value !== undefined) {
                options.push({ value: item.props.value, label: extractText(item.props.children) });
              }
            },
          );
        }
      },
    );
    return (
      <select
        value={value}
        onChange={(e) => onValueChange?.(e.target.value)}
        data-testid="select-mock"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    );
  };

  const SelectContent = ({ children }: { children?: React.ReactNode }) => <>{children}</>;
  const SelectItem = ({ value, children }: { value: string; children?: React.ReactNode }) => (
    <option value={value}>{children}</option>
  );
  const SelectTrigger = ({ children }: { children?: React.ReactNode }) => <>{children}</>;
  const SelectValue = ({ placeholder }: { placeholder?: string }) => <span>{placeholder}</span>;

  return { Select, SelectContent, SelectItem, SelectTrigger, SelectValue };
});

// ── Imports bajo prueba (después de los mocks) ────────────────────────────────

import { toast } from 'sonner';
import {
  listReconciliationTasks,
  confirmReconciliationProvisional,
  resolveReconciliationLink,
  rejectReconciliationTask,
  bulkConfirmReconciliationTasks,
  searchReconciliationVariants,
  getReconciliationTaskDetails,
  type ReconciliationTask,
  type ReconciliationTaskItem,
  type ReconciliationTaskSuggestion,
  type BulkConfirmResultItem,
} from '@/services/reconciliationTask.service';
import { getStockByVariants } from '@/services/inventoryItems.service';
import { ReconciliationTab } from '../ReconciliationTab';

// ── Casts ────────────────────────────────────────────────────────────────────

const mockListTasks = jest.mocked(listReconciliationTasks);
const mockConfirmProvisional = jest.mocked(confirmReconciliationProvisional);
const mockResolveLink = jest.mocked(resolveReconciliationLink);
const mockReject = jest.mocked(rejectReconciliationTask);
const mockBulkConfirm = jest.mocked(bulkConfirmReconciliationTasks);
const mockSearchVariants = jest.mocked(searchReconciliationVariants);
const mockGetTaskDetails = jest.mocked(getReconciliationTaskDetails);
const mockGetStock = jest.mocked(getStockByVariants);
const mockToast = toast as jest.Mocked<typeof toast>;

// ── Fixtures ─────────────────────────────────────────────────────────────────

function makeItem(overrides: Partial<ReconciliationTaskItem> = {}): ReconciliationTaskItem {
  return {
    variant_id: 'variant-1',
    product_id: 'product-1',
    variant_name: 'Producto Test',
    sku: 'SKU-001',
    company_sku: null,
    external_id: 'ext-1',
    source: 'shopify',
    confidence: 0,
    ...overrides,
  };
}

function makeTask(overrides: Partial<ReconciliationTask> = {}): ReconciliationTask {
  return {
    id: 'task-1',
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

function makeProvisionalTask(overrides: Partial<ReconciliationTask> = {}): ReconciliationTask {
  return makeTask({
    id: 'task-prov-1',
    type: 'provisional',
    items: [
      makeItem({
        variant_id: null,
        product_id: null,
        variant_name: 'Zapatilla Roja Talla 40',
        sku: null,
        company_sku: 'ZAP-ROJA-40',
        external_id: 'ext-shopify-1',
        source: 'shopify',
        confidence: 0,
      }),
    ],
    ...overrides,
  });
}

function makeSuggestion(
  overrides: Partial<ReconciliationTaskSuggestion> = {},
): ReconciliationTaskSuggestion {
  return {
    variant_id: 'variant-sugerida-1',
    product_name: 'Zapatilla Roja Talla 40 (Powip)',
    sku: 'ZAP-ROJA-40-POWIP',
    company_sku: null,
    attribute_values: { color: 'Rojo', talla: '40' },
    match: 'sku',
    score: 0.95,
    ...overrides,
  };
}

function makeProvisionalTaskWithSuggestion(
  overrides: Partial<ReconciliationTask> = {},
): ReconciliationTask {
  const base = makeProvisionalTask();
  return makeProvisionalTask({
    items: [{ ...base.items[0], suggestions: [makeSuggestion()] }],
    ...overrides,
  });
}

function makeManualTask(overrides: Partial<ReconciliationTask> = {}): ReconciliationTask {
  return makeTask({
    id: 'task-manual-1',
    type: 'manual',
    items: [
      makeItem({
        variant_id: null,
        product_id: null,
        variant_name: 'Línea de venta sin match',
        sku: null,
        company_sku: null,
        external_id: null,
        source: 'yavendio',
        confidence: 0,
        external_order_id: 'ORD-100',
        external_line_ref: 'line-1',
      }),
    ],
    ...overrides,
  });
}

function makeClusterTask(overrides: Partial<ReconciliationTask> = {}): ReconciliationTask {
  return makeTask({
    id: 'task-cluster-1',
    type: 'duplicate_cluster',
    confidenceLevel: 0.85,
    items: [
      makeItem({
        variant_id: 'variant-a',
        product_id: 'product-a',
        variant_name: 'Camiseta Azul M',
        sku: 'CAM-AZUL-M',
        source: 'shopify',
        confidence: 0.9,
        is_suggested_winner: true,
      }),
      makeItem({
        variant_id: 'variant-b',
        product_id: 'product-b',
        variant_name: 'Camiseta Azul Mediana',
        sku: 'CAM-AZ-M2',
        source: 'aliclik',
        confidence: 0.8,
      }),
    ],
    ...overrides,
  });
}

const DEFAULT_TASK_RESPONSE = makeTask();

// ── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  mockListTasks.mockResolvedValue([]);
  mockConfirmProvisional.mockResolvedValue(DEFAULT_TASK_RESPONSE);
  mockResolveLink.mockResolvedValue(DEFAULT_TASK_RESPONSE);
  mockReject.mockResolvedValue(DEFAULT_TASK_RESPONSE);
  mockBulkConfirm.mockResolvedValue([]);
  mockSearchVariants.mockResolvedValue([]);
  mockGetTaskDetails.mockResolvedValue({ task_id: '', candidates: [] });
  mockGetStock.mockResolvedValue([]);
});

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

function renderTab(companyId: string | undefined = 'company-1') {
  const Wrapper = buildWrapper();
  return render(
    <Wrapper>
      <ReconciliationTab companyId={companyId} />
    </Wrapper>,
  );
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('ReconciliationTab', () => {
  describe('estado de carga y estado vacío', () => {
    it('no muestra secciones ni el estado vacío mientras la carga inicial está pendiente', async () => {
      let resolveList!: (value: ReconciliationTask[]) => void;
      mockListTasks.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveList = resolve;
          }),
      );

      renderTab();

      expect(screen.queryByText(/provisionales pendientes/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/no hay tareas de reconciliación/i)).not.toBeInTheDocument();

      resolveList([makeProvisionalTask()]);

      expect(await screen.findByText(/provisionales pendientes/i)).toBeInTheDocument();
    });

    it('muestra el estado vacío cuando no hay tareas con los filtros aplicados', async () => {
      mockListTasks.mockResolvedValueOnce([]);

      renderTab();

      expect(
        await screen.findByText(/no hay tareas de reconciliación con los filtros aplicados/i),
      ).toBeInTheDocument();
    });

    it('con companyId undefined, sale de loading sin llamar a listReconciliationTasks y muestra el estado vacío sin pasar por el skeleton', () => {
      // Render directo (sin pasar por el helper `renderTab`, que tiene un
      // parámetro con default `= 'company-1'`): un default de parámetro se
      // aplica siempre que el argumento sea `undefined` — también cuando se
      // pasa explícitamente `undefined` — así que `renderTab(undefined)`
      // terminaría renderizando con `companyId: 'company-1'` en vez de
      // `undefined` de verdad, invalidando este test.
      const Wrapper = buildWrapper();
      const { container } = render(
        <Wrapper>
          <ReconciliationTab companyId={undefined} />
        </Wrapper>,
      );

      // `loadTasks` corta antes de pedir datos: nunca queda en isLoading.
      expect(mockListTasks).not.toHaveBeenCalled();
      // El estado vacío se muestra ya en el primer render (sin `findBy`/espera).
      expect(
        screen.getByText(/no hay tareas de reconciliación con los filtros aplicados/i),
      ).toBeInTheDocument();
      // Nunca se llega a mostrar el skeleton de carga (mismo patrón de
      // `container.querySelector('.animate-pulse')` usado en
      // CcAgingHeatmap.test.tsx / CcIntentosCard.test.tsx para detectar el
      // estado de loading de un componente sin rol/texto accesible propio).
      expect(container.querySelector('.animate-pulse')).not.toBeInTheDocument();
    });
  });

  describe('renderiza las 3 secciones con una mezcla de tipos', () => {
    it('muestra provisionales, cola manual y clusters de duplicados a la vez', async () => {
      mockListTasks.mockResolvedValueOnce([
        makeProvisionalTask(),
        makeManualTask(),
        makeClusterTask(),
      ]);

      renderTab();

      expect(await screen.findByText(/provisionales pendientes/i)).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /cola manual/i })).toBeInTheDocument();
      expect(
        screen.getByRole('heading', { name: /clusters de duplicados/i }),
      ).toBeInTheDocument();

      expect(screen.getByText('Zapatilla Roja Talla 40')).toBeInTheDocument();
      expect(screen.getByText('Línea de venta sin match')).toBeInTheDocument();
      // "Camiseta Azul M" (la candidata sugerida) aparece 2 veces en la
      // tarjeta del cluster rediseñada (FEAT-17 Anexo B): una en el título
      // y otra en su fila dentro de la grilla de candidatas.
      expect(screen.getAllByText('Camiseta Azul M')).toHaveLength(2);
      expect(screen.getByText('Camiseta Azul Mediana')).toBeInTheDocument();
      expect(screen.getByText('Sugerida')).toBeInTheDocument();
    });
  });

  describe('filtros', () => {
    it('cambiar el filtro de Tipo o Estado dispara un nuevo fetch con los params actualizados', async () => {
      mockListTasks.mockResolvedValue([]);
      renderTab();

      await waitFor(() =>
        expect(mockListTasks).toHaveBeenLastCalledWith({ type: undefined, status: 'pending' }),
      );

      const [typeSelect, statusSelect] = screen.getAllByRole('combobox');
      const user = userEvent.setup();

      await user.selectOptions(typeSelect, 'provisional');
      await waitFor(() =>
        expect(mockListTasks).toHaveBeenLastCalledWith({
          type: 'provisional',
          status: 'pending',
        }),
      );

      await user.selectOptions(statusSelect, 'confirmed');
      await waitFor(() =>
        expect(mockListTasks).toHaveBeenLastCalledWith({
          type: 'provisional',
          status: 'confirmed',
        }),
      );
    });
  });

  describe('acciones sobre provisionales', () => {
    it('"Confirmar como nuevo" (sin sugerencias) llama a confirmReconciliationProvisional con el id correcto y refresca la lista', async () => {
      const task = makeProvisionalTask();
      mockListTasks.mockResolvedValueOnce([task]).mockResolvedValueOnce([]);

      renderTab();
      await screen.findByText('Zapatilla Roja Talla 40');

      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: /confirmar como nuevo/i }));

      await waitFor(() => expect(mockConfirmProvisional).toHaveBeenCalledWith('task-prov-1'));
      expect(mockToast.success).toHaveBeenCalledWith('Producto confirmado como nuevo');

      // La lista se recarga (2do fetch) y refleja que ya no queda el pendiente.
      await waitFor(() => expect(mockListTasks).toHaveBeenCalledTimes(2));
      expect(
        await screen.findByText(/no hay tareas de reconciliación con los filtros aplicados/i),
      ).toBeInTheDocument();
    });
  });

  describe('vincular a variante existente (provisional con sugerencia)', () => {
    it('"Sí, es la misma → unificar" NO llama al service directo: abre ReconciliationLinkDialog con la sugerencia, y confirmar sí llama a resolveReconciliationLink', async () => {
      const task = makeProvisionalTaskWithSuggestion();
      mockListTasks.mockResolvedValueOnce([task]);

      renderTab();
      await screen.findByText('Zapatilla Roja Talla 40');

      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: /sí, es la misma → unificar/i }));

      // El click abre el diálogo (ReconciliationLinkDialog) sin ejecutar la
      // mutación todavía. Se scopea con `within(alertdialog)` porque el
      // título del diálogo coincide textualmente con contenido de la tarjeta.
      expect(mockResolveLink).not.toHaveBeenCalled();
      const linkDialog = within(await screen.findByRole('alertdialog'));
      expect(linkDialog.getByText(/vincular a variante existente/i)).toBeInTheDocument();
      expect(linkDialog.getByText('Variante en Powip')).toBeInTheDocument();
      expect(linkDialog.getByText('Zapatilla Roja Talla 40 (Powip)')).toBeInTheDocument();
      expect(linkDialog.getByText(/esta acción no se puede deshacer/i)).toBeInTheDocument();

      await user.click(linkDialog.getByRole('button', { name: /confirmar vinculación/i }));

      await waitFor(() =>
        expect(mockResolveLink).toHaveBeenCalledWith('task-prov-1', 'variant-sugerida-1'),
      );
      expect(mockToast.success).toHaveBeenCalledWith('Variante vinculada correctamente');
    });
  });

  describe('acciones de rechazo', () => {
    it('"Rechazar" NO llama al service directo: abre el diálogo de confirmación, y confirmar sí llama a rejectReconciliationTask', async () => {
      const task = makeProvisionalTask();
      mockListTasks.mockResolvedValueOnce([task]);

      renderTab();
      await screen.findByText('Zapatilla Roja Talla 40');

      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: /rechazar/i }));

      // El click abre el diálogo (ReconciliationRejectDialog) sin ejecutar la
      // mutación todavía. Se scopea con `within(alertdialog)` por el mismo
      // criterio que el test de "vincular" — evita falsos matches contra el
      // resto de la tabla/página si el texto se repite en otro lado.
      expect(mockReject).not.toHaveBeenCalled();
      const rejectDialog = within(await screen.findByRole('alertdialog'));
      expect(rejectDialog.getByText(/rechazar tarea de reconciliación/i)).toBeInTheDocument();
      expect(
        rejectDialog.getByText(/la variante provisional se desactivará/i),
      ).toBeInTheDocument();

      await user.click(rejectDialog.getByRole('button', { name: /confirmar rechazo/i }));

      await waitFor(() => expect(mockReject).toHaveBeenCalledWith('task-prov-1'));
      expect(mockToast.success).toHaveBeenCalledWith('Tarea rechazada');
    });
  });

  describe('selección múltiple + confirmación en lote', () => {
    it('solo el provisional tiene checkbox (el cluster ya no es bulk-selectable, FEAT-17) y confirmar en lote llama a bulkConfirmReconciliationTasks con su id', async () => {
      const provisional = makeProvisionalTask();
      const cluster = makeClusterTask();
      mockListTasks
        .mockResolvedValueOnce([provisional, cluster])
        .mockResolvedValueOnce([]);

      const bulkResults: BulkConfirmResultItem[] = [
        { task_id: 'task-prov-1', status: 'confirmed' },
      ];
      mockBulkConfirm.mockResolvedValueOnce(bulkResults);

      renderTab();
      await screen.findByText('Zapatilla Roja Talla 40');
      // El cluster también está renderizado en la misma pantalla, pero no
      // aporta checkbox: el único checkbox visible es el del provisional.
      // "Camiseta Azul M" aparece 2 veces (título + grilla) — `findAllByText`
      // sólo se usa acá para esperar el render, sin afirmar sobre la cuenta.
      await screen.findAllByText('Camiseta Azul M');

      const user = userEvent.setup();
      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes).toHaveLength(1);
      await user.click(checkboxes[0]);

      await user.click(screen.getByRole('button', { name: /confirmar seleccionadas \(1\)/i }));

      expect(
        await screen.findByText(/confirmar 1 tarea\(s\) en lote/i),
      ).toBeInTheDocument();
      expect(
        screen.getByText(
          /los provisionales seleccionados se confirmarán como productos nuevos\. esta acción no se puede deshacer\./i,
        ),
      ).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: /confirmar en lote/i }));

      await waitFor(() => expect(mockBulkConfirm).toHaveBeenCalledTimes(1));
      expect(mockBulkConfirm).toHaveBeenCalledWith(['task-prov-1']);

      await waitFor(() =>
        expect(mockToast.success).toHaveBeenCalledWith('1 tarea(s) confirmada(s) correctamente'),
      );
      await waitFor(() => expect(mockListTasks).toHaveBeenCalledTimes(2));
    });
  });

  describe('manejo de errores', () => {
    it('si confirmReconciliationProvisional falla, muestra toast.error y no rompe el componente', async () => {
      const task = makeProvisionalTask();
      mockListTasks.mockResolvedValueOnce([task]);
      mockConfirmProvisional.mockRejectedValueOnce(new Error('falla de red'));

      renderTab();
      await screen.findByText('Zapatilla Roja Talla 40');

      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: /confirmar como nuevo/i }));

      await waitFor(() =>
        expect(mockToast.error).toHaveBeenCalledWith('No se pudo confirmar el producto'),
      );

      // El componente sigue en pie: el item no desaparece y el botón vuelve a estar habilitado.
      expect(screen.getByText('Zapatilla Roja Talla 40')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /confirmar como nuevo/i })).not.toBeDisabled();
    });
  });

  describe('cola manual', () => {
    it('NO renderiza "Confirmar como nuevo" ni el buscador de variantes para items type: manual, solo Rechazar', async () => {
      mockListTasks.mockResolvedValueOnce([makeManualTask()]);

      renderTab();
      await screen.findByText('Línea de venta sin match');

      expect(
        screen.queryByRole('button', { name: /confirmar como nuevo/i }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: /sí, es la misma → unificar/i }),
      ).not.toBeInTheDocument();
      expect(screen.queryByText(/buscar otra variante/i)).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: /rechazar/i })).toBeInTheDocument();
    });
  });

  describe('clusters de duplicados (FEAT-17 Anexo B: tarjeta rediseñada)', () => {
    it('no muestra ningún alert de "Fusión de duplicados pausada" sobre la sección de clusters', async () => {
      mockListTasks.mockResolvedValueOnce([makeClusterTask()]);

      renderTab();
      await screen.findAllByText('Camiseta Azul M');

      expect(screen.queryByText(/fusión de duplicados pausada/i)).not.toBeInTheDocument();
    });

    it('"Revisar y unificar" está habilitado y el click abre ReconciliationMergeDialog ("Unificar · ...")', async () => {
      mockListTasks.mockResolvedValueOnce([makeClusterTask()]);

      renderTab();
      await screen.findAllByText('Camiseta Azul M');

      const mergeButton = screen.getByRole('button', { name: /revisar y unificar/i });
      expect(mergeButton).not.toBeDisabled();

      const user = userEvent.setup();
      await user.click(mergeButton);

      const mergeDialog = within(await screen.findByRole('alertdialog'));
      expect(await mergeDialog.findByText(/unificar · camiseta azul m/i)).toBeInTheDocument();
    });

    it('no muestra checkbox de selección en las filas de cluster', async () => {
      mockListTasks.mockResolvedValueOnce([makeClusterTask()]);

      renderTab();
      await screen.findAllByText('Camiseta Azul M');

      expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    });

    it('"Son distintos" en un cluster sigue habilitado y abre el diálogo de confirmación, y confirmar sí llama a rejectReconciliationTask', async () => {
      const cluster = makeClusterTask();
      mockListTasks.mockResolvedValueOnce([cluster]);

      renderTab();
      await screen.findAllByText('Camiseta Azul M');

      const rejectButton = screen.getByRole('button', { name: /son distintos/i });
      expect(rejectButton).not.toBeDisabled();

      const user = userEvent.setup();
      await user.click(rejectButton);

      expect(mockReject).not.toHaveBeenCalled();
      const rejectDialog = within(await screen.findByRole('alertdialog'));
      expect(rejectDialog.getByText(/rechazar tarea de reconciliación/i)).toBeInTheDocument();

      await user.click(rejectDialog.getByRole('button', { name: /confirmar rechazo/i }));

      await waitFor(() => expect(mockReject).toHaveBeenCalledWith('task-cluster-1'));
      expect(mockToast.success).toHaveBeenCalledWith('Tarea rechazada');
    });

    describe('franja ámbar "Todas están en {canal}"', () => {
      it('se muestra cuando todas las candidatas del cluster comparten el mismo origen', async () => {
        const sameSourceCluster = makeTask({
          id: 'task-cluster-2',
          type: 'duplicate_cluster',
          confidenceLevel: 0.8,
          items: [
            makeItem({
              variant_id: 'variant-x',
              product_id: 'product-x',
              variant_name: 'Zapatilla Blanca 42',
              sku: 'ZAP-BLA-42',
              source: 'shopify',
              confidence: 0.9,
              is_suggested_winner: true,
            }),
            makeItem({
              variant_id: 'variant-y',
              product_id: 'product-y',
              variant_name: 'Zapatilla Blanca Talla 42',
              sku: 'ZAP-BLA-42-2',
              source: 'shopify',
              confidence: 0.85,
            }),
          ],
        });
        mockListTasks.mockResolvedValueOnce([sameSourceCluster]);

        renderTab();
        await screen.findByText('Zapatilla Blanca Talla 42');

        expect(screen.getByText(/todas están en shopify/i)).toBeInTheDocument();
      });

      it('no aparece si las candidatas tienen distinto origen', async () => {
        // `makeClusterTask()` por defecto trae 'shopify' y 'aliclik'.
        mockListTasks.mockResolvedValueOnce([makeClusterTask()]);

        renderTab();
        await screen.findAllByText('Camiseta Azul M');

        expect(screen.queryByText(/todas están en/i)).not.toBeInTheDocument();
      });
    });
  });
});
