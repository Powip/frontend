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
 * 4. El tab "Pagos Pendientes" usa una DENYLIST de status
 *    (PAGOS_PENDIENTES_EXCLUDED_STATUSES = INCOMPLETE / PREVENTA / ANULADO):
 *    cualquier otra orden viva con pago por aprobar aparece — incluida
 *    PENDIENTE (ventas recién registradas, FIX finanzas-pagos). Si la orden
 *    tiene gestión de Call Center (`subEstadoCc` seteado), ese subestado debe
 *    estar en CC_CONFIRMED_SUBESTADOS ("confirmado" o "reprogramado");
 *    "carrito_recuperado" ya NO pasa. Pedidos sin `subEstadoCc` (sin gestión
 *    CC) pasan igual.
 * 5. `fetchOrders` usa `Promise.allSettled`, no `Promise.all`. Las guías
 *    (`/shipping-guides/store/:id`) son solo enriquecimiento:
 *      - Si falla `order-header/store/:id` o `.../leads-cod` (fuentes de verdad
 *        de la tabla) → `toast.error` y la tabla queda vacía.
 *      - Si falla SOLO la de guías → `toast.warning` ("No se pudo cargar info de
 *        couriers...") y la tabla sigue poblada con order-header + leads-cod,
 *        sin el enriquecimiento de courier. NO se llama `toast.error`.
 * 6. `mapOrderToSale` tolera DTOs livianos de `/leads-cod` (sin `customer` /
 *    sin `payments` / sin `created_at`): la fila se mapea igual, con
 *    `clientName` cayendo a "—".
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
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import FinanzasPage from '../page';
import type { OrderHeader, SubEstadoCc } from '@/interfaces/IOrder';

const mockedAxios = axios as unknown as {
  get: jest.Mock;
  patch: jest.Mock;
  post: jest.Mock;
};
const mockUseAuth = jest.mocked(useAuth);
const mockToast = toast as jest.Mocked<typeof toast>;

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
    // Default 'PREPARADO': no está en la denylist
    // (PAGOS_PENDIENTES_EXCLUDED_STATUSES), así que por defecto la orden entra
    // en "Pagos Pendientes" y no interfiere con el resto de asserts. Los tests
    // que prueban el filtro de status pasan su propio `status` via overrides.
    status: 'PREPARADO',
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

  it('si falla una fuente de verdad de la tabla (leads-cod), muestra toast.error y no lista pedidos', async () => {
    const consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    mockedAxios.get.mockImplementation((url: string) => {
      if (url.includes('/leads-cod')) {
        return Promise.reject(new Error('boom leads-cod'));
      }
      if (url.includes('/order-header/store/')) {
        return Promise.resolve({ data: [makeOrderHeader()] });
      }
      if (url.includes('/shipping-guides/store/')) {
        return Promise.resolve({ data: [] });
      }
      return Promise.reject(new Error(`URL no mockeada en el test: ${url}`));
    });

    render(<FinanzasPage />);

    await waitFor(() =>
      expect(mockToast.error).toHaveBeenCalledWith(
        'No se pudieron cargar los datos de Finanzas. Reintentá.',
      ),
    );
    // La tabla queda vacía: no se pudo mergear ninguna fuente.
    expect(screen.getByText('Pagos Pendientes (0)')).toBeInTheDocument();

    consoleErrorSpy.mockRestore();
  });

  it('si SOLO falla la llamada de guías, NO vacía Finanzas: toast.warning y la tabla sigue poblada', async () => {
    const consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    mockedAxios.get.mockImplementation((url: string) => {
      if (url.includes('/leads-cod')) {
        return Promise.resolve({ data: [] });
      }
      if (url.includes('/order-header/store/')) {
        return Promise.resolve({
          data: [
            makeOrderHeader({
              id: 'order-1',
              orderNumber: 'ORD-001',
              customer: {
                ...makeOrderHeader().customer,
                fullName: 'Cliente Con Guia Caida',
              },
            }),
          ],
        });
      }
      if (url.includes('/shipping-guides/store/')) {
        return Promise.reject(new Error('ms-courier caído'));
      }
      return Promise.reject(new Error(`URL no mockeada en el test: ${url}`));
    });

    render(<FinanzasPage />);

    // La tabla se pobla igual con order-header + leads-cod.
    expect(await screen.findByText('Pagos Pendientes (1)')).toBeInTheDocument();
    expect(screen.getByText('Cliente Con Guia Caida')).toBeInTheDocument();

    await waitFor(() =>
      expect(mockToast.warning).toHaveBeenCalledWith(
        'No se pudo cargar info de couriers; el resto de Finanzas está disponible.',
      ),
    );
    // Guías caídas degradan a warning, nunca a error.
    expect(mockToast.error).not.toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });

  it('mapea un lead de /leads-cod sin customer ni created_at (DTO liviano) sin romper: fila con clientName "—"', async () => {
    const lightLead = {
      id: 'lead-light',
      orderNumber: 'ORD-LIGHT',
      grandTotal: '80.00',
      status: 'PENDIENTE',
      // DTO liviano: sin customer, sin created_at, sin deliveryType.
      payments: [
        {
          id: 'p-light',
          paymentMethod: 'YAPE',
          amount: '80.00',
          status: 'PENDING',
          created_at: '2026-08-01T00:00:00.000Z',
        },
      ],
    } as unknown as OrderHeader;

    mockFetchOrdersEndpoints({ leadsCod: [lightLead] });

    render(<FinanzasPage />);

    // La página no crashea y la fila aparece (tiene un pago PENDING).
    expect(await screen.findByText('Pagos Pendientes (1)')).toBeInTheDocument();
    expect(screen.getByText('ORD-LIGHT')).toBeInTheDocument();
    // clientName cae al fallback "—" (customer ausente).
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });
});

describe('FinanzasPage — filtro pagosPendientes (status + subEstadoCc)', () => {
  const CC_NOT_CONFIRMED: SubEstadoCc = 'por_confirmar';
  const CC_TERMINAL_NEGATIVO: SubEstadoCc = 'anulado_cc';
  const CC_CONFIRMADO: SubEstadoCc = 'confirmado';
  const CC_REPROGRAMADO: SubEstadoCc = 'reprogramado';
  const CC_CARRITO_RECUPERADO: SubEstadoCc = 'carrito_recuperado';

  /** Pedido de control que siempre cuenta en "Pagos Pendientes" (usado para
   * distinguir un total "(0)" real del "(0)" trivial del primer render). */
  function makeControlOrder() {
    return makeOrderHeader({
      id: 'order-control',
      orderNumber: 'ORD-CONTROL',
      status: 'PREPARADO',
      customer: { ...makeOrderHeader().customer, fullName: 'Control Cuenta' },
    });
  }

  it('incluye un pedido PENDIENTE con pago PENDING (denylist: PENDIENTE ya no se excluye)', async () => {
    // FIX finanzas-pagos: una venta recién registrada nace en PENDIENTE. Con la
    // denylist debe figurar en "Pagos Pendientes" apenas se carga su pago.
    const recienRegistrada = makeOrderHeader({
      id: 'order-pendiente',
      orderNumber: 'ORD-PEND',
      status: 'PENDIENTE',
      customer: { ...makeOrderHeader().customer, fullName: 'Recien Registrada' },
    });

    mockFetchOrdersEndpoints({ orders: [recienRegistrada] });

    render(<FinanzasPage />);

    expect(await screen.findByText('Pagos Pendientes (1)')).toBeInTheDocument();
    expect(screen.getByText('Recien Registrada')).toBeInTheDocument();
  });

  it('excluye una venta PREVENTA con pago PENDING (borrador, no es venta real)', async () => {
    const control = makeControlOrder();
    const preventa = makeOrderHeader({
      id: 'order-preventa',
      orderNumber: 'ORD-PREV',
      status: 'PREVENTA',
      customer: { ...makeOrderHeader().customer, fullName: 'Borrador Preventa' },
    });

    mockFetchOrdersEndpoints({ orders: [control, preventa] });

    render(<FinanzasPage />);

    expect(await screen.findByText('Pagos Pendientes (1)')).toBeInTheDocument();
    expect(screen.getByText('Control Cuenta')).toBeInTheDocument();
    expect(screen.queryByText('Borrador Preventa')).not.toBeInTheDocument();
  });

  it('excluye una venta INCOMPLETE con pago PENDING (borrador)', async () => {
    const control = makeControlOrder();
    const incomplete = makeOrderHeader({
      id: 'order-incomplete',
      orderNumber: 'ORD-INC',
      status: 'INCOMPLETE',
      customer: {
        ...makeOrderHeader().customer,
        fullName: 'Borrador Incomplete',
      },
    });

    mockFetchOrdersEndpoints({ orders: [control, incomplete] });

    render(<FinanzasPage />);

    expect(await screen.findByText('Pagos Pendientes (1)')).toBeInTheDocument();
    expect(screen.getByText('Control Cuenta')).toBeInTheDocument();
    expect(screen.queryByText('Borrador Incomplete')).not.toBeInTheDocument();
  });

  it('excluye un pedido con status ANULADO', async () => {
    const control = makeControlOrder();
    const cancelled = makeOrderHeader({
      id: 'order-anulado',
      orderNumber: 'ORD-ANUL',
      status: 'ANULADO',
      customer: { ...makeOrderHeader().customer, fullName: 'Pedido Anulado' },
    });

    mockFetchOrdersEndpoints({ orders: [control, cancelled] });

    render(<FinanzasPage />);

    expect(await screen.findByText('Pagos Pendientes (1)')).toBeInTheDocument();
    expect(screen.getByText('Control Cuenta')).toBeInTheDocument();
    expect(screen.queryByText('Pedido Anulado')).not.toBeInTheDocument();
  });

  it('cuenta un pedido PREPARADO sin subEstadoCc (sin gestión de Call Center)', async () => {
    const noCcManaged = makeOrderHeader({
      id: 'order-sin-cc',
      orderNumber: 'ORD-SINCC',
      status: 'PREPARADO',
      subEstadoCc: undefined,
      customer: { ...makeOrderHeader().customer, fullName: 'Sin Gestion CC' },
    });

    mockFetchOrdersEndpoints({ orders: [noCcManaged] });

    render(<FinanzasPage />);

    expect(await screen.findByText('Pagos Pendientes (1)')).toBeInTheDocument();
    expect(screen.getByText('Sin Gestion CC')).toBeInTheDocument();
  });

  it('excluye un pedido PREPARADO con subEstadoCc "por_confirmar" (CC no confirmado)', async () => {
    const control = makeControlOrder();
    const notConfirmed = makeOrderHeader({
      id: 'order-por-confirmar',
      orderNumber: 'ORD-PORCONF',
      status: 'PREPARADO',
      subEstadoCc: CC_NOT_CONFIRMED,
      customer: { ...makeOrderHeader().customer, fullName: 'CC Por Confirmar' },
    });

    mockFetchOrdersEndpoints({ orders: [control, notConfirmed] });

    render(<FinanzasPage />);

    expect(await screen.findByText('Pagos Pendientes (1)')).toBeInTheDocument();
    expect(screen.getByText('Control Cuenta')).toBeInTheDocument();
    expect(screen.queryByText('CC Por Confirmar')).not.toBeInTheDocument();
  });

  it('excluye un pedido PREPARADO con subEstadoCc "anulado_cc" (terminal negativo, no es venta real)', async () => {
    const control = makeControlOrder();
    const ccCancelled = makeOrderHeader({
      id: 'order-anulado-cc',
      orderNumber: 'ORD-ANULCC',
      status: 'PREPARADO',
      subEstadoCc: CC_TERMINAL_NEGATIVO,
      customer: { ...makeOrderHeader().customer, fullName: 'CC Anulado' },
    });

    mockFetchOrdersEndpoints({ orders: [control, ccCancelled] });

    render(<FinanzasPage />);

    expect(await screen.findByText('Pagos Pendientes (1)')).toBeInTheDocument();
    expect(screen.getByText('Control Cuenta')).toBeInTheDocument();
    expect(screen.queryByText('CC Anulado')).not.toBeInTheDocument();
  });

  it('cuenta un pedido PREPARADO con subEstadoCc "confirmado"', async () => {
    const confirmed = makeOrderHeader({
      id: 'order-confirmado',
      orderNumber: 'ORD-CONF',
      status: 'PREPARADO',
      subEstadoCc: CC_CONFIRMADO,
      customer: { ...makeOrderHeader().customer, fullName: 'CC Confirmado' },
    });

    mockFetchOrdersEndpoints({ orders: [confirmed] });

    render(<FinanzasPage />);

    expect(await screen.findByText('Pagos Pendientes (1)')).toBeInTheDocument();
    expect(screen.getByText('CC Confirmado')).toBeInTheDocument();
  });

  it('cuenta un pedido con subEstadoCc "reprogramado" (nuevo valor de CC_CONFIRMED_SUBESTADOS)', async () => {
    const reprogramado = makeOrderHeader({
      id: 'order-reprogramado',
      orderNumber: 'ORD-REPROG',
      status: 'PREPARADO',
      subEstadoCc: CC_REPROGRAMADO,
      customer: { ...makeOrderHeader().customer, fullName: 'CC Reprogramado' },
    });

    mockFetchOrdersEndpoints({ orders: [reprogramado] });

    render(<FinanzasPage />);

    expect(await screen.findByText('Pagos Pendientes (1)')).toBeInTheDocument();
    expect(screen.getByText('CC Reprogramado')).toBeInTheDocument();
  });

  it('excluye un pedido ENTREGADO con subEstadoCc "carrito_recuperado" (ya NO está en CC_CONFIRMED_SUBESTADOS)', async () => {
    const control = makeControlOrder();
    const recovered = makeOrderHeader({
      id: 'order-carrito-recuperado',
      orderNumber: 'ORD-CARRITO',
      status: 'ENTREGADO',
      subEstadoCc: CC_CARRITO_RECUPERADO,
      customer: { ...makeOrderHeader().customer, fullName: 'Carrito Recuperado' },
    });

    mockFetchOrdersEndpoints({ orders: [control, recovered] });

    render(<FinanzasPage />);

    expect(await screen.findByText('Pagos Pendientes (1)')).toBeInTheDocument();
    expect(screen.getByText('Control Cuenta')).toBeInTheDocument();
    expect(screen.queryByText('Carrito Recuperado')).not.toBeInTheDocument();
  });
});

describe('FinanzasPage — leads COD del endpoint /leads-cod', () => {
  it('incluye lead con subEstadoCc "reprogramado" y excluye "contactado" / "por_confirmar"', async () => {
    const makeLead = (id: string, name: string, sub: SubEstadoCc) =>
      makeOrderHeader({
        id,
        orderNumber: id.toUpperCase(),
        status: 'PENDIENTE',
        subEstadoCc: sub,
        customer: { ...makeOrderHeader().customer, fullName: name },
      });

    mockFetchOrdersEndpoints({
      leadsCod: [
        makeLead('lead-reprog', 'Lead Reprogramado', 'reprogramado'),
        makeLead('lead-contact', 'Lead Contactado', 'contactado'),
        makeLead('lead-porconf', 'Lead Por Confirmar', 'por_confirmar'),
      ],
    });

    render(<FinanzasPage />);

    expect(await screen.findByText('Pagos Pendientes (1)')).toBeInTheDocument();
    expect(screen.getByText('Lead Reprogramado')).toBeInTheDocument();
    expect(screen.queryByText('Lead Contactado')).not.toBeInTheDocument();
    expect(screen.queryByText('Lead Por Confirmar')).not.toBeInTheDocument();
  });
});
