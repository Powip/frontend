/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Tests de integración: Atención al cliente → Gestión COD
 * (buscador de clientes + exportar selección a Excel)
 *
 * Los hooks de datos están mockeados con un "backend" en memoria que respeta
 * pestaña, canal, agente, fecha y paginación (50 por página). Se verifica:
 * 1. Selección entre páginas: el contador de Exportar coincide con lo exportado.
 * 2. El checkbox de cabecera no borra lo seleccionado en otras páginas.
 * 3. Cambiar de sub-pestaña limpia la selección (no se exporta una selección oculta).
 * 4. Si un pedido seleccionado sale de la pestaña tras un refresco, deja de contarse.
 * 5. Búsqueda por nombre, teléfono y N° de orden sobre TODOS los pedidos de la pestaña
 *    (no solo la página visible), combinada con agente, canal y fecha.
 * 6. Estado vacío con "Limpiar búsqueda".
 * 7. WA Masivo y Copiar actúan sobre la selección efectiva con búsqueda activa.
 * 8. Aviso de resultados incompletos cuando el conjunto viene truncado.
 * 9. Exportar solo aparece en Contactado / No contesta / Anulados.
 */
import { render, screen, within, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { OrderHeader, SubEstadoCc } from '@/interfaces/IOrder';

/* ---------------- Backend en memoria ---------------- */
type Filters = {
  subEstado?: SubEstadoCc;
  canalOrigen?: string;
  agenteId?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
};

function makeOrder(i: number, overrides: Partial<OrderHeader> = {}): OrderHeader {
  return {
    id: `id-${i}`,
    orderNumber: `ORD-${String(i).padStart(3, '0')}`,
    customer: { fullName: `Cliente ${i}`, phoneNumber: `900000${String(i).padStart(3, '0')}` },
    grandTotal: '100.00',
    payments: [],
    items: [],
    subEstadoCc: 'contactado',
    canalOrigen: i % 2 === 0 ? 'releasit' : 'shopify_cod',
    agenteId: i % 3 === 0 ? 'ag1' : 'ag2',
    created_at: `2026-09-${String((i % 28) + 1).padStart(2, '0')}T15:00:00.000Z`,
    salesRegion: 'LIMA',
    ...overrides,
  } as unknown as OrderHeader;
}

let db: OrderHeader[] = [];

function applyFilters(f: Filters) {
  return db.filter((o) =>
    (!f.subEstado || o.subEstadoCc === f.subEstado) &&
    (!f.canalOrigen || o.canalOrigen === f.canalOrigen) &&
    (!f.agenteId || (o as any).agenteId === f.agenteId) &&
    (!f.startDate || o.created_at >= f.startDate) &&
    (!f.endDate || o.created_at <= f.endDate),
  );
}

const allHookCalls: { filters: Filters; enabled: boolean }[] = [];
let truncateAll = false;

jest.mock('@/hooks/useCcPedidos', () => ({
  useCcPedidos: (f: Filters) => {
    const rows = applyFilters(f);
    const limit = f.limit ?? 50;
    const page = f.page ?? 1;
    return {
      data: {
        data: rows.slice((page - 1) * limit, page * limit),
        total: rows.length,
        page,
        totalPages: Math.max(1, Math.ceil(rows.length / limit)),
      },
      isLoading: false,
      refetch: jest.fn(),
    };
  },
}));

jest.mock('@/hooks/useCcPedidosAll', () => ({
  useCcPedidosAll: (f: Filters, enabled: boolean) => {
    allHookCalls.push({ filters: f, enabled });
    if (!enabled) return { data: undefined, isLoading: false, isError: false, refetch: jest.fn() };
    const rows = applyFilters(f);
    const data = truncateAll ? rows.slice(0, 10) : rows;
    return {
      data: { data, total: rows.length, truncated: data.length < rows.length },
      isLoading: false,
      isError: false,
      refetch: jest.fn(),
    };
  },
}));

jest.mock('@/hooks/useCcKpis', () => ({ useCcKpis: () => ({ data: undefined, isLoading: false }) }));
jest.mock('@/hooks/useAgentes', () => ({
  useAgentes: () => ({
    data: [
      { id: 'ag1', nombre: 'Ana', pedidosPendientes: 0 },
      { id: 'ag2', nombre: 'Beto', pedidosPendientes: 0 },
    ],
    isLoading: false,
  }),
}));
jest.mock('@/hooks/useOrdersByStore', () => ({
  useOrdersByStore: () => ({ data: [], isLoading: false, refetch: jest.fn() }),
}));
jest.mock('@/hooks/useIncompleteOrders', () => ({
  useIncompleteOrders: () => ({ data: [], isLoading: false, refetch: jest.fn() }),
}));
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    auth: { user: { id: 'u1', email: 'a@b.com', role: 'ADMIN' } },
    selectedStoreId: 'store-1',
  }),
}));

jest.mock('@/utils/exportCcPedidosExcel', () => ({ exportCcPedidosToExcel: jest.fn() }));
jest.mock('sonner', () => ({
  toast: { success: jest.fn(), error: jest.fn(), warning: jest.fn(), info: jest.fn() },
}));

/* Componentes pesados no relevantes para estos flujos */
const stub = (name: string) => ({ __esModule: true, default: () => null, [name]: () => null });
jest.mock('@/components/header/HeaderConfig', () => stub('HeaderConfig'));
jest.mock('@/components/modals/CustomerServiceModal', () => stub('CustomerServiceModal'));
jest.mock('@/components/modals/PaymentVerificationModal', () => stub('PaymentVerificationModal'));
jest.mock('@/components/modals/ReassignSellerModal', () => stub('ReassignSellerModal'));
jest.mock('@/components/atencion-cliente/cc-v2/CcMovimientosTab', () => stub('CcMovimientosTab'));
jest.mock('@/components/atencion-cliente/cc-v2/cierre-dia/CcCierreDiaTab', () => stub('CcCierreDiaTab'));
jest.mock('@/components/atencion-cliente/IncompleteOrdersTab', () => stub('IncompleteOrdersTab'));
jest.mock('@/components/eva/SendToEvaButton', () => stub('SendToEvaButton'));
jest.mock('@/components/ui/date-range-picker', () => ({
  DateRangePicker: ({ onDateChange }: { onDateChange: (d: unknown) => void }) => {
    const React = require('react');
    return React.createElement(
      'button',
      {
        type: 'button',
        onClick: () =>
          onDateChange({ from: new Date('2026-09-10T00:00:00.000Z'), to: new Date('2026-09-20T23:59:59.000Z') }),
      },
      'Elegir rango 10–20 sep',
    );
  },
}));

import AtencionClientePage from '../page';
import { exportCcPedidosToExcel } from '@/utils/exportCcPedidosExcel';
import { toast } from 'sonner';

const exportMock = jest.mocked(exportCcPedidosToExcel);

// Render completo de la página + userEvent: bajo carga de la suite completa
// algunos casos superan los 5 s por defecto (mismo criterio que registrar-venta).
jest.setTimeout(20000);

/* ---------------- Helpers ---------------- */
function rowOf(orderNumber: string) {
  return screen.getByText(orderNumber).closest('tr') as HTMLElement;
}
function toggleRow(orderNumber: string) {
  return userEvent.click(within(rowOf(orderNumber)).getByRole('checkbox'));
}
async function goToSubTab(label: RegExp) {
  await userEvent.click(screen.getByRole('button', { name: label }));
}
function exportButton() {
  return screen.getByRole('button', { name: /exportar excel/i });
}
async function typeSearch(text: string) {
  const box = screen.getByRole('searchbox', { name: /buscar pedidos/i });
  await userEvent.clear(box);
  if (text) await userEvent.type(box, text);
}
function exportedNumbers() {
  const [orders] = exportMock.mock.calls.at(-1)!;
  return orders.map((o) => o.orderNumber);
}

beforeEach(() => {
  db = Array.from({ length: 60 }, (_, i) => makeOrder(i + 1));
  db.push(
    makeOrder(100, { customer: { fullName: 'María López', phoneNumber: '987654321' } as any }),
    makeOrder(101, { subEstadoCc: 'no_contesta' }),
    makeOrder(102, { subEstadoCc: 'por_confirmar' }),
  );
  allHookCalls.length = 0;
  truncateAll = false;
  exportMock.mockReset().mockResolvedValue(undefined);
  jest.mocked(toast.info).mockClear();
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: jest.fn().mockResolvedValue(undefined) },
    configurable: true,
  });
  window.open = jest.fn();
});

/* ---------------- Exportación / selección ---------------- */
describe('Gestión COD — exportar selección', () => {
  it('solo aparece en Contactado, No contesta y Anulados', async () => {
    render(<AtencionClientePage />);
    expect(screen.queryByRole('button', { name: /exportar excel/i })).not.toBeInTheDocument(); // Por confirmar
    for (const tab of [/^Contactado\s*\d*$/, /^No contesta\s*\d*$/, /^Anulados\s*\d*$/]) {
      await goToSubTab(tab);
      expect(exportButton()).toBeDisabled();
    }
  });

  it('selección en distintas páginas: el contador coincide con lo exportado', async () => {
    render(<AtencionClientePage />);
    await goToSubTab(/^Contactado\s*\d*$/);

    await toggleRow('ORD-001');
    await toggleRow('ORD-002');
    await userEvent.click(screen.getByRole('button', { name: '2' })); // página 2
    await toggleRow('ORD-055');

    expect(exportButton()).toHaveTextContent('Exportar Excel (3)');
    await userEvent.click(exportButton());
    expect(exportedNumbers().sort()).toEqual(['ORD-001', 'ORD-002', 'ORD-055']);
    expect(exportMock.mock.calls[0][1]).toBe('Contactado');
  });

  it('el checkbox de cabecera no borra la selección de otras páginas', async () => {
    render(<AtencionClientePage />);
    await goToSubTab(/^Contactado\s*\d*$/);

    await toggleRow('ORD-001');
    await userEvent.click(screen.getByRole('button', { name: '2' }));
    const header = screen.getAllByRole('checkbox')[0];
    await userEvent.click(header); // marca las 11 de la página 2 (51–60 + María)
    expect(exportButton()).toHaveTextContent('Exportar Excel (12)');
    await userEvent.click(header); // desmarca solo la página 2
    expect(exportButton()).toHaveTextContent('Exportar Excel (1)');
  });

  it('cambiar de sub-pestaña limpia la selección', async () => {
    render(<AtencionClientePage />);
    await goToSubTab(/^Contactado\s*\d*$/);
    await toggleRow('ORD-001');
    expect(exportButton()).toHaveTextContent('(1)');

    await goToSubTab(/^No contesta\s*\d*$/);
    expect(exportButton()).toBeDisabled();
    expect(exportButton()).toHaveTextContent(/^Exportar Excel$/);

    await goToSubTab(/^Contactado\s*\d*$/);
    expect(within(rowOf('ORD-001')).getByRole('checkbox')).not.toBeChecked();
  });

  it('un pedido seleccionado que sale de la pestaña deja de contarse', async () => {
    const { rerender } = render(<AtencionClientePage />);
    await goToSubTab(/^Contactado\s*\d*$/);
    await toggleRow('ORD-001');
    await toggleRow('ORD-002');
    expect(exportButton()).toHaveTextContent('(2)');

    // refresco: ORD-001 pasó a no_contesta (gestionado por otro agente)
    db = db.map((o) => (o.orderNumber === 'ORD-001' ? { ...o, subEstadoCc: 'no_contesta' } : o));
    rerender(<AtencionClientePage />);
    expect(exportButton()).toHaveTextContent('(1)');
    await userEvent.click(exportButton());
    expect(exportedNumbers()).toEqual(['ORD-002']);
  });
});

/* ---------------- Búsqueda ---------------- */
describe('Gestión COD — buscador', () => {
  it('busca en todos los pedidos de la pestaña, no solo en la página visible', async () => {
    render(<AtencionClientePage />);
    await goToSubTab(/^Contactado\s*\d*$/);
    expect(screen.queryByText('María López')).not.toBeInTheDocument(); // está en la página 2

    await typeSearch('maría');
    expect(screen.getByText('María López')).toBeInTheDocument();
    expect(screen.queryByText('ORD-001')).not.toBeInTheDocument();
    expect(allHookCalls.at(-1)).toMatchObject({ enabled: true, filters: { subEstado: 'contactado' } });
  });

  it('busca por teléfono y por N° de orden', async () => {
    render(<AtencionClientePage />);
    await goToSubTab(/^Contactado\s*\d*$/);

    await typeSearch('987 654');
    expect(screen.getByText('María López')).toBeInTheDocument();

    await typeSearch('ORD-059');
    expect(screen.getByText('ORD-059')).toBeInTheDocument();
    expect(screen.getAllByRole('row')).toHaveLength(2); // cabecera + 1
  });

  it('se combina con agente, canal y fecha', async () => {
    render(<AtencionClientePage />);
    await goToSubTab(/^Contactado\s*\d*$/);
    await typeSearch('cliente');

    const [agente, canal] = screen.getAllByRole('combobox');
    await userEvent.selectOptions(agente, 'ag1');
    await userEvent.selectOptions(canal, 'releasit');
    await userEvent.click(screen.getByRole('button', { name: /elegir rango/i }));

    // la selección de filtros no borra la búsqueda
    expect(screen.getByRole('searchbox', { name: /buscar pedidos/i })).toHaveValue('cliente');
    expect(allHookCalls.at(-1)).toMatchObject({
      enabled: true,
      filters: {
        subEstado: 'contactado',
        agenteId: 'ag1',
        canalOrigen: 'releasit',
        startDate: '2026-09-10T00:00:00.000Z',
        endDate: '2026-09-20T23:59:59.000Z',
      },
    });
    const expected = applyFilters(allHookCalls.at(-1)!.filters).map((o) => o.orderNumber);
    expect(expected.length).toBeGreaterThan(0);
    const shown = screen.getAllByText(/^ORD-\d+$/).map((el) => el.textContent);
    expect(shown.sort()).toEqual(expected.sort());
  });

  it('estado vacío con opción de limpiar la búsqueda', async () => {
    render(<AtencionClientePage />);
    await goToSubTab(/^Contactado\s*\d*$/);
    await typeSearch('zzz-no-existe');
    expect(screen.getByText(/no se encontraron pedidos para “zzz-no-existe”/i)).toBeInTheDocument();

    await userEvent.click(screen.getByText('Limpiar búsqueda', { selector: 'button' }));
    expect(screen.getByRole('searchbox', { name: /buscar pedidos/i })).toHaveValue('');
    expect(screen.getByText('ORD-001')).toBeInTheDocument();
  });

  it('muestra aviso de resultados incompletos si el conjunto viene truncado', async () => {
    truncateAll = true;
    render(<AtencionClientePage />);
    await goToSubTab(/^Contactado\s*\d*$/);
    await typeSearch('cliente');
    expect(screen.getByRole('status')).toHaveTextContent(/resultados incompletos: la búsqueda cubre 10 de 61/i);
  });

  it('no muestra aviso si el conjunto está completo', async () => {
    render(<AtencionClientePage />);
    await goToSubTab(/^Contactado\s*\d*$/);
    await typeSearch('cliente');
    expect(screen.queryByText(/resultados incompletos/i)).not.toBeInTheDocument();
  });

  it('WA Masivo y Copiar usan la selección con búsqueda activa', async () => {
    render(<AtencionClientePage />);
    await goToSubTab(/^Contactado\s*\d*$/);
    await typeSearch('cliente 5'); // Cliente 5, 50–59
    await toggleRow('ORD-005');
    await toggleRow('ORD-052');

    expect(screen.getByRole('button', { name: /copiar/i })).toHaveTextContent('Copiar (2)');
    await userEvent.click(screen.getByRole('button', { name: /copiar/i }));
    const copied = jest.mocked(navigator.clipboard.writeText).mock.calls[0][0];
    expect(copied).toContain('ORD-005');
    expect(copied).toContain('ORD-052');
    expect(copied.match(/Pedido /g)).toHaveLength(2);

    await userEvent.click(screen.getByRole('button', { name: /wa masivo/i }));
    expect(toast.info).toHaveBeenCalledWith('Abriendo 2 pestañas de WhatsApp...');
  });

  it('cambiar la búsqueda limpia la selección', async () => {
    render(<AtencionClientePage />);
    await goToSubTab(/^Contactado\s*\d*$/);
    await typeSearch('cliente 1');
    await toggleRow('ORD-001');
    expect(exportButton()).toHaveTextContent('(1)');
    await act(async () => { await typeSearch('cliente 2'); });
    expect(exportButton()).toBeDisabled();
  });
});
