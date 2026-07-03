/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Tests: ShalomOrderTrackingView
 *
 * Comportamiento verificado:
 * 1. Filtro normalizado: órdenes con courier/shippingOffice que `isShalomCourier()` reconoce
 *    (SHALOM, shalom con espacio, Shalom via shippingOffice) aparecen en tabla;
 *    courier Olva no aparece; Shalom con shalomStatus null no aparece.
 * 2. Banner con fallidos: con N órdenes FALLIDO se muestra el banner con contador;
 *    click en "Ver fallidos" filtra la tabla dejando solo las fallidas.
 * 3. Banner ausente: sin órdenes FALLIDO el banner no se renderiza.
 * 4. shalomError visible: una orden FALLIDO con shalomError muestra ese texto en su fila.
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ── Mocks de infraestructura ──────────────────────────────────────────────────

jest.mock('axios', () => ({
  default: {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
    defaults: { withCredentials: false },
  },
  get: jest.fn(),
  post: jest.fn(),
  patch: jest.fn(),
  defaults: { withCredentials: false },
}));

jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
    warning: jest.fn(),
    info: jest.fn(),
  },
}));

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: jest.fn(),
}));

jest.mock('@/services/shalomService', () => ({
  trackShalomShipment: jest.fn().mockResolvedValue({}),
}));

// Mock de variables de entorno
process.env.NEXT_PUBLIC_API_VENTAS = 'http://ventas';
process.env.NEXT_PUBLIC_API_COURIER = 'http://courier';

// Mock de lucide-react para evitar compilación de SVGs en jsdom
jest.mock('lucide-react', () => ({
  Search: () => null,
  Truck: () => null,
  FileText: () => null,
  DollarSign: () => null,
  MessageCircle: () => null,
  Lock: () => null,
  Eye: () => null,
  EyeOff: () => null,
  RefreshCw: () => null,
  Check: () => null,
  X: () => null,
  Edit2: () => null,
  ClipboardList: () => null,
  Link2: () => null,
  FileSpreadsheet: () => null,
  AlertTriangle: ({ className }: { className?: string }) => (
    <span data-testid="alert-triangle" className={className} />
  ),
}));

// Mock de componentes pesados que abren portales o hacen fetch propio
jest.mock('@/components/modals/CustomerServiceModal', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('@/components/modals/GuideDetailsModal', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('@/components/modals/ShippingNotesModal', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('@/components/modals/PaymentVerificationModal', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('@/components/modals/ShalomPremiumTrackingModal', () => ({
  __esModule: true,
  default: () => null,
}));

// Mock del PeriodSelector — componente con lógica de calendario
jest.mock('@/components/dashboard/PeriodSelector', () => ({
  PeriodSelector: ({ onPeriodChange }: { onPeriodChange: (from: string | null, to: string | null) => void }) => (
    <button onClick={() => onPeriodChange(null, null)}>Período</button>
  ),
}));

// ── Imports bajo prueba (después de los mocks) ────────────────────────────────

import axios from 'axios';
import { useAuth } from '@/contexts/AuthContext';
import ShalomOrderTrackingView from '../ShalomOrderTrackingView';

// ── Casts ─────────────────────────────────────────────────────────────────────

// La factory del mock no declara __esModule: true, por lo que con esModuleInterop
// ts-jest entrega el objeto completo de la factory cuando el componente hace
// `import axios from 'axios'`. axios.get en el test = lo que el componente llama.
const mockAxiosGet = axios.get as jest.Mock;
const mockUseAuth = jest.mocked(useAuth);

// ── Fixtures ──────────────────────────────────────────────────────────────────

const MOCK_AUTH = {
  auth: {
    accessToken: 'fake-token',
    user: { id: 'user-1', email: 'test@test.com', role: 'ADMIN', permissions: [] },
    company: { id: 'company-1', name: 'Test Company' },
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

/** Fábrica de OrderHeader mínimo para tests */
function makeOrder(overrides: {
  id?: string;
  orderNumber?: string;
  courier?: string | null;
  shippingOffice?: string | null;
  // Usar undefined para el default (PENDIENTE); pasar null explícitamente para testear null
  shalomStatus?: string | null;
  shalomError?: string | null;
  guideNumber?: string | null;
} = {}) {
  // Para shalomStatus usamos 'in' para distinguir entre ausente (default PENDIENTE) y null explícito
  const shalomStatus = 'shalomStatus' in overrides ? overrides.shalomStatus : 'PENDIENTE';
  return {
    id: overrides.id ?? 'order-1',
    orderNumber: overrides.orderNumber ?? 'ORD-001',
    courier: 'courier' in overrides ? overrides.courier : 'Shalom',
    shippingOffice: overrides.shippingOffice ?? null,
    shalomStatus,
    shalomError: overrides.shalomError ?? null,
    guideNumber: overrides.guideNumber ?? null,
    receiptType: 'BOLETA',
    orderType: 'VENTA',
    storeId: 'store-1',
    customer: {
      id: 'cust-1',
      companyId: 'company-1',
      documentType: 'DNI',
      documentNumber: '12345678',
      fullName: 'Cliente Test',
      phoneNumber: '987654321',
      clientType: 'TRADICIONAL',
      province: 'Lima',
      city: 'Lima',
      district: 'Miraflores',
      address: 'Av. Test 123',
      reference: null,
      latitude: null,
      longitude: null,
      isActive: true,
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01',
    },
    salesChannel: 'WHATSAPP',
    closingChannel: 'WHATSAPP',
    deliveryType: 'DOMICILIO',
    courierId: null,
    subtotal: '100.00',
    taxTotal: '0.00',
    shippingTotal: '10.00',
    discountTotal: '0.00',
    grandTotal: '110.00',
    status: 'EN_ENVIO',
    salesRegion: 'LIMA',
    cancellationReason: null,
    notes: null,
    items: [],
    payments: [],
    externalTrackingNumber: null,
    shippingCode: null,
    shippingKey: null,
    trackingUrl: null,
    shalomOriginAgency: null,
    shalomDestinationAgency: null,
    shalomRecipientDoc: null,
    shalomRecipientPhone: null,
    shalomContent: null,
    shalomSerie: null,
    created_at: '2024-01-15T00:00:00.000Z',
    updated_at: '2024-01-15T00:00:00.000Z',
  };
}

/** Configura axios.get para devolver la lista de órdenes provista */
function mockOrdersResponse(orders: ReturnType<typeof makeOrder>[]) {
  mockAxiosGet.mockImplementation((url: string) => {
    if (typeof url === 'string' && url.includes('order-header')) {
      return Promise.resolve({ data: orders });
    }
    // Llamadas a guías de envío devuelven 404 por defecto
    return Promise.reject(new Error('Not found'));
  });
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  mockUseAuth.mockReturnValue(MOCK_AUTH as unknown as ReturnType<typeof useAuth>);
  // Por defecto: lista vacía de órdenes
  mockOrdersResponse([]);
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ShalomOrderTrackingView', () => {
  // ── 1. Filtro normalizado ───────────────────────────────────────────────────

  describe('filtro normalizado de courier Shalom', () => {
    it('muestra una orden con courier "SHALOM" (mayúsculas)', async () => {
      mockOrdersResponse([
        makeOrder({ id: 'o1', orderNumber: 'ORD-SHALOM-UP', courier: 'SHALOM', shalomStatus: 'PENDIENTE' }),
      ]);
      render(<ShalomOrderTrackingView />);
      expect(await screen.findByText('ORD-SHALOM-UP')).toBeInTheDocument();
    });

    it('muestra una orden con courier "shalom " (minúsculas con espacio)', async () => {
      mockOrdersResponse([
        makeOrder({ id: 'o2', orderNumber: 'ORD-SHALOM-LOWER', courier: 'shalom ', shalomStatus: 'PENDIENTE' }),
      ]);
      render(<ShalomOrderTrackingView />);
      expect(await screen.findByText('ORD-SHALOM-LOWER')).toBeInTheDocument();
    });

    it('muestra una orden con shippingOffice "Shalom" aunque courier sea null', async () => {
      mockOrdersResponse([
        makeOrder({ id: 'o3', orderNumber: 'ORD-OFFICE', courier: null, shippingOffice: 'Shalom', shalomStatus: 'EXITOSO' }),
      ]);
      render(<ShalomOrderTrackingView />);
      expect(await screen.findByText('ORD-OFFICE')).toBeInTheDocument();
    });

    it('NO muestra una orden con courier "Olva"', async () => {
      mockOrdersResponse([
        makeOrder({ id: 'o4', orderNumber: 'ORD-OLVA', courier: 'Olva', shalomStatus: 'PENDIENTE' }),
      ]);
      render(<ShalomOrderTrackingView />);
      // La orden de Olva es filtrada: el fetch termina mostrando el empty state
      expect(await screen.findByText('No hay órdenes Shalom')).toBeInTheDocument();
      expect(screen.queryByText('ORD-OLVA')).not.toBeInTheDocument();
    });

    it('NO muestra una orden Shalom con shalomStatus null', async () => {
      mockOrdersResponse([
        makeOrder({ id: 'o5', orderNumber: 'ORD-NULL-STATUS', courier: 'Shalom', shalomStatus: null }),
      ]);
      render(<ShalomOrderTrackingView />);
      // La orden sin shalomStatus es filtrada: el fetch termina mostrando el empty state
      expect(await screen.findByText('No hay órdenes Shalom')).toBeInTheDocument();
      expect(screen.queryByText('ORD-NULL-STATUS')).not.toBeInTheDocument();
    });

    it('muestra el estado vacío cuando no hay órdenes Shalom', async () => {
      mockOrdersResponse([]);
      render(<ShalomOrderTrackingView />);
      expect(await screen.findByText('No hay órdenes Shalom')).toBeInTheDocument();
    });
  });

  // ── 2. Banner con fallidos ──────────────────────────────────────────────────

  describe('banner de despachos fallidos', () => {
    it('muestra el banner con el contador correcto cuando hay 2 órdenes FALLIDO', async () => {
      mockOrdersResponse([
        makeOrder({ id: 'f1', orderNumber: 'ORD-FAIL-1', shalomStatus: 'FALLIDO' }),
        makeOrder({ id: 'f2', orderNumber: 'ORD-FAIL-2', shalomStatus: 'FALLIDO' }),
        makeOrder({ id: 'ok1', orderNumber: 'ORD-OK-1', shalomStatus: 'PENDIENTE' }),
      ]);
      render(<ShalomOrderTrackingView />);
      // El banner muestra "2 despachos fallidos"
      expect(await screen.findByText(/2 despachos fallidos/i)).toBeInTheDocument();
    });

    it('muestra el botón "Ver fallidos" dentro del banner', async () => {
      mockOrdersResponse([
        makeOrder({ id: 'f1', orderNumber: 'ORD-FAIL-1', shalomStatus: 'FALLIDO' }),
      ]);
      render(<ShalomOrderTrackingView />);
      expect(await screen.findByRole('button', { name: /ver fallidos/i })).toBeInTheDocument();
    });

    it('click en "Ver fallidos" filtra la tabla dejando solo las órdenes FALLIDO', async () => {
      mockOrdersResponse([
        makeOrder({ id: 'f1', orderNumber: 'ORD-FAIL-1', shalomStatus: 'FALLIDO' }),
        makeOrder({ id: 'f2', orderNumber: 'ORD-FAIL-2', shalomStatus: 'FALLIDO' }),
        makeOrder({ id: 'ok1', orderNumber: 'ORD-OK-1', shalomStatus: 'PENDIENTE' }),
      ]);
      render(<ShalomOrderTrackingView />);

      // Esperar a que carguen todas las órdenes
      expect(await screen.findByText('ORD-OK-1')).toBeInTheDocument();
      expect(screen.getByText('ORD-FAIL-1')).toBeInTheDocument();
      expect(screen.getByText('ORD-FAIL-2')).toBeInTheDocument();

      // Click en "Ver fallidos"
      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: /ver fallidos/i }));

      // Solo deben verse las órdenes FALLIDO
      await waitFor(() => {
        expect(screen.getByText('ORD-FAIL-1')).toBeInTheDocument();
        expect(screen.getByText('ORD-FAIL-2')).toBeInTheDocument();
        expect(screen.queryByText('ORD-OK-1')).not.toBeInTheDocument();
      });
    });

    it('al aplicar el filtro FALLIDO el banner desaparece', async () => {
      mockOrdersResponse([
        makeOrder({ id: 'f1', orderNumber: 'ORD-FAIL-1', shalomStatus: 'FALLIDO' }),
      ]);
      render(<ShalomOrderTrackingView />);

      // Esperar banner y hacer click
      const verFallidosBtn = await screen.findByRole('button', { name: /ver fallidos/i });
      const user = userEvent.setup();
      await user.click(verFallidosBtn);

      // El banner debe desaparecer (porque guideStatusFilter === 'FALLIDO')
      await waitFor(() => {
        expect(screen.queryByRole('button', { name: /ver fallidos/i })).not.toBeInTheDocument();
      });
    });

    it('usa el plural correcto "despachos" para 2 fallidos', async () => {
      mockOrdersResponse([
        makeOrder({ id: 'f1', orderNumber: 'ORD-F1', shalomStatus: 'FALLIDO' }),
        makeOrder({ id: 'f2', orderNumber: 'ORD-F2', shalomStatus: 'FALLIDO' }),
      ]);
      render(<ShalomOrderTrackingView />);
      expect(await screen.findByText(/2 despachos fallidos/i)).toBeInTheDocument();
    });

    it('usa el singular "despacho" para 1 fallido', async () => {
      mockOrdersResponse([
        makeOrder({ id: 'f1', orderNumber: 'ORD-F1', shalomStatus: 'FALLIDO' }),
      ]);
      render(<ShalomOrderTrackingView />);
      // "1 despacho fallido" (sin "s")
      expect(await screen.findByText(/1 despacho fallido/i)).toBeInTheDocument();
    });
  });

  // ── 3. Banner ausente ───────────────────────────────────────────────────────

  describe('banner ausente cuando no hay fallidos', () => {
    it('NO muestra el banner cuando todas las órdenes son PENDIENTE', async () => {
      mockOrdersResponse([
        makeOrder({ id: 'o1', orderNumber: 'ORD-OK', shalomStatus: 'PENDIENTE' }),
      ]);
      render(<ShalomOrderTrackingView />);
      // Esperar a que cargue la orden (loading terminado)
      expect(await screen.findByText('ORD-OK')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /ver fallidos/i })).not.toBeInTheDocument();
    });

    it('NO muestra el banner cuando la lista está vacía', async () => {
      mockOrdersResponse([]);
      render(<ShalomOrderTrackingView />);
      expect(await screen.findByText('No hay órdenes Shalom')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /ver fallidos/i })).not.toBeInTheDocument();
    });

    it('NO muestra el banner cuando solo hay órdenes ENTREGADO', async () => {
      mockOrdersResponse([
        makeOrder({ id: 'o1', orderNumber: 'ORD-ENT', shalomStatus: 'ENTREGADO' }),
      ]);
      render(<ShalomOrderTrackingView />);
      expect(await screen.findByText('ORD-ENT')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /ver fallidos/i })).not.toBeInTheDocument();
    });
  });

  // ── 4. shalomError visible en fila FALLIDO ──────────────────────────────────

  describe('shalomError visible en filas FALLIDO', () => {
    it('muestra el shalomError en la fila de una orden FALLIDO', async () => {
      mockOrdersResponse([
        makeOrder({
          id: 'fe1',
          orderNumber: 'ORD-ERR',
          shalomStatus: 'FALLIDO',
          shalomError: 'Agencia inválida',
        }),
      ]);
      render(<ShalomOrderTrackingView />);
      // El texto del error debe aparecer en la fila
      expect(await screen.findByText('Agencia inválida')).toBeInTheDocument();
    });

    it('el shalomError tiene el atributo title con el texto completo (tooltip)', async () => {
      const errorMessage = 'Agencia inválida';
      mockOrdersResponse([
        makeOrder({
          id: 'fe2',
          orderNumber: 'ORD-ERR-TITLE',
          shalomStatus: 'FALLIDO',
          shalomError: errorMessage,
        }),
      ]);
      render(<ShalomOrderTrackingView />);
      // Esperar que aparezca el texto del error
      const errorSpan = await screen.findByText(errorMessage);
      expect(errorSpan).toHaveAttribute('title', errorMessage);
    });

    it('NO muestra el shalomError cuando la orden es PENDIENTE', async () => {
      mockOrdersResponse([
        makeOrder({
          id: 'pe1',
          orderNumber: 'ORD-PEND',
          shalomStatus: 'PENDIENTE',
          shalomError: null,
        }),
      ]);
      render(<ShalomOrderTrackingView />);
      expect(await screen.findByText('ORD-PEND')).toBeInTheDocument();
      // No debe haber ningún span con error
      expect(screen.queryByText('Agencia inválida')).not.toBeInTheDocument();
    });

    it('NO muestra el elemento de shalomError cuando el campo es null en una orden FALLIDO', async () => {
      mockOrdersResponse([
        makeOrder({
          id: 'fe3',
          orderNumber: 'ORD-NO-ERR',
          shalomStatus: 'FALLIDO',
          shalomError: null,
        }),
      ]);
      render(<ShalomOrderTrackingView />);
      expect(await screen.findByText('ORD-NO-ERR')).toBeInTheDocument();
      // El badge FALLIDO aparece pero no hay texto de error adicional
      expect(screen.queryByTitle(/agencia/i)).not.toBeInTheDocument();
    });
  });
});
