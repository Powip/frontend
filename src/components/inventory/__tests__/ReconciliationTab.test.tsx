/**
 * Tests: ReconciliationTab (FEAT-17 Anexo D — bandeja en tabs paginadas)
 *
 * Comportamiento verificado:
 * 1. Carga y vacío: mientras la página está pendiente no hay contenido; cada
 *    tab tiene su mensaje vacío; con `companyId` undefined no se pide nada.
 * 2. Tabs: 4 tabs en orden con sus contadores (`counts`), arranca en "Por
 *    unificar" página 1; cambiar de tab pide la página 1 de esa tab.
 * 3. Paginación: la página siguiente pide `page: 2`; si la página queda vacía
 *    tras resolver la última tarea vuelve a la anterior; si falla el listado
 *    muestra error con "Reintentar".
 * 4. Aceptación masiva (solo provisionales): "Seleccionar las de esta
 *    página", botón "Aceptar como productos nuevos (N)", la selección se
 *    limpia al cambiar de página, confirmar llama a `bulkConfirm`.
 * 5. Acciones existentes (confirmar como nuevo, vincular, rechazar, unificar,
 *    errores, cola manual, franja ámbar) dentro de su tab.
 *
 * Mocks: service de reconciliación (`listReconciliationTaskPage` + acciones),
 * `getStockByVariants`, sonner. Radix Tabs/AlertDialog/Checkbox sin mockear.
 * `ReconciliationProvisionalCard` usa react-query → `QueryClientProvider`.
 */

import { act, render, screen, waitFor, within } from '@testing-library/react';
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
  listReconciliationTaskPage: jest.fn(),
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

// ── Imports bajo prueba (después de los mocks) ────────────────────────────────

import { toast } from 'sonner';
import {
  listReconciliationTaskPage,
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

const mockListPage = jest.mocked(listReconciliationTaskPage);
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

type TabKey = 'por_unificar' | 'aplicadas' | 'provisionales' | 'cola_manual';

const EMPTY_COUNTS = { por_unificar: 0, aplicadas: 0, provisionales: 0, cola_manual: 0 };

/** Sirve una página por tab (`byTab.provisionales` para esa tab, etc.).
 * Lee `byTab` en cada llamada: mutarlo simula cambios entre recargas. */
function serveTabs(
  byTab: Partial<Record<TabKey, ReconciliationTask[]>>,
  totalPagesByTab: Partial<Record<TabKey, number>> = {},
) {
  mockListPage.mockImplementation(async ({ tab, page }) => {
    const counts = { ...EMPTY_COUNTS };
    (Object.keys(byTab) as TabKey[]).forEach((key) => {
      counts[key] = byTab[key]?.length ?? 0;
    });
    return {
      data: byTab[tab] ?? [],
      meta: {
        page,
        limit: 10,
        total: byTab[tab]?.length ?? 0,
        totalPages: totalPagesByTab[tab] ?? 1,
      },
      counts,
    };
  });
}

async function openTab(name: RegExp) {
  await userEvent.setup().click(await screen.findByRole('tab', { name }));
}

// ── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  mockListPage.mockResolvedValue({
    data: [],
    meta: { page: 1, limit: 10, total: 0, totalPages: 0 },
    counts: EMPTY_COUNTS,
  });
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
  describe('carga y estado vacío', () => {
    it('no muestra contenido ni el vacío mientras la página está pendiente', async () => {
      let resolvePage!: (value: Awaited<ReturnType<typeof listReconciliationTaskPage>>) => void;
      mockListPage.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolvePage = resolve;
          }),
      );

      renderTab();

      expect(screen.queryByText(/no hay posibles duplicados/i)).not.toBeInTheDocument();

      resolvePage({
        data: [makeClusterTask()],
        meta: { page: 1, limit: 10, total: 1, totalPages: 1 },
        counts: { ...EMPTY_COUNTS, por_unificar: 1 },
      });

      expect((await screen.findAllByText('Camiseta Azul M')).length).toBeGreaterThan(0);
    });

    it('cada tab muestra su mensaje vacío', async () => {
      renderTab();
      expect(await screen.findByText(/no hay posibles duplicados para unificar/i)).toBeInTheDocument();
      await openTab(/aplicadas/i);
      expect(await screen.findByText(/todavía no hay reconciliaciones aplicadas/i)).toBeInTheDocument();
      await openTab(/provisionales pendientes/i);
      expect(await screen.findByText(/no hay provisionales pendientes/i)).toBeInTheDocument();
      await openTab(/cola manual/i);
      expect(await screen.findByText(/no hay líneas de venta sin resolver/i)).toBeInTheDocument();
    });

    it('con companyId undefined no pide nada, no muestra skeleton y muestra el vacío', () => {
      const Wrapper = buildWrapper();
      const { container } = render(
        <Wrapper>
          <ReconciliationTab companyId={undefined} />
        </Wrapper>,
      );

      expect(mockListPage).not.toHaveBeenCalled();
      expect(screen.getByText(/no hay posibles duplicados para unificar/i)).toBeInTheDocument();
      expect(container.querySelector('.animate-pulse')).not.toBeInTheDocument();
    });
  });

  describe('tabs y paginación (FEAT-17 Anexo D)', () => {
    it('muestra las 4 tabs en orden con sus contadores y arranca en "Por unificar" página 1', async () => {
      serveTabs({
        por_unificar: [makeClusterTask()],
        provisionales: [makeProvisionalTask(), makeProvisionalTask({ id: 'task-prov-2' })],
      });
      renderTab();
      await waitFor(() =>
        expect(mockListPage).toHaveBeenCalledWith({ tab: 'por_unificar', page: 1, limit: 10 }),
      );
      await screen.findAllByText('Camiseta Azul M');
      const tabs = screen.getAllByRole('tab');
      expect(tabs.map((t) => t.textContent)).toEqual([
        'Por unificar1',
        'Aplicadas0',
        'Provisionales pendientes2',
        'Cola manual0',
      ]);
    });

    it('cambiar de tab pide la página 1 de esa tab', async () => {
      serveTabs({ provisionales: [makeProvisionalTask()] }, { provisionales: 3 });
      renderTab();
      await openTab(/provisionales pendientes/i);
      await waitFor(() =>
        expect(mockListPage).toHaveBeenLastCalledWith({ tab: 'provisionales', page: 1, limit: 10 }),
      );
    });

    it('la paginación pide la página siguiente y al cambiar de tab vuelve a la 1', async () => {
      serveTabs({ provisionales: [makeProvisionalTask()] }, { provisionales: 3 });
      renderTab();
      await openTab(/provisionales pendientes/i);
      await screen.findByText('Zapatilla Roja Talla 40');
      await userEvent.setup().click(screen.getByRole('button', { name: '2' }));
      await waitFor(() =>
        expect(mockListPage).toHaveBeenLastCalledWith({ tab: 'provisionales', page: 2, limit: 10 }),
      );
      await openTab(/aplicadas/i);
      await waitFor(() =>
        expect(mockListPage).toHaveBeenLastCalledWith({ tab: 'aplicadas', page: 1, limit: 10 }),
      );
    });

    it('si la página quedó vacía (resolví la última), vuelve a la anterior', async () => {
      let pageTwoEmptied = false;
      mockListPage.mockImplementation(async ({ tab, page }) => {
        const data =
          tab === 'provisionales' && !(page === 2 && pageTwoEmptied)
            ? [makeProvisionalTask({ id: `p-${page}` })]
            : [];
        return {
          data,
          meta: { page, limit: 10, total: 11, totalPages: 2 },
          counts: { ...EMPTY_COUNTS, provisionales: 11 },
        };
      });
      mockConfirmProvisional.mockImplementation(async () => {
        pageTwoEmptied = true;
        return DEFAULT_TASK_RESPONSE;
      });

      renderTab();
      await openTab(/provisionales pendientes/i);
      await userEvent.setup().click(await screen.findByRole('button', { name: '2' }));
      await waitFor(() =>
        expect(mockListPage).toHaveBeenLastCalledWith({ tab: 'provisionales', page: 2, limit: 10 }),
      );
      await userEvent.setup().click(await screen.findByRole('button', { name: /confirmar como nuevo/i }));
      await waitFor(() =>
        expect(mockListPage).toHaveBeenLastCalledWith({ tab: 'provisionales', page: 1, limit: 10 }),
      );
      expect(await screen.findByText('Zapatilla Roja Talla 40')).toBeInTheDocument();
    });

    it('si falla el listado muestra error con Reintentar y las tabs siguen navegables', async () => {
      mockListPage.mockRejectedValueOnce(new Error('boom'));
      renderTab();
      expect(await screen.findByText(/no se pudieron cargar las tareas/i)).toBeInTheDocument();
      expect(mockToast.error).toHaveBeenCalledWith('Error al cargar las tareas de reconciliación');
      await userEvent.setup().click(screen.getByRole('button', { name: /reintentar/i }));
      await waitFor(() => expect(mockListPage).toHaveBeenCalledTimes(2));
      await openTab(/cola manual/i);
      await waitFor(() =>
        expect(mockListPage).toHaveBeenLastCalledWith({ tab: 'cola_manual', page: 1, limit: 10 }),
      );
    });
  });

  describe('respuestas fuera de orden (revisión final Anexo D)', () => {
    it('una respuesta vieja de otra tab no pisa la tab activa', async () => {
      type Page = Awaited<ReturnType<typeof listReconciliationTaskPage>>;
      const pending: Record<string, (value: Page) => void> = {};
      mockListPage.mockImplementation(
        ({ tab }) =>
          new Promise<Page>((resolve) => {
            pending[tab] = resolve;
          }),
      );
      const pageOf = (data: ReconciliationTask[]): Page => ({
        data,
        meta: { page: 1, limit: 10, total: data.length, totalPages: 1 },
        counts: EMPTY_COUNTS,
      });

      renderTab();
      await openTab(/aplicadas/i);
      await waitFor(() => expect(pending.aplicadas).toBeDefined());

      // Llega primero la tab activa y después la vieja (por_unificar).
      pending.aplicadas(pageOf([]));
      expect(await screen.findByText(/todavía no hay reconciliaciones aplicadas/i)).toBeInTheDocument();
      await act(async () => {
        pending.por_unificar(pageOf([makeClusterTask()]));
      });
      expect(screen.queryByText(/camiseta azul/i)).not.toBeInTheDocument();
      expect(screen.getByText(/todavía no hay reconciliaciones aplicadas/i)).toBeInTheDocument();
    });
  });

  describe('aceptación masiva (FEAT-17 Anexo D)', () => {
    it('"Seleccionar las de esta página" marca todas y el botón muestra N', async () => {
      serveTabs({ provisionales: [makeProvisionalTask(), makeProvisionalTask({ id: 'task-prov-2' })] });
      renderTab();
      await openTab(/provisionales pendientes/i);
      await userEvent
        .setup()
        .click(await screen.findByRole('checkbox', { name: /seleccionar las de esta página/i }));
      expect(screen.getByRole('button', { name: /aceptar como productos nuevos \(2\)/i })).toBeEnabled();
    });

    it('cambiar de página limpia la selección', async () => {
      serveTabs({ provisionales: [makeProvisionalTask()] }, { provisionales: 2 });
      renderTab();
      await openTab(/provisionales pendientes/i);
      const user = userEvent.setup();
      await user.click(await screen.findByRole('checkbox', { name: /seleccionar las de esta página/i }));
      expect(screen.getByRole('button', { name: /aceptar como productos nuevos \(1\)/i })).toBeEnabled();
      await user.click(screen.getByRole('button', { name: '2' }));
      expect(
        await screen.findByRole('button', { name: /aceptar como productos nuevos \(0\)/i }),
      ).toBeDisabled();
    });

    it('confirmar en lote llama a bulkConfirm con lo seleccionado y recarga', async () => {
      const byTab = { provisionales: [makeProvisionalTask()], por_unificar: [makeClusterTask()] };
      serveTabs(byTab);
      const bulkResults: BulkConfirmResultItem[] = [{ task_id: 'task-prov-1', status: 'confirmed' }];
      mockBulkConfirm.mockImplementationOnce(async () => {
        byTab.provisionales = [];
        return bulkResults;
      });

      renderTab();
      await openTab(/provisionales pendientes/i);
      await screen.findByText('Zapatilla Roja Talla 40');

      const user = userEvent.setup();
      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes).toHaveLength(2);
      await user.click(checkboxes[1]);
      await user.click(screen.getByRole('button', { name: /aceptar como productos nuevos \(1\)/i }));

      const dialog = within(await screen.findByRole('alertdialog'));
      expect(dialog.getByText(/aceptar 1 producto\(s\) como nuevos/i)).toBeInTheDocument();
      expect(
        dialog.getByText(/los provisionales seleccionados se confirmarán como productos nuevos\. esta acción no se puede deshacer\./i),
      ).toBeInTheDocument();
      await user.click(dialog.getByRole('button', { name: /aceptar en lote/i }));

      await waitFor(() => expect(mockBulkConfirm).toHaveBeenCalledWith(['task-prov-1']));
      await waitFor(() =>
        expect(mockToast.success).toHaveBeenCalledWith('1 tarea(s) confirmada(s) correctamente'),
      );
      expect(await screen.findByText(/no hay provisionales pendientes/i)).toBeInTheDocument();
    });

    it('no muestra barra masiva ni checkboxes fuera de provisionales', async () => {
      serveTabs({ por_unificar: [makeClusterTask()] });
      renderTab();
      await screen.findAllByText('Camiseta Azul M');
      expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    });
  });

  describe('aplicadas', () => {
    it('la tab Aplicadas muestra la lista de solo lectura', async () => {
      serveTabs({
        aplicadas: [
          makeClusterTask({ id: 'task-ap', status: 'confirmed', resolvedAt: '2026-10-09T15:00:00Z' }),
        ],
      });
      renderTab();
      await openTab(/aplicadas/i);
      expect(await screen.findByText('Unificación')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /revisar y unificar/i })).not.toBeInTheDocument();
    });
  });

  describe('acciones sobre provisionales', () => {
    it('"Confirmar como nuevo" llama a confirmReconciliationProvisional y recarga', async () => {
      const byTab: Partial<Record<TabKey, ReconciliationTask[]>> = {
        provisionales: [makeProvisionalTask()],
      };
      serveTabs(byTab);
      mockConfirmProvisional.mockImplementationOnce(async () => {
        byTab.provisionales = [];
        return DEFAULT_TASK_RESPONSE;
      });

      renderTab();
      await openTab(/provisionales pendientes/i);
      await screen.findByText('Zapatilla Roja Talla 40');

      await userEvent.setup().click(screen.getByRole('button', { name: /confirmar como nuevo/i }));

      await waitFor(() => expect(mockConfirmProvisional).toHaveBeenCalledWith('task-prov-1'));
      expect(mockToast.success).toHaveBeenCalledWith('Producto confirmado como nuevo');
      expect(await screen.findByText(/no hay provisionales pendientes/i)).toBeInTheDocument();
    });

    it('"Sí, es la misma → unificar" abre ReconciliationLinkDialog y confirmar llama a resolveReconciliationLink', async () => {
      serveTabs({ provisionales: [makeProvisionalTaskWithSuggestion()] });

      renderTab();
      await openTab(/provisionales pendientes/i);
      await screen.findByText('Zapatilla Roja Talla 40');

      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: /sí, es la misma → unificar/i }));

      expect(mockResolveLink).not.toHaveBeenCalled();
      const linkDialog = within(await screen.findByRole('alertdialog'));
      expect(linkDialog.getByText(/vincular a variante existente/i)).toBeInTheDocument();
      expect(linkDialog.getByText('Zapatilla Roja Talla 40 (Powip)')).toBeInTheDocument();

      await user.click(linkDialog.getByRole('button', { name: /confirmar vinculación/i }));

      await waitFor(() =>
        expect(mockResolveLink).toHaveBeenCalledWith('task-prov-1', 'variant-sugerida-1'),
      );
      expect(mockToast.success).toHaveBeenCalledWith('Variante vinculada correctamente');
    });

    it('"Rechazar" abre el diálogo y confirmar llama a rejectReconciliationTask', async () => {
      serveTabs({ provisionales: [makeProvisionalTask()] });

      renderTab();
      await openTab(/provisionales pendientes/i);
      await screen.findByText('Zapatilla Roja Talla 40');

      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: /rechazar/i }));

      expect(mockReject).not.toHaveBeenCalled();
      const rejectDialog = within(await screen.findByRole('alertdialog'));
      expect(rejectDialog.getByText(/rechazar tarea de reconciliación/i)).toBeInTheDocument();

      await user.click(rejectDialog.getByRole('button', { name: /confirmar rechazo/i }));

      await waitFor(() => expect(mockReject).toHaveBeenCalledWith('task-prov-1'));
      expect(mockToast.success).toHaveBeenCalledWith('Tarea rechazada');
    });

    it('si confirmReconciliationProvisional falla, muestra toast.error y no rompe el componente', async () => {
      serveTabs({ provisionales: [makeProvisionalTask()] });
      mockConfirmProvisional.mockRejectedValueOnce(new Error('falla de red'));

      renderTab();
      await openTab(/provisionales pendientes/i);
      await screen.findByText('Zapatilla Roja Talla 40');

      await userEvent.setup().click(screen.getByRole('button', { name: /confirmar como nuevo/i }));

      await waitFor(() =>
        expect(mockToast.error).toHaveBeenCalledWith('No se pudo confirmar el producto'),
      );
      expect(screen.getByText('Zapatilla Roja Talla 40')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /confirmar como nuevo/i })).not.toBeDisabled();
    });
  });

  describe('cola manual', () => {
    it('solo ofrece Rechazar, sin confirmar ni buscador', async () => {
      serveTabs({ cola_manual: [makeManualTask()] });

      renderTab();
      await openTab(/cola manual/i);
      await screen.findByText('Línea de venta sin match');

      expect(screen.queryByRole('button', { name: /confirmar como nuevo/i })).not.toBeInTheDocument();
      expect(screen.queryByText(/buscar otra variante/i)).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: /rechazar/i })).toBeInTheDocument();
    });
  });

  describe('por unificar (clusters)', () => {
    it('"Revisar y unificar" abre ReconciliationMergeDialog', async () => {
      serveTabs({ por_unificar: [makeClusterTask()] });

      renderTab();
      await screen.findAllByText('Camiseta Azul M');

      const mergeButton = screen.getByRole('button', { name: /revisar y unificar/i });
      expect(mergeButton).not.toBeDisabled();
      await userEvent.setup().click(mergeButton);

      const mergeDialog = within(await screen.findByRole('alertdialog'));
      expect(await mergeDialog.findByText(/unificar · camiseta azul m/i)).toBeInTheDocument();
    });

    it('"Son distintos" abre el diálogo y confirmar llama a rejectReconciliationTask', async () => {
      serveTabs({ por_unificar: [makeClusterTask()] });

      renderTab();
      await screen.findAllByText('Camiseta Azul M');

      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: /son distintos/i }));

      expect(mockReject).not.toHaveBeenCalled();
      const rejectDialog = within(await screen.findByRole('alertdialog'));
      await user.click(rejectDialog.getByRole('button', { name: /confirmar rechazo/i }));

      await waitFor(() => expect(mockReject).toHaveBeenCalledWith('task-cluster-1'));
      expect(mockToast.success).toHaveBeenCalledWith('Tarea rechazada');
    });
  });
});
