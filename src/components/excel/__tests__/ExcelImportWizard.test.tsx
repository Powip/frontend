/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Tests: ExcelImportWizard
 *
 * Comportamiento verificado (FEAT-06):
 * 1. Parseo por header: al subir un archivo cuyas columnas vienen en un orden
 *    distinto al de la plantilla generada y con una columna extra intercalada
 *    (no reconocida), las filas se parsean igual — el valor de "Nombre" y
 *    "SKU Empresa" se lee de la columna correcta por su texto de header, no
 *    por posición fija.
 * 2. Plantilla generada: al descargar la plantilla base, se agrega una hoja
 *    "Categorías Válidas" con los datos obtenidos de un único
 *    `GET {NEXT_PUBLIC_API_PRODUCTOS}/subcategories` (columnas Categoría /
 *    Subcategoría, una fila por combinación real).
 * 3. `handleSave` arma el payload con `quantity`/`min_stock` reales tomados
 *    de las celdas parseadas (no hardcodeados a 0), incluso con columnas
 *    reordenadas en el archivo de origen.
 * 4. Archivo sin una columna obligatoria (falta "Nombre *"): se muestra un
 *    toast de error nombrando la columna faltante, el wizard se queda en el
 *    Paso 2 (no avanza a la vista previa) y no se dispara el pre-fetch de
 *    subcategorías por fila (no llega a parsear filas).
 * 5. Infra: axios y `process.env.NEXT_PUBLIC_API_PRODUCTOS` están
 *    completamente mockeados — ningún test dispara una llamada HTTP real.
 *
 * Nota sobre el flujo de "doble subida" (tests 3): `handleFileChange` resuelve
 * `subcategoryId` leyendo el estado `allSubcategories` capturado en el
 * closure del render en curso, mientras que el `fetch` que lo llena
 * (`fetchSubcategoriesForCategory`) actualiza ese estado de forma asíncrona
 * vía `setState` — por lo tanto la PRIMERA subida de una categoría nueva en
 * la sesión siempre deja la fila con error "Subcategoría no encontrada" aun
 * cuando el nombre matchea, y recién la subida siguiente (con el estado ya
 * cacheado en un render posterior) resuelve la fila sin error. Esto es
 * comportamiento real y preexistente del componente (no introducido por
 * FEAT-06 y fuera de su alcance corregirlo) — el test que necesita una fila
 * válida para llegar a `handleSave` (test 3) sube el mismo archivo dos veces
 * para reflejar ese comportamiento real, en vez de forzar un estado
 * artificial.
 *
 * Work-arounds jsdom / mocks aplicados:
 * - sonner → mock de toast.success/error/warning.
 * - @/contexts/AuthContext → useAuth mockeado.
 * - next/navigation → mock defensivo (HeaderConfig usa usePathname/useRouter).
 * - @/components/ui/select → mock de <select> nativo (mismo patrón que
 *   SendToEvaGuideModal.test.tsx) — evita los requisitos de jsdom de Radix
 *   Select (ResizeObserver / pointer capture); no se interactúa con ningún
 *   select en estos tests (el almacén se auto-selecciona con un solo
 *   inventario).
 * - exceljs → mock completo en memoria: `Workbook`/`Worksheet`/`Row` con
 *   `columns`, `addRow`, `getRow`, `eachRow`, `eachCell`, `xlsx.writeBuffer`
 *   y `xlsx.load`. `xlsx.load` no parsea binario real: consume un fixture
 *   `{ headers, rows }` cargado por el test vía el helper
 *   `__setParseFixture` (expuesto por el propio mock) antes de disparar el
 *   `change` del input de archivo. `__getLastWorkbook` permite inspeccionar
 *   el workbook armado por `handleDownloadTemplate` (hoja "Categorías
 *   Válidas").
 * - window.URL.createObjectURL/revokeObjectURL y
 *   HTMLAnchorElement.prototype.click → mockeados (no implementados en
 *   jsdom / no queremos navegación real al descargar la plantilla).
 */

import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ── Mocks de infraestructura ─────────────────────────────────────────────────

jest.mock('@/hooks/useBusinessInventories', () => ({ useBusinessInventories: () => {
  const { inventories } = require('@/contexts/AuthContext').useAuth();
  return { inventories, isPending: false, isError: false, refetch: jest.fn() };
} }));
jest.mock('@/lib/axiosAuth', () => ({ __esModule: true, default: require('axios') }));

jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
    warning: jest.fn(),
  },
}));

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: jest.fn(),
}));

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  usePathname: () => '/inventario',
}));

jest.mock('axios', () => ({
  default: {
    get: jest.fn(),
    post: jest.fn(),
    defaults: { withCredentials: false },
    isAxiosError: jest.fn(),
  },
  get: jest.fn(),
  post: jest.fn(),
  defaults: { withCredentials: false },
  isAxiosError: jest.fn(),
}));

/**
 * Mock de Radix Select → <select> nativo. Idéntico al usado en
 * SendToEvaGuideModal.test.tsx / SendToEvaModal.test.tsx. No se interactúa
 * con ningún select en estos tests, pero se mockea igual para evitar que
 * Radix Select dispare APIs de browser no implementadas en jsdom (aunque
 * esté cerrado).
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

/**
 * Mock completo de ExcelJS: workbook/worksheet/row en memoria, sin parseo de
 * binario real. Ver comentario de cabecera del archivo para el detalle del
 * mecanismo de fixture de lectura (`__setParseFixture`).
 */
jest.mock('exceljs', () => {
  type CellValue = string | number | undefined;

  class MockRow {
    private cells: Record<number, CellValue>;
    font?: unknown;
    fill?: unknown;
    alignment?: unknown;

    constructor(cells: Record<number, CellValue> = {}) {
      this.cells = cells;
    }

    getCell(colIndex: number) {
      return { value: this.cells[colIndex] };
    }

    eachCell(
      optionsOrCb: unknown,
      maybeCb?: (cell: { value: CellValue }, colNumber: number) => void,
    ) {
      const cb =
        typeof optionsOrCb === 'function'
          ? (optionsOrCb as (cell: { value: CellValue }, colNumber: number) => void)
          : maybeCb;
      if (!cb) return;
      Object.keys(this.cells).forEach((key) => {
        const colIndex = Number(key);
        cb({ value: this.cells[colIndex] }, colIndex);
      });
    }
  }

  interface ColumnDef {
    header: string;
    key: string;
    width?: number;
  }

  class MockWorksheet {
    name: string;
    state?: string;
    private _columns: ColumnDef[] = [];
    private _rows: MockRow[] = [];

    constructor(name: string) {
      this.name = name;
    }

    set columns(cols: ColumnDef[]) {
      this._columns = cols;
      const headerCells: Record<number, CellValue> = {};
      cols.forEach((c, i) => {
        headerCells[i + 1] = c.header;
      });
      this._rows[0] = new MockRow(headerCells);
    }
    get columns() {
      return this._columns;
    }

    private _colDefs: Record<number, { width?: number }> = {};
    getColumn(index: number) {
      return (this._colDefs[index] ??= {});
    }

    addRow(data: unknown) {
      const cells: Record<number, CellValue> = {};
      if (Array.isArray(data)) {
        data.forEach((v, i) => {
          cells[i + 1] = v as CellValue;
        });
      } else if (data && typeof data === 'object') {
        this._columns.forEach((c, i) => {
          cells[i + 1] = (data as Record<string, CellValue>)[c.key];
        });
      }
      const row = new MockRow(cells);
      this._rows.push(row);
      return row;
    }

    getRow(rowNumber: number) {
      const idx = rowNumber - 1;
      if (!this._rows[idx]) this._rows[idx] = new MockRow({});
      return this._rows[idx];
    }

    eachRow(cb: (row: MockRow, rowNumber: number) => void) {
      this._rows.forEach((row, i) => {
        if (row) cb(row, i + 1);
      });
    }

    /** Solo para uso del mock de xlsx.load — carga headers + filas de datos. */
    __loadFixtureRows(headers: string[], rows: CellValue[][]) {
      const headerCells: Record<number, CellValue> = {};
      headers.forEach((h, i) => {
        headerCells[i + 1] = h;
      });
      this._rows[0] = new MockRow(headerCells);
      rows.forEach((rowValues) => {
        const cells: Record<number, CellValue> = {};
        rowValues.forEach((v, i) => {
          cells[i + 1] = v;
        });
        this._rows.push(new MockRow(cells));
      });
    }
  }

  interface ParseFixture {
    headers: string[];
    rows: CellValue[][];
  }

  let nextParseFixture: ParseFixture | null = null;
  const createdWorkbooks: MockWorkbook[] = [];

  class MockWorkbook {
    worksheets: MockWorksheet[] = [];
    xlsx: { writeBuffer: jest.Mock; load: jest.Mock };
    private _byName: Record<string, MockWorksheet> = {};

    constructor() {
      createdWorkbooks.push(this);
      this.xlsx = {
        writeBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(8)),
        load: jest.fn(async () => {
          if (!nextParseFixture) return;
          const sheet = this.addWorksheet('Productos');
          sheet.__loadFixtureRows(nextParseFixture.headers, nextParseFixture.rows);
        }),
      };
    }

    addWorksheet(name: string) {
      const ws = new MockWorksheet(name);
      this.worksheets.push(ws);
      this._byName[name] = ws;
      return ws;
    }

    getWorksheet(name: string) {
      return this._byName[name];
    }
  }

  return {
    Workbook: MockWorkbook,
    __setParseFixture: (fixture: ParseFixture | null) => {
      nextParseFixture = fixture;
    },
    __getLastWorkbook: () => createdWorkbooks[createdWorkbooks.length - 1],
    __reset: () => {
      nextParseFixture = null;
      createdWorkbooks.length = 0;
    },
  };
});

// ── Imports bajo prueba (después de los mocks) ────────────────────────────────

import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import axios from 'axios';
import ExcelJS from 'exceljs';
import ExcelImportWizard from '../ExcelImportWizard';

// ── Casts ────────────────────────────────────────────────────────────────────

const mockToast = toast as jest.Mocked<typeof toast>;
const mockUseAuth = jest.mocked(useAuth);
const mockAxiosGet = jest.mocked(axios.get);
const mockAxiosPost = jest.mocked(axios.post);

type ParseFixture = { headers: string[]; rows: (string | number)[][] };
interface MockWorksheetLike {
  getRow: (rowNumber: number) => { getCell: (colIndex: number) => { value: unknown } };
}
interface MockWorkbookLike {
  getWorksheet: (name: string) => MockWorksheetLike | undefined;
}
const mockExcelJS = ExcelJS as unknown as {
  __setParseFixture: (fixture: ParseFixture | null) => void;
  __getLastWorkbook: () => MockWorkbookLike;
  __reset: () => void;
};

// ── Fixtures ─────────────────────────────────────────────────────────────────

const API_BASE = 'http://localhost:9999/api/productos';

const MOCK_AUTH = {
  auth: {
    user: { id: 'user-1', email: 'test@powip.com', role: 'ADMIN', permissions: [] },
    company: { id: 'company-1', name: 'Powip Test', stores: [] },
    accessToken: 'fake-token',
    subscription: null,
    exp: 9999999999,
  },
  loading: false,
  login: jest.fn(),
  logout: jest.fn(),
  updateCompany: jest.fn(),
  selectedStoreId: null,
  setSelectedStore: jest.fn(),
  inventories: [{ id: 'inv-1', name: 'Almacén Principal', storeId: 'store-1' }],
  refreshInventories: jest.fn(),
  hasPermission: jest.fn().mockReturnValue(true),
};

/** Rutea las respuestas de axios.get según el sufijo de la URL — sin red real. */
function mockAxiosGetImplementation(overrides: {
  categories?: unknown[];
  allSubcategories?: unknown[];
  subcategoriesByCategory?: Record<string, unknown[]>;
}) {
  mockAxiosGet.mockImplementation((url: string) => {
    if (url.endsWith('/categories')) {
      return Promise.resolve({ data: overrides.categories ?? [] });
    }
    if (url.endsWith('/subcategories')) {
      return Promise.resolve({ data: overrides.allSubcategories ?? [] });
    }
    const catMatch = url.match(/\/subcategories\/category\/(.+)$/);
    if (catMatch) {
      return Promise.resolve({
        data: overrides.subcategoriesByCategory?.[catMatch[1]] ?? [],
      });
    }
    return Promise.resolve({ data: [] });
  });
}

function renderWizard(onBack = jest.fn()) {
  render(<ExcelImportWizard onBack={onBack} />);
  return { onBack };
}

function getFileInput(): HTMLInputElement {
  return screen.getByLabelText(/haz clic para seleccionar/i) as HTMLInputElement;
}

function buildExcelFile(name = 'productos.xlsx'): File {
  const file = new File(['dummy-binary-content'], name, {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  // jsdom no implementa (o implementa incompleto) File.prototype.arrayBuffer;
  // handleFileChange lo necesita para leer el archivo. El contenido no
  // importa: el mock de exceljs (xlsx.load) ignora el buffer real y usa el
  // fixture cargado vía __setParseFixture.
  Object.defineProperty(file, 'arrayBuffer', {
    value: async () => new ArrayBuffer(8),
    configurable: true,
  });
  return file;
}

async function goToStep2() {
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: /ya tengo mi archivo/i }));
  return user;
}

// ── Setup ────────────────────────────────────────────────────────────────────

beforeAll(() => {
  process.env.NEXT_PUBLIC_API_PRODUCTOS = API_BASE;
  window.URL.createObjectURL = jest.fn(() => 'blob:mock-url');
  window.URL.revokeObjectURL = jest.fn();
  jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
});

beforeEach(() => {
  jest.clearAllMocks();
  mockExcelJS.__reset();
  mockUseAuth.mockReturnValue(MOCK_AUTH as unknown as ReturnType<typeof useAuth>);
  mockAxiosGetImplementation({ categories: [] });
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe('ExcelImportWizard', () => {
  describe('parseo por header (orden distinto + columna extra intercalada)', () => {
    it('lee Nombre y SKU Empresa por el texto de header aunque las columnas estén reordenadas y haya una columna no reconocida', async () => {
      renderWizard();
      await goToStep2();

      const HEADERS = [
        'Nombre *',
        'Proveedor', // columna extra, no reconocida — debe ignorarse sin romper el resto
        'Precio Venta *',
        'Categoría *',
        'Cantidad *',
        'Subcategoría *',
        'Precio Compra *',
        'Stock Mínimo',
        'SKU Empresa',
      ];
      const ROW: (string | number)[] = [
        'Zapatillas Urbanas',
        'ACME',
        8900,
        'Calzado',
        15,
        'Zapatillas',
        3500,
        3,
        'SKU-042',
      ];
      mockExcelJS.__setParseFixture({ headers: HEADERS, rows: [ROW] });

      const user = userEvent.setup();
      await user.upload(getFileInput(), buildExcelFile());

      await waitFor(() =>
        expect(mockToast.success).toHaveBeenCalledWith('Se encontraron 1 filas'),
      );

      expect(await screen.findByText('Zapatillas Urbanas')).toBeInTheDocument();
      expect(screen.getByText('SKU-042')).toBeInTheDocument();
    });
  });

  describe('plantilla generada — hoja "Categorías Válidas"', () => {
    it('incluye una hoja "Categorías Válidas" con los datos del fetch a /subcategories', async () => {
      const SUBCATEGORIES_VALIDAS = [
        { id: 'sub-1', name: 'Camperas', category: { id: 'cat-1', name: 'Vestimenta' } },
        { id: 'sub-2', name: 'Zapatillas', category: { id: 'cat-2', name: 'Calzado' } },
      ];
      mockAxiosGetImplementation({ categories: [], allSubcategories: SUBCATEGORIES_VALIDAS });

      renderWizard();

      const user = userEvent.setup();
      await user.click(
        await screen.findByRole('button', { name: /descargar plantilla base de ejemplo/i }),
      );

      await waitFor(() =>
        expect(mockToast.success).toHaveBeenCalledWith('Plantilla descargada correctamente'),
      );
      expect(mockAxiosGet).toHaveBeenCalledWith(expect.stringContaining('/subcategories'));

      const workbook = mockExcelJS.__getLastWorkbook();
      const sheet = workbook.getWorksheet('Categorías Válidas');
      expect(sheet).toBeDefined();

      expect(sheet!.getRow(1).getCell(1).value).toBe('Categoría');
      expect(sheet!.getRow(1).getCell(2).value).toBe('Subcategoría');
      expect(sheet!.getRow(2).getCell(1).value).toBe('Vestimenta');
      expect(sheet!.getRow(2).getCell(2).value).toBe('Camperas');
      expect(sheet!.getRow(3).getCell(1).value).toBe('Calzado');
      expect(sheet!.getRow(3).getCell(2).value).toBe('Zapatillas');

      // La hoja de productos incluye Cantidad y Stock Mínimo (B3: tras Talla, Color y Otros atributos).
      const productSheet = workbook.getWorksheet('Productos');
      expect(productSheet).toBeDefined();
      expect(productSheet!.getRow(1).getCell(11).value).toBe('Cantidad *');
      expect(productSheet!.getRow(1).getCell(12).value).toBe('Stock Mínimo');
    });

    it('si falla el fetch de /subcategories, igual descarga la plantilla sin la hoja de referencia', async () => {
      mockAxiosGet.mockImplementation((url: string) => {
        if (url.endsWith('/categories')) return Promise.resolve({ data: [] });
        if (url.endsWith('/subcategories')) return Promise.reject(new Error('network error'));
        return Promise.resolve({ data: [] });
      });

      renderWizard();

      const user = userEvent.setup();
      await user.click(
        await screen.findByRole('button', { name: /descargar plantilla base de ejemplo/i }),
      );

      await waitFor(() =>
        expect(mockToast.success).toHaveBeenCalledWith('Plantilla descargada correctamente'),
      );

      const workbook = mockExcelJS.__getLastWorkbook();
      expect(workbook.getWorksheet('Categorías Válidas')).toBeUndefined();
      expect(workbook.getWorksheet('Productos')).toBeDefined();
    });
  });

  describe('handleSave — payload con quantity/min_stock reales', () => {
    it('envía quantity/min_stock parseados de las celdas (no 0 fijo) aunque las columnas estén reordenadas', async () => {
      const CATEGORIES = [{ id: 'cat-1', name: 'Vestimenta' }];
      const SUBCATS_CAT1 = [{ id: 'sub-1', name: 'Camperas' }];
      mockAxiosGetImplementation({
        categories: CATEGORIES,
        subcategoriesByCategory: { 'cat-1': SUBCATS_CAT1 },
      });
      mockAxiosPost.mockResolvedValue({
        data: { created: 1, errors: 0, message: 'Importación completada: 1 productos creados' },
      });

      const HEADERS = [
        'Cantidad *',
        'Nombre *',
        'Categoría *',
        'Precio Compra *',
        'Subcategoría *',
        'Precio Venta *',
        'Stock Mínimo',
      ];
      const ROW: (string | number)[] = [25, 'Campera Urbana', 'Vestimenta', 4000, 'Camperas', 9500, 4];

      const { onBack } = renderWizard();
      await goToStep2();

      // 1ra subida: deja la fila con error por el timing de allSubcategories
      // (ver nota de cabecera) pero puebla la caché de subcategorías.
      mockExcelJS.__setParseFixture({ headers: HEADERS, rows: [ROW] });
      const user = userEvent.setup();
      await user.upload(getFileInput(), buildExcelFile());
      await screen.findByRole('heading', { name: /vista previa y edición/i });

      // Volvemos al Paso 2 y subimos el mismo archivo de nuevo — ahora la
      // caché de subcategorías ya está poblada y la fila queda sin error.
      await user.click(screen.getByRole('button', { name: /cambiar archivo/i }));
      mockExcelJS.__setParseFixture({ headers: HEADERS, rows: [ROW] });
      await user.upload(getFileInput(), buildExcelFile());

      const saveButton = await screen.findByRole('button', { name: /importar \d+ productos/i });
      expect(saveButton).not.toBeDisabled();
      await user.click(saveButton);

      await waitFor(() => expect(mockAxiosPost).toHaveBeenCalledTimes(1));
      expect(mockAxiosPost).toHaveBeenCalledWith(
        expect.stringContaining('/products/bulk-import'),
        expect.objectContaining({
          tenantId: 'company-1',
          inventoryId: 'inv-1',
          rows: [
            expect.objectContaining({
              name: 'Campera Urbana',
              quantity: 25,
              min_stock: 4,
              priceBase: 4000,
              priceVta: 9500,
              subcategoryId: 'sub-1',
            }),
          ],
        }),
      );

      await waitFor(() => expect(onBack).toHaveBeenCalled());
    });
  });

  // FEAT-24 H0 (F1): mismo máximo que ms-logistics y confirmación sobre 1,000.
  describe('cantidades fuera de rango y grandes', () => {
    const HEADERS = ['Nombre *', 'Categoría *', 'Subcategoría *', 'Precio Compra *', 'Precio Venta *', 'Cantidad *'];

    async function uploadRows(rows: (string | number)[][]) {
      mockExcelJS.__setParseFixture({ headers: HEADERS, rows });
      const user = userEvent.setup();
      await user.upload(getFileInput(), buildExcelFile());
      await screen.findByRole('heading', { name: /vista previa y edición/i });
      return user;
    }

    it('marca con error la fila que pasa de 10,000 unidades', async () => {
      renderWizard();
      await goToStep2();
      await uploadRows([['Polo Infinito', 'Vestimenta', 'Camperas', 10, 20, 10001]]);

      // B3: la fila muestra TODOS sus errores (antes el último pisaba a los demás), así que se busca dentro del título.
      expect(screen.getByTitle(/La cantidad máxima por variante y almacén es 10,000 unidades\./)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /importar 0 productos/i })).toBeDisabled();
    });

    it('marca con error la fila con cantidad decimal', async () => {
      renderWizard();
      await goToStep2();
      await uploadRows([['Polo Medio', 'Vestimenta', 'Camperas', 10, 20, 2.5]]);

      expect(screen.getByTitle(/La cantidad debe ser un número entero\./)).toBeInTheDocument();
    });

    it('pide confirmar antes de importar una fila con más de 1,000 unidades', async () => {
      mockAxiosGetImplementation({
        categories: [{ id: 'cat-1', name: 'Vestimenta' }],
        subcategoriesByCategory: { 'cat-1': [{ id: 'sub-1', name: 'Camperas' }] },
      });
      mockAxiosPost.mockResolvedValue({ data: { created: 1, errors: 0, message: 'ok' } });
      renderWizard();
      await goToStep2();

      const ROW: (string | number)[] = ['Polo Grande', 'Vestimenta', 'Camperas', 10, 20, 1500];
      const user = await uploadRows([ROW]);
      // Segunda subida: la primera deja la subcategoría sin resolver (ver cabecera).
      await user.click(screen.getByRole('button', { name: /cambiar archivo/i }));
      await uploadRows([ROW]);

      await user.click(await screen.findByRole('button', { name: /importar 1 productos/i }));
      expect(await screen.findByText('Estás cargando 1,500 unidades. ¿Confirmas la cantidad?')).toBeInTheDocument();
      expect(mockAxiosPost).not.toHaveBeenCalled();

      await user.click(screen.getByRole('button', { name: /sí, confirmar/i }));
      await waitFor(() => expect(mockAxiosPost).toHaveBeenCalledTimes(1));
    });
  });

  describe('archivo sin columna obligatoria', () => {
    it('muestra un toast de error nombrando la columna faltante y no avanza ni parsea filas', async () => {
      renderWizard();
      await goToStep2();

      // Falta "Nombre *"
      const HEADERS = ['Categoría *', 'Subcategoría *', 'Precio Compra *', 'Precio Venta *', 'Cantidad *'];
      const ROW: (string | number)[] = ['Vestimenta', 'Camperas', 100, 250, 5];
      mockExcelJS.__setParseFixture({ headers: HEADERS, rows: [ROW] });

      const user = userEvent.setup();
      await user.upload(getFileInput(), buildExcelFile());

      await waitFor(() => expect(mockToast.error).toHaveBeenCalled());
      expect(mockToast.error).toHaveBeenCalledWith(expect.stringContaining('Nombre *'));

      // Se queda en el Paso 2 — no avanza a la vista previa.
      expect(
        screen.getByRole('heading', { name: /subir archivo/i }),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole('heading', { name: /vista previa y edición/i }),
      ).not.toBeInTheDocument();

      // No llegó a intentar resolver subcategorías de ninguna fila.
      expect(mockAxiosGet).not.toHaveBeenCalledWith(
        expect.stringContaining('/subcategories/category/'),
      );
    });
  });
  // B3 — plantilla v2: tallas/colores en su propia columna y validación antes de cargar.
  describe('plantilla v2 y validación antes de cargar', () => {
    const CATALOG = {
      categories: [{ id: 'cat-1', name: 'Ropa' }],
      subcategoriesByCategory: { 'cat-1': [{ id: 'sub-1', name: 'Polos' }] },
    };
    const HEADERS = ['Categoría *', 'Subcategoría *', 'Nombre *', 'Talla', 'Color', 'Precio Compra *', 'Precio Venta *', 'Cantidad *'];

    async function uploadFixture(headers: string[], rows: (string | number)[][]) {
      mockExcelJS.__setParseFixture({ headers, rows });
      const user = userEvent.setup();
      await user.upload(getFileInput(), buildExcelFile());
      return user;
    }

    it('el caso del cliente: un polo en S, M, L y XL se carga de una vez con la talla en cada variante', async () => {
      mockAxiosGetImplementation(CATALOG);
      mockAxiosPost.mockResolvedValue({ data: { created: 4, errors: 0, message: 'ok' } });
      renderWizard();
      await goToStep2();

      const rows = ['S', 'M', 'L', 'XL'].map((talla) => ['Ropa', 'Polos', 'Polo oversize', talla, '', 18, 49.9, 10]);
      const user = await uploadFixture(HEADERS, rows);
      await screen.findByRole('heading', { name: /vista previa y edición/i });

      // La vista previa muestra la variante de cada fila (lo que antes no se veía)
      for (const talla of ['S', 'M', 'L', 'XL']) {
        expect(screen.getByText(`Talla: ${talla}`)).toBeInTheDocument();
      }
      const save = await screen.findByRole('button', { name: /importar 4 productos/i });
      expect(save).not.toBeDisabled();
      await user.click(save);

      await waitFor(() => expect(mockAxiosPost).toHaveBeenCalledTimes(1));
      const payload = mockAxiosPost.mock.calls[0][1] as { rows: { name: string; attributes: Record<string, string>; subcategoryId: string }[] };
      expect(payload.rows).toHaveLength(4);
      expect(new Set(payload.rows.map((r) => r.name))).toEqual(new Set(['Polo oversize']));
      expect(payload.rows.map((r) => r.attributes)).toEqual([{ Talla: 'S' }, { Talla: 'M' }, { Talla: 'L' }, { Talla: 'XL' }]);
      expect(new Set(payload.rows.map((r) => r.subcategoryId))).toEqual(new Set(['sub-1']));
    });

    it('todas las filas de un producto viajan con el mismo nombre aunque se hayan escrito distinto', async () => {
      mockAxiosGetImplementation(CATALOG);
      mockAxiosPost.mockResolvedValue({ data: { created: 2, errors: 0, message: 'ok' } });
      renderWizard();
      await goToStep2();
      const user = await uploadFixture(HEADERS, [
        ['Ropa', 'Polos', 'Polo básico', 'S', '', 15, 35, 5],
        ['Ropa', 'Polos', '  polo   BASICO ', 'M', '', 15, 35, 5],
      ]);
      await user.click(await screen.findByRole('button', { name: /importar 2 productos/i }));
      await waitFor(() => expect(mockAxiosPost).toHaveBeenCalledTimes(1));
      const payload = mockAxiosPost.mock.calls[0][1] as { rows: { name: string }[] };
      expect(payload.rows.map((r) => r.name)).toEqual(['Polo básico', 'Polo básico']);
    });

    it('un producto con varias filas y sin talla/color NO se carga como "Variante 1, 2, 3, 4": se explica el error', async () => {
      mockAxiosGetImplementation(CATALOG);
      renderWizard();
      await goToStep2();
      await uploadFixture(HEADERS, [0, 1, 2, 3].map(() => ['Ropa', 'Polos', 'Polo oversize', '', '', 18, 49.9, 10]));
      await screen.findByRole('heading', { name: /vista previa y edición/i });

      const alert = await screen.findByRole('alert');
      expect(within(alert).getByText(/No se creó nada todavía/)).toBeInTheDocument();
      expect(within(alert).getAllByText(/tiene 4 filas: indica Talla, Color u otro atributo/)).toHaveLength(4);
      expect(within(alert).getByText(/^Fila 2 · Polo oversize:/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /importar 0 productos/i })).toBeDisabled();
      expect(mockAxiosPost).not.toHaveBeenCalled();
    });

    it('lista cada error por fila con su número de fila del Excel', async () => {
      mockAxiosGetImplementation(CATALOG);
      renderWizard();
      await goToStep2();
      await uploadFixture(HEADERS, [
        ['Ropa', 'Polos', 'Polo', 'S', '', 'abc', 49.9, 10],
        ['Ropa', 'Polos', 'Gorra', '', '', 5, 0, 10],
      ]);
      await screen.findByRole('heading', { name: /vista previa y edición/i });
      const alert = await screen.findByRole('alert');
      expect(within(alert).getByText(/Fila 2 · Polo: Precio Compra no es un número: «abc»/)).toBeInTheDocument();
      expect(within(alert).getByText(/Fila 3 · Gorra: Precio Venta debe ser mayor a 0\./)).toBeInTheDocument();
    });

    it('las filas de ejemplo "(EJEMPLO)" se ignoran y se avisa cuántas', async () => {
      mockAxiosGetImplementation(CATALOG);
      renderWizard();
      await goToStep2();
      await uploadFixture(HEADERS, [
        ['Ropa', 'Polos', '(EJEMPLO) Polo básico', 'S', '', 15, 35, 10],
        ['Ropa', 'Polos', '(EJEMPLO) Polo básico', 'M', '', 15, 35, 10],
        ['Ropa', 'Polos', 'Mi polo', 'L', '', 20, 50, 3],
      ]);
      await waitFor(() =>
        expect(mockToast.success).toHaveBeenCalledWith('Se encontraron 1 filas (se ignoraron 2 de ejemplo)'),
      );
    });

    it('si solo hay filas de ejemplo avisa que hay que reemplazarlas y no avanza', async () => {
      mockAxiosGetImplementation(CATALOG);
      renderWizard();
      await goToStep2();
      await uploadFixture(HEADERS, [['Ropa', 'Polos', '(EJEMPLO) Polo básico', 'S', '', 15, 35, 10]]);
      await waitFor(() => expect(mockToast.warning).toHaveBeenCalledWith(expect.stringContaining('Solo hay filas de ejemplo')));
      expect(screen.queryByRole('heading', { name: /vista previa y edición/i })).not.toBeInTheDocument();
    });

    it('la plantilla anterior (columna "Atributos") se rechaza con un mensaje claro y no carga nada', async () => {
      mockAxiosGetImplementation(CATALOG);
      renderWizard();
      await goToStep2();
      const LEGACY = ['Categoría *', 'Subcategoría *', 'Nombre *', 'Descripción', 'SKU Empresa', 'Atributos (Color:Rojo,Talle:M)', 'Precio Compra *', 'Precio Venta *', 'Cantidad *', 'Stock Mínimo'];
      const user = await uploadFixture(LEGACY, [['Ropa', 'Polos', 'Polo', '', '', 'S', 15, 35, 10, 2]]);

      await waitFor(() => expect(mockToast.error).toHaveBeenCalledWith(expect.stringContaining('versión anterior')));
      const alert = await screen.findByRole('alert');
      expect(within(alert).getByText(/Plantilla de una versión anterior/)).toBeInTheDocument();
      expect(within(alert).getByText(/No se cargó ningún producto/)).toBeInTheDocument();

      // Se queda en el Paso 2, no resuelve categorías ni envía nada
      expect(screen.getByRole('heading', { name: /subir archivo/i })).toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: /vista previa y edición/i })).not.toBeInTheDocument();
      expect(mockAxiosGet).not.toHaveBeenCalledWith(expect.stringContaining('/subcategories/category/'));
      expect(mockAxiosPost).not.toHaveBeenCalled();

      // El aviso ofrece bajar la plantilla nueva
      await user.click(within(alert).getByRole('button', { name: /descargar plantilla nueva/i }));
      await waitFor(() => expect(mockToast.success).toHaveBeenCalledWith('Plantilla descargada correctamente'));
    });

    it('la plantilla descargada trae la versión, las instrucciones y las columnas Talla y Color', async () => {
      mockAxiosGetImplementation({ categories: [], allSubcategories: [{ id: 's', name: 'Polos', category: { id: 'c', name: 'Ropa' } }] });
      renderWizard();
      const user = userEvent.setup();
      await user.click(await screen.findByRole('button', { name: /descargar plantilla base de ejemplo/i }));
      await waitFor(() => expect(mockToast.success).toHaveBeenCalledWith('Plantilla descargada correctamente'));

      const workbook = mockExcelJS.__getLastWorkbook();
      expect(workbook.getWorksheet('Instrucciones')).toBeDefined();
      const meta = workbook.getWorksheet('_metadata')!;
      expect(meta.getRow(2).getCell(1).value).toBe('templateVersion');
      expect(meta.getRow(2).getCell(2).value).toBe('2');
      const header = workbook.getWorksheet('Productos')!.getRow(1);
      expect([6, 7, 8].map((c) => header.getCell(c).value)).toEqual(['Talla', 'Color', 'Otros atributos']);
    });
  });
});
