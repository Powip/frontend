/**
 * Tests: FinanzasPage (app/finanzas/page.tsx)
 *
 * Comportamiento verificado:
 * 1. `fetchOrders` llama a los 3 endpoints en paralelo: GET .../order-header/store/:id,
 *    GET .../order-header/store/:id/leads-cod y GET .../shipping-guides/store/:id.
 * 2. Los pedidos de ambas fuentes (order-header + leads-cod) se mergean por `id`
 *    sin duplicarse — cuando el mismo `id` aparece en ambas respuestas, el de
 *    leads-cod tiene precedencia (se aplica después en el Map).
 * 3. Si leads-cod devuelve [], el comportamiento es el mismo que antes del
 *    cambio: solo se muestran los pedidos de order-header, sin romper nada.
 *
 * Mocks aplicados:
 * - axios → mockeado (get), ninguna llamada HTTP real.
 * - @/contexts/AuthContext → useAuth.
 * - sonner → toast.success/error/warning.
 * - next/navigation → useRouter/usePathname (usados por la página y por HeaderConfig).
 * - @/components/modals/CustomerServiceModal, CommentsTimelineModal,
 *   PaymentVerificationModal → mockeados a `{ default: () => null }` (mismo
 *   patrón que ShalomOrderTrackingView.test.tsx). CustomerServiceModal
 *   importa `jspdf` (ESM puro) que ts-jest no puede transformar tal cual viene
 *   en node_modules — se confirmó que sigue vigente en este worktree
 *   (`import jsPDF from "jspdf"` en CustomerServiceModal.tsx). Los otros 2
 *   modales se mockean igual por consistencia: en esta página se montan
 *   siempre (aunque con `open=false`) y no son parte del comportamiento bajo
 *   prueba.
 */

import { render, screen, waitFor } from '@testing-library/react';

// ── Mocks de infraestructura ─────────────────────────────────────────────────

jest.mock('axios', () => ({
  default: {
    get: jest.fn(),
    patch: jest.fn(),
    post: jest.fn(),
  },
  get: jest.fn(),
  patch: jest.fn(),
  post: jest.fn(),
}));

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
  usePathname: () => '/finanzas',
}));

jest.mock('@/components/modals/CustomerServiceModal', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('@/components/modals/CommentsTimelineModal', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('@/components/modals/PaymentVerificationModal', () => ({
  __esModule: true,
  default: () => null,
}));

// ── Imports bajo prueba (después de los mocks) ────────────────────────────────

import axios from 'axios';
import { useAuth } from '@/contexts/AuthContext';
import FinanzasPage from '../page';
import type { OrderHeader } from '@/interfaces/IOrder';

const mockedAxios = axios as unknown as {
  get: jest.Mock;
  patch: jest.Mock;
  post: jest.Mock;
};
const mockUseAuth = jest.mocked(useAuth);

// ── Fixtures ─────────────────────────────────────────────────────────────────

process.env.NEXT_PUBLIC_API_VENTAS = 'http://ventas';
process.env.NEXT_PUBLIC_API_COURIER = 'http://courier';

const MOCK_AUTH = {
  auth: {
    user: { id: 'user-1', name: 'Ana', surname: 'Vendedora', email: 'ana@powip.com', role: 'ADMIN', permissions: [] },
    company: { id: 'company-1', name: 'Powip Test', stores: [] },
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
  inventories: [],
  refreshInventories: jest.fn(),
  hasPermission: jest.fn().mockReturnValue(true),
};

function makeOrderHeader(overrides: Partial<OrderHeader> = {}): OrderHeader {
  return {
    id: 'order-1',
    receiptType: 'BOLETA',
    orderType: 'VENTA',
    orderNumber: 'ORD-001',
    storeId: 'store-1',
    customer: {
      id: 'client-1',
      companyId: 'company-1',
      fullName: 'Juan Pérez',
      phoneNumber: '999111222',
      clientType: 'TRADICIONAL',
      province: 'Lima',
      city: 'Lima',
      district: 'Miraflores',
      address: 'Av. Test 123',
      isActive: true,
    },
    salesChannel: 'WHATSAPP',
    closingChannel: 'WHATSAPP',
    deliveryType: 'DOMICILIO',
    courierId: null,
    courier: null,
    subtotal: '100.00',
    taxTotal: '0.00',
    shippingTotal: '0.00',
    discountTotal: '0.00',
    grandTotal: '100.00',
    status: 'PENDIENTE',
    salesRegion: 'LIMA',
    cancellationReason: null,
    notes: null,
    items: [],
    payments: [
      {
        id: 'payment-1',
        paymentMethod: 'EFECTIVO',
        amount: '100.00',
        externalReference: null,
        paymentProofUrl: null,
        status: 'PENDING',
        notes: null,
        paymentDate: '2026-08-01T00:00:00.000Z',
        created_at: '2026-08-01T00:00:00.000Z',
        updated_at: '2026-08-01T00:00:00.000Z',
      },
    ],
    created_at: '2026-08-01T00:00:00.000Z',
    updated_at: '2026-08-01T00:00:00.000Z',
    ...overrides,
  };
}

/** Enruta las 3 llamadas de `fetchOrders` según la URL solicitada. */
function mockFetchOrdersEndpoints({
  orders = [],
  leadsCod = [],
  guides = [],
}: {
  orders?: OrderHeader[];
  leadsCod?: OrderHeader[];
  guides?: unknown[];
}) {
  mockedAxios.get.mockImplementation((url: string) => {
    if (url.includes('/leads-cod')) return Promise.resolve({ data: leadsCod });
    if (url.includes('/order-header/store/')) return Promise.resolve({ data: orders });
    if (url.includes('/shipping-guides/store/')) return Promise.resolve({ data: guides });
    return Promise.reject(new Error(`URL no mockeada en el test: ${url}`));
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUseAuth.mockReturnValue(MOCK_AUTH as unknown as ReturnType<typeof useAuth>);
});

describe('FinanzasPage — fetchOrders (merge con leads-cod)', () => {
  it('llama a los 3 endpoints: order-header, leads-cod y shipping-guides', async () => {
    mockFetchOrdersEndpoints({});

    render(<FinanzasPage />);

    await waitFor(() => expect(mockedAxios.get).toHaveBeenCalledTimes(3));

    expect(mockedAxios.get).toHaveBeenCalledWith('http://ventas/order-header/store/store-1');
    expect(mockedAxios.get).toHaveBeenCalledWith('http://ventas/order-header/store/store-1/leads-cod');
    expect(mockedAxios.get).toHaveBeenCalledWith('http://courier/shipping-guides/store/store-1');
  });

  it('mergea pedidos de order-header y leads-cod sin duplicar por id (leads-cod tiene precedencia)', async () => {
    const original = makeOrderHeader({
      id: 'order-1',
      orderNumber: 'ORD-001',
      customer: { ...makeOrderHeader().customer, fullName: 'Juan Original' },
    });
    const overridden = makeOrderHeader({
      id: 'order-1',
      orderNumber: 'ORD-001',
      customer: { ...makeOrderHeader().customer, fullName: 'Juan Duplicado COD' },
    });
    const leadOnly = makeOrderHeader({
      id: 'order-2',
      orderNumber: 'ORD-002',
      customer: { ...makeOrderHeader().customer, fullName: 'Maria Lead' },
    });

    mockFetchOrdersEndpoints({ orders: [original], leadsCod: [overridden, leadOnly] });

    render(<FinanzasPage />);

    // 2 pedidos en total (order-1 + order-2), no 3: se dedupea por id.
    expect(await screen.findByText('Pagos Pendientes (2)')).toBeInTheDocument();
    // La versión de leads-cod ganó sobre la de order-header para el mismo id.
    expect(screen.getByText('Juan Duplicado COD')).toBeInTheDocument();
    expect(screen.queryByText('Juan Original')).not.toBeInTheDocument();
    // El pedido exclusivo de leads-cod también aparece.
    expect(screen.getByText('Maria Lead')).toBeInTheDocument();
  });

  it('si leads-cod devuelve [] el comportamiento es el mismo que antes del cambio (solo pedidos de order-header)', async () => {
    const onlyOrder = makeOrderHeader({ id: 'order-1', orderNumber: 'ORD-001' });

    mockFetchOrdersEndpoints({ orders: [onlyOrder], leadsCod: [] });

    render(<FinanzasPage />);

    expect(await screen.findByText('Pagos Pendientes (1)')).toBeInTheDocument();
    expect(screen.getByText('Juan Pérez')).toBeInTheDocument();
  });
});
