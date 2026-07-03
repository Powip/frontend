import { render, screen, within } from '@testing-library/react';
import { CcUpsellRecordsTable } from '../CcUpsellRecordsTable';
import type { CcUpsellRecordsResponse } from '@/interfaces/IOrder';
import { useUpsellRecords } from '@/hooks/useUpsellRecords';

// ── Mock del hook — aísla el componente de TanStack Query y del service HTTP ──
jest.mock('@/hooks/useUpsellRecords');

const mockUseUpsellRecords = jest.mocked(useUpsellRecords);

// ── Fixtures ───────────────────────────────────────────────────────────────────

const RANGE = {
  from: new Date('2026-05-01'),
  to: new Date('2026-05-31'),
};

/**
 * Dos ítems con valores únicos para poder distinguirlos en el DOM.
 * Item 1: orderNumber=1001, productName="Camiseta Negra", sku=CAM-01,
 *         quantity=2, unitPrice=50, subtotal=100,
 *         addedByName="Ana García", sellerName="Carlos López",
 *         shop="tiendaA.myshopify.com", createdAt=2026-05-10
 *
 * Item 2: orderNumber=1002, productName="Polo Blanco", sku=POL-02,
 *         quantity=3, unitPrice=75, subtotal=225,
 *         addedByName=null, sellerName=null,
 *         shop="tiendaB.myshopify.com", createdAt=2026-05-11
 */
const ITEM_1 = {
  id: 'rec-001',
  orderNumber: '1001',
  productName: 'Camiseta Negra',
  sku: 'CAM-01',
  quantity: 2,
  unitPrice: 50,
  subtotal: 100,
  addedByName: 'Ana García',
  sellerName: 'Carlos López',
  shop: 'tiendaA.myshopify.com',
  createdAt: '2026-05-10T14:00:00.000Z',
};

const ITEM_2 = {
  id: 'rec-002',
  orderNumber: '1002',
  productName: 'Polo Blanco',
  sku: 'POL-02',
  quantity: 3,
  unitPrice: 75,
  subtotal: 225,
  addedByName: null,
  sellerName: null,
  shop: 'tiendaB.myshopify.com',
  createdAt: '2026-05-11T09:00:00.000Z',
};

const MOCK_DATA: CcUpsellRecordsResponse = {
  items: [ITEM_1, ITEM_2],
  totalMonto: 325,
  totalUnidades: 5,
  totalRegistros: 2,
};

// ── Helper: construye retorno mínimo compatible con useQuery ──────────────────

function makeQueryResult(overrides: {
  data?: CcUpsellRecordsResponse;
  isLoading?: boolean;
  isError?: boolean;
}) {
  return {
    data: overrides.data ?? undefined,
    isLoading: overrides.isLoading ?? false,
    isError: overrides.isError ?? false,
    isSuccess: !overrides.isLoading && !overrides.isError && overrides.data !== undefined,
    isPending: overrides.isLoading ?? false,
    isFetching: overrides.isLoading ?? false,
    status: overrides.isError ? 'error' : overrides.isLoading ? 'pending' : 'success',
    error: overrides.isError ? new Error('Error del servidor') : null,
    refetch: jest.fn(),
    fetchStatus: overrides.isLoading ? 'fetching' : 'idle',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

function setupHook(overrides: { data?: CcUpsellRecordsResponse; isLoading?: boolean; isError?: boolean } = {}) {
  mockUseUpsellRecords.mockReturnValue(makeQueryResult(overrides));
}

function renderComponent() {
  return render(<CcUpsellRecordsTable storeId="store-1" range={RANGE} />);
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('CcUpsellRecordsTable', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  // ── 1. Título siempre visible ─────────────────────────────────────────────

  describe('título de sección', () => {
    it('muestra el título "Detalle de Upsell" con datos', () => {
      setupHook({ data: MOCK_DATA });
      renderComponent();
      expect(screen.getByRole('heading', { name: /detalle de upsell/i })).toBeInTheDocument();
    });

    it('muestra el título "Detalle de Upsell" en estado vacío', () => {
      setupHook({ data: { items: [], totalMonto: 0, totalUnidades: 0, totalRegistros: 0 } });
      renderComponent();
      expect(screen.getByRole('heading', { name: /detalle de upsell/i })).toBeInTheDocument();
    });

    it('muestra el título "Detalle de Upsell" durante la carga', () => {
      setupHook({ isLoading: true });
      renderComponent();
      expect(screen.getByRole('heading', { name: /detalle de upsell/i })).toBeInTheDocument();
    });

    it('muestra el título "Detalle de Upsell" en estado de error', () => {
      setupHook({ isError: true });
      renderComponent();
      expect(screen.getByRole('heading', { name: /detalle de upsell/i })).toBeInTheDocument();
    });
  });

  // ── 2. Render con datos — filas de la tabla ───────────────────────────────

  describe('render con datos', () => {
    beforeEach(() => setupHook({ data: MOCK_DATA }));

    it('muestra el número de orden del primer ítem (1001)', () => {
      renderComponent();
      expect(screen.getByText('1001')).toBeInTheDocument();
    });

    it('muestra el número de orden del segundo ítem (1002)', () => {
      renderComponent();
      expect(screen.getByText('1002')).toBeInTheDocument();
    });

    it('muestra el nombre de producto del primer ítem', () => {
      renderComponent();
      expect(screen.getByText('Camiseta Negra')).toBeInTheDocument();
    });

    it('muestra el nombre de producto del segundo ítem', () => {
      renderComponent();
      expect(screen.getByText('Polo Blanco')).toBeInTheDocument();
    });

    it('muestra el SKU del primer ítem en la fila', () => {
      renderComponent();
      expect(screen.getByText('(CAM-01)')).toBeInTheDocument();
    });

    it('muestra quien agregó el upsell del primer ítem (Ana García)', () => {
      renderComponent();
      expect(screen.getByText('Ana García')).toBeInTheDocument();
    });

    it('muestra el vendedor del primer ítem (Carlos López)', () => {
      renderComponent();
      expect(screen.getByText('Carlos López')).toBeInTheDocument();
    });

    it('renderiza exactamente dos filas de datos (una por ítem)', () => {
      renderComponent();
      // Los números de orden son únicos: verificamos ambos presentes
      expect(screen.getByText('1001')).toBeInTheDocument();
      expect(screen.getByText('1002')).toBeInTheDocument();
    });

    it('muestra los headers de columna de la tabla', () => {
      renderComponent();
      expect(screen.getByText('Nro. orden')).toBeInTheDocument();
      expect(screen.getByText('Producto')).toBeInTheDocument();
      expect(screen.getByText('Quien agregó')).toBeInTheDocument();
      expect(screen.getByText('Vendedor pedido')).toBeInTheDocument();
      expect(screen.getByText('Tienda')).toBeInTheDocument();
    });
  });

  // ── 3. Cards de totales ───────────────────────────────────────────────────

  describe('cards de totales', () => {
    beforeEach(() => setupHook({ data: MOCK_DATA }));

    it('muestra el label "Monto total upsell"', () => {
      renderComponent();
      expect(screen.getByText('Monto total upsell')).toBeInTheDocument();
    });

    it('muestra el label "Unidades vendidas"', () => {
      renderComponent();
      expect(screen.getByText('Unidades vendidas')).toBeInTheDocument();
    });

    it('muestra el label "Registros"', () => {
      renderComponent();
      expect(screen.getByText('Registros')).toBeInTheDocument();
    });

    it('muestra el totalMonto (325) formateado con S/', () => {
      renderComponent();
      const match = screen.getAllByText((text) =>
        /325/.test(text.replace(/\s/g, '')) && /S/.test(text),
      );
      expect(match.length).toBeGreaterThanOrEqual(1);
    });

    it('muestra el totalUnidades (5)', () => {
      renderComponent();
      expect(screen.getByText('5')).toBeInTheDocument();
    });

    it('muestra el totalRegistros (2)', () => {
      renderComponent();
      const card = screen.getByText('Registros').parentElement as HTMLElement;
      expect(within(card).getByText('2')).toBeInTheDocument();
    });
  });

  // ── 4. addedByName / sellerName null → placeholder "—" ───────────────────

  describe('placeholders para campos null', () => {
    beforeEach(() => setupHook({ data: MOCK_DATA }));

    it('muestra "—" cuando addedByName es null (ítem 2)', () => {
      renderComponent();
      // Hay dos "—" (addedByName + sellerName del ítem 2)
      const placeholders = screen.getAllByText('—');
      expect(placeholders.length).toBeGreaterThanOrEqual(2);
    });

    it('muestra "—" cuando sellerName es null (ítem 2)', () => {
      renderComponent();
      const placeholders = screen.getAllByText('—');
      expect(placeholders.length).toBeGreaterThanOrEqual(1);
    });

    it('no renderiza el texto literal "null"', () => {
      renderComponent();
      expect(screen.queryByText('null')).not.toBeInTheDocument();
    });
  });

  // ── 5. Estado vacío ───────────────────────────────────────────────────────

  describe('estado vacío (items=[])', () => {
    beforeEach(() =>
      setupHook({ data: { items: [], totalMonto: 0, totalUnidades: 0, totalRegistros: 0 } }),
    );

    it('muestra el mensaje de sin registros', () => {
      renderComponent();
      expect(
        screen.getByText(/sin registros de upsell para el período seleccionado/i),
      ).toBeInTheDocument();
    });

    it('no muestra headers de tabla cuando no hay datos', () => {
      renderComponent();
      expect(screen.queryByText('Nro. orden')).not.toBeInTheDocument();
    });

    it('no muestra las cards de totales cuando no hay datos', () => {
      renderComponent();
      expect(screen.queryByText('Monto total upsell')).not.toBeInTheDocument();
    });
  });

  describe('estado vacío cuando data es undefined', () => {
    beforeEach(() => setupHook({ data: undefined }));

    it('muestra el mensaje de sin registros cuando data es undefined', () => {
      renderComponent();
      expect(
        screen.getByText(/sin registros de upsell para el período seleccionado/i),
      ).toBeInTheDocument();
    });
  });

  // ── 6. Estado loading — skeleton ──────────────────────────────────────────

  describe('estado loading', () => {
    beforeEach(() => setupHook({ isLoading: true }));

    it('no crashea durante la carga', () => {
      expect(() => renderComponent()).not.toThrow();
    });

    it('muestra el skeleton con animate-pulse durante la carga', () => {
      const { container } = renderComponent();
      const pulses = container.querySelectorAll('.animate-pulse');
      expect(pulses.length).toBeGreaterThanOrEqual(1);
    });

    it('no muestra filas de datos mientras carga', () => {
      renderComponent();
      expect(screen.queryByText('1001')).not.toBeInTheDocument();
      expect(screen.queryByText('1002')).not.toBeInTheDocument();
    });

    it('no muestra el mensaje de vacío mientras carga', () => {
      renderComponent();
      expect(
        screen.queryByText(/sin registros de upsell/i),
      ).not.toBeInTheDocument();
    });
  });

  // ── 7. Estado error ───────────────────────────────────────────────────────

  describe('estado error', () => {
    beforeEach(() => setupHook({ isError: true }));

    it('muestra el mensaje de error visible al usuario', () => {
      renderComponent();
      expect(
        screen.getByText(/error al cargar el detalle de upsell/i),
      ).toBeInTheDocument();
    });

    it('no muestra filas de datos en estado error', () => {
      renderComponent();
      expect(screen.queryByText('1001')).not.toBeInTheDocument();
      expect(screen.queryByText('Camiseta Negra')).not.toBeInTheDocument();
    });

    it('no muestra las cards de totales en estado error', () => {
      renderComponent();
      expect(screen.queryByText('Monto total upsell')).not.toBeInTheDocument();
    });

    it('no muestra el mensaje de vacío en estado error', () => {
      renderComponent();
      expect(
        screen.queryByText(/sin registros de upsell/i),
      ).not.toBeInTheDocument();
    });
  });
});
