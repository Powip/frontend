/**
 * Tests: AlmacenPage (app/inventario/page.tsx) — FEAT-09
 *
 * Comportamiento verificado:
 * 1. Al hacer click en "Exportar en Excel" se llama a `exportInventoryItems`
 *    (con `inventoryId` y `q` actuales de pantalla) y NO se dispara ninguna
 *    llamada extra a `searchInventoryItems` (el fetch paginado que alimenta
 *    la tabla).
 * 2. Mientras la promesa de `exportInventoryItems` está pendiente, el botón
 *    muestra "Exportando..." y queda deshabilitado; al resolver, vuelve al
 *    estado normal.
 * 3. Si `exportInventoryItems` devuelve más filas que `ITEMS_PER_PAGE`
 *    (25 vs. 10), el Excel se arma con las 25 filas devueltas, no con las 10
 *    que están en pantalla — verificado contando las llamadas a
 *    `worksheet.addRow` sobre un mock de ExcelJS.
 * 4. Si `exportInventoryItems` rechaza la promesa, se muestra un
 *    `toast.error` (mensaje distinto si es timeout de gateway vs. otro
 *    error), el botón vuelve a estar habilitado y la tabla en pantalla no se
 *    rompe (sigue mostrando sus filas).
 * 5. Regresión: la paginación normal de la tabla (`searchInventoryItems` con
 *    `page`/`limit`) sigue funcionando sin cambios.
 *
 * Mocks aplicados:
 * - @/contexts/AuthContext → useAuth
 * - @/services/inventoryItems.service → searchInventoryItems, exportInventoryItems
 * - sonner → toast.success/error/warning
 * - next/navigation → useRouter/usePathname (usados por HeaderConfig y la página)
 * - exceljs → Workbook mínimo en memoria (sin parseo real), expone
 *   `__getAddRowCalls()` para contar cuántas filas arma el export.
 * - window.URL.createObjectURL/revokeObjectURL y HTMLAnchorElement.click →
 *   no implementados en jsdom, se stubean (mismo patrón que
 *   ExcelImportWizard.test.tsx).
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ── Mocks de infraestructura ─────────────────────────────────────────────────

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: jest.fn(),
}));

jest.mock('@/services/inventoryItems.service', () => ({
  searchInventoryItems: jest.fn(),
  exportInventoryItems: jest.fn(),
}));

jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
    warning: jest.fn(),
  },
}));

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  usePathname: () => '/inventario',
}));

/**
 * Mock mínimo de ExcelJS: solo lo que `handleExportExcel` necesita
 * (Workbook.addWorksheet → columns/getRow/addRow, xlsx.writeBuffer). No
 * parsea nada — solo registra las filas agregadas para poder contar cuántas
 * llegaron al Excel final.
 */
jest.mock('exceljs', () => {
  const addRowCalls: unknown[] = [];

  class MockRow {
    font?: unknown;
    alignment?: unknown;
    fill?: unknown;
  }

  class MockWorksheet {
    columns: unknown[] = [];
    private headerRow = new MockRow();

    addRow(data: unknown) {
      addRowCalls.push(data);
      return new MockRow();
    }

    getRow(_rowNumber: number) {
      return this.headerRow;
    }
  }

  class MockWorkbook {
    xlsx = {
      writeBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(8)),
    };

    addWorksheet(_name: string) {
      return new MockWorksheet();
    }
  }

  return {
    Workbook: MockWorkbook,
    __getAddRowCalls: () => addRowCalls,
    __resetAddRowCalls: () => {
      addRowCalls.length = 0;
    },
  };
});

// ── Imports bajo prueba (después de los mocks) ────────────────────────────────

import { useAuth } from '@/contexts/AuthContext';
import {
  searchInventoryItems,
  exportInventoryItems,
} from '@/services/inventoryItems.service';
import { toast } from 'sonner';
import ExcelJS from 'exceljs';
import AlmacenPage from '../page';
import type { InventoryItemForSale } from '@/interfaces/IProduct';

// ── Casts ────────────────────────────────────────────────────────────────────

const mockUseAuth = jest.mocked(useAuth);
const mockSearchInventoryItems = jest.mocked(searchInventoryItems);
const mockExportInventoryItems = jest.mocked(exportInventoryItems);
const mockToast = toast as jest.Mocked<typeof toast>;
const mockExcelJS = ExcelJS as unknown as {
  __getAddRowCalls: () => unknown[];
  __resetAddRowCalls: () => void;
};

// ── Fixtures ─────────────────────────────────────────────────────────────────

const MOCK_AUTH = {
  auth: {
    user: { id: 'user-1', email: 'admin@powip.com', role: 'ADMIN', permissions: [] },
    company: {
      id: 'company-1',
      name: 'Powip Test',
      stores: [{ id: 'store-1', name: 'Tienda Principal' }],
    },
    accessToken: 'fake-token',
    subscription: null,
    exp: 9999999999,
  },
  loading: false,
  login: jest.fn(),
  logout: jest.fn(),
  updateCompany: jest.fn(),
  selectedStoreId: 'store-1',
  setSelectedStore: jest.fn(),
  inventories: [{ id: 'inv-1', name: 'Almacén Principal', storeId: 'store-1' }],
  refreshInventories: jest.fn(),
  hasPermission: jest.fn().mockReturnValue(true),
};

function makeItem(
  id: string,
  name: string,
  overrides: Partial<InventoryItemForSale> = {},
): InventoryItemForSale {
  return {
    inventoryItemId: id,
    variantId: `variant-${id}`,
    productName: name,
    sku: `SKU-${id}`,
    companySku: null,
    price: 100,
    priceBase: 50,
    priceVta: 100,
    availableStock: 10,
    physicalStock: 12,
    reservedStock: 2,
    attributes: {},
    imageUrl: null,
    ...overrides,
  };
}

const DEFAULT_ITEMS = [
  makeItem('item-1', 'Producto Uno'),
  makeItem('item-2', 'Producto Dos'),
];
const DEFAULT_META = { page: 1, limit: 10, total: 2, totalPages: 1 };

function renderPage() {
  return render(<AlmacenPage />);
}

async function waitForInitialLoad() {
  await screen.findByText('Producto Uno');
}

// ── Setup ────────────────────────────────────────────────────────────────────

beforeAll(() => {
  window.URL.createObjectURL = jest.fn(() => 'blob:mock-url');
  window.URL.revokeObjectURL = jest.fn();
  jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
});

beforeEach(() => {
  jest.clearAllMocks();
  mockExcelJS.__resetAddRowCalls();
  mockUseAuth.mockReturnValue(MOCK_AUTH as unknown as ReturnType<typeof useAuth>);
  mockSearchInventoryItems.mockResolvedValue({
    data: DEFAULT_ITEMS,
    meta: DEFAULT_META,
  });
  mockExportInventoryItems.mockResolvedValue(DEFAULT_ITEMS);
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe('AlmacenPage — export a Excel (FEAT-09)', () => {
  describe('llamada al service de export', () => {
    it('al clickear "Exportar en Excel" llama a exportInventoryItems con el inventoryId actual y no dispara un searchInventoryItems adicional', async () => {
      renderPage();
      await waitForInitialLoad();

      const searchCallsBeforeClick = mockSearchInventoryItems.mock.calls.length;

      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: /exportar en excel/i }));

      await waitFor(() => expect(mockExportInventoryItems).toHaveBeenCalledTimes(1));
      expect(mockExportInventoryItems).toHaveBeenCalledWith({
        inventoryId: 'inv-1',
        q: undefined,
      });

      // No se disparó ningún fetch adicional del listado paginado por el export.
      expect(mockSearchInventoryItems.mock.calls.length).toBe(searchCallsBeforeClick);
    });

    it('incluye la búsqueda actual de pantalla como filtro del export', async () => {
      renderPage();
      await waitForInitialLoad();

      const user = userEvent.setup();
      const searchInput = screen.getByPlaceholderText(/buscar por sku, nombre o variante/i);
      await user.type(searchInput, 'zap');

      // Esperamos a que el debounce de búsqueda de la tabla dispare con el
      // texto final, para asegurar que el estado `searchQuery` ya reflejó el
      // valor completo antes de exportar.
      await waitFor(() =>
        expect(mockSearchInventoryItems).toHaveBeenCalledWith(
          expect.objectContaining({ q: 'zap' }),
        ),
      );

      await user.click(screen.getByRole('button', { name: /exportar en excel/i }));

      await waitFor(() =>
        expect(mockExportInventoryItems).toHaveBeenCalledWith({
          inventoryId: 'inv-1',
          q: 'zap',
        }),
      );
    });
  });

  describe('estado de carga del botón', () => {
    it('muestra "Exportando..." y deshabilita el botón mientras exportInventoryItems está pendiente, y lo restaura al resolver', async () => {
      // Promesa con resolución diferida (setTimeout real) para poder
      // observar el estado intermedio de carga antes de que se resuelva.
      mockExportInventoryItems.mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => resolve(DEFAULT_ITEMS), 50);
          }),
      );

      renderPage();
      await waitForInitialLoad();

      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: /exportar en excel/i }));

      const loadingButton = await screen.findByRole('button', { name: /exportando/i });
      expect(loadingButton).toBeDisabled();

      await waitFor(
        () =>
          expect(
            screen.getByRole('button', { name: /exportar en excel/i }),
          ).not.toBeDisabled(),
        { timeout: 2000 },
      );
      expect(screen.queryByText(/exportando\.\.\./i)).not.toBeInTheDocument();
    });
  });

  describe('exporta todas las filas devueltas, no solo la página en pantalla', () => {
    it('arma el Excel con las 25 filas de exportInventoryItems aunque la tabla solo muestre 10 (ITEMS_PER_PAGE)', async () => {
      const pageItems = Array.from({ length: 10 }, (_, i) =>
        makeItem(`page-${i}`, `Producto Página ${i}`),
      );
      mockSearchInventoryItems.mockResolvedValue({
        data: pageItems,
        meta: { page: 1, limit: 10, total: 25, totalPages: 3 },
      });

      const allItems = Array.from({ length: 25 }, (_, i) =>
        makeItem(`all-${i}`, `Producto Completo ${i}`),
      );
      mockExportInventoryItems.mockResolvedValue(allItems);

      renderPage();
      await screen.findByText('Producto Página 0');
      // La tabla en pantalla solo tiene la página actual (10 filas).
      expect(screen.queryByText('Producto Completo 0')).not.toBeInTheDocument();

      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: /exportar en excel/i }));

      await waitFor(() =>
        expect(mockToast.success).toHaveBeenCalledWith('Exportados 25 producto(s)'),
      );

      expect(mockExcelJS.__getAddRowCalls()).toHaveLength(25);
    });
  });

  describe('manejo de errores al exportar', () => {
    it('detecta timeout cuando el gateway devuelve 504 sin código ECONNABORTED (caso real en producción: axiosAuth no configura timeout de cliente)', async () => {
      const gatewayTimeoutError = {
        isAxiosError: true,
        code: undefined,
        response: { status: 504 },
        message: 'Request failed with status code 504',
      };
      mockExportInventoryItems.mockRejectedValue(gatewayTimeoutError);

      renderPage();
      await waitForInitialLoad();

      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: /exportar en excel/i }));

      await waitFor(() =>
        expect(mockToast.error).toHaveBeenCalledWith(
          'La exportación tardó demasiado. Intente nuevamente o aplique un filtro más específico.',
        ),
      );

      expect(screen.getByRole('button', { name: /exportar en excel/i })).not.toBeDisabled();
      // La tabla sigue mostrando sus filas — el error del export no la rompió.
      expect(screen.getByText('Producto Uno')).toBeInTheDocument();
      expect(screen.getByText('Producto Dos')).toBeInTheDocument();
    });

    it('muestra un mensaje de timeout cuando el error es ECONNABORTED (señal secundaria, client-side) y reactiva el botón sin romper la tabla', async () => {
      const timeoutError = {
        isAxiosError: true,
        code: 'ECONNABORTED',
        message: 'timeout of 20000ms exceeded',
      };
      mockExportInventoryItems.mockRejectedValue(timeoutError);

      renderPage();
      await waitForInitialLoad();

      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: /exportar en excel/i }));

      await waitFor(() =>
        expect(mockToast.error).toHaveBeenCalledWith(
          'La exportación tardó demasiado. Intente nuevamente o aplique un filtro más específico.',
        ),
      );

      expect(screen.getByRole('button', { name: /exportar en excel/i })).not.toBeDisabled();
      // La tabla sigue mostrando sus filas — el error del export no la rompió.
      expect(screen.getByText('Producto Uno')).toBeInTheDocument();
      expect(screen.getByText('Producto Dos')).toBeInTheDocument();
    });

    it('muestra un mensaje genérico cuando el error no es timeout y reactiva el botón sin romper la tabla', async () => {
      mockExportInventoryItems.mockRejectedValue(new Error('Network Error'));

      renderPage();
      await waitForInitialLoad();

      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: /exportar en excel/i }));

      await waitFor(() =>
        expect(mockToast.error).toHaveBeenCalledWith(
          'No se pudo exportar el inventario. Intente nuevamente.',
        ),
      );

      expect(screen.getByRole('button', { name: /exportar en excel/i })).not.toBeDisabled();
      expect(screen.getByText('Producto Uno')).toBeInTheDocument();
      expect(screen.getByText('Producto Dos')).toBeInTheDocument();
    });
  });
});

describe('AlmacenPage — regresión: paginación normal de la tabla', () => {
  it('al pasar de página llama a searchInventoryItems con page:2 y actualiza la tabla (sin usar exportInventoryItems)', async () => {
    mockSearchInventoryItems.mockImplementation(async (params) => {
      if (params.page === 2) {
        return {
          data: [makeItem('item-p2', 'Producto Página 2')],
          meta: { page: 2, limit: 10, total: 12, totalPages: 2 },
        };
      }
      return {
        data: [makeItem('item-p1', 'Producto Página 1')],
        meta: { page: 1, limit: 10, total: 12, totalPages: 2 },
      };
    });

    renderPage();
    await screen.findByText('Producto Página 1');

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /siguiente/i }));

    await waitFor(() =>
      expect(mockSearchInventoryItems).toHaveBeenCalledWith(
        expect.objectContaining({ inventoryId: 'inv-1', page: 2, limit: 10 }),
      ),
    );

    expect(await screen.findByText('Producto Página 2')).toBeInTheDocument();
    expect(screen.queryByText('Producto Página 1')).not.toBeInTheDocument();
    expect(mockExportInventoryItems).not.toHaveBeenCalled();
  });
});
