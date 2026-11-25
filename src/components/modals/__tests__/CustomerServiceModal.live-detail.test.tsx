/* eslint-disable @typescript-eslint/no-require-imports */
import { render, screen, within } from '@testing-library/react';

/**
 * FEAT-33 A5/A7: el detalle de un pedido muestra el precio normal, el precio de venta y un resumen que se puede
 * sumar a mano; el origen y los canales legibles; y un historial que dice quién hizo cada cosa.
 * Mismos mocks de infraestructura que CustomerServiceModal.envio-agencia.test.tsx.
 */
jest.mock('axios', () => {
  const isAxiosError = (e: unknown) =>
    Boolean(e && (e as { isAxiosError?: boolean }).isAxiosError);
  return {
    default: { get: jest.fn(), patch: jest.fn(), post: jest.fn(), isAxiosError },
    get: jest.fn(),
    patch: jest.fn(),
    post: jest.fn(),
    isAxiosError,
  };
});

jest.mock('@/lib/axiosAuth', () => ({ __esModule: true, default: jest.requireMock('axios') }));

jest.mock('sonner', () => ({
  toast: { success: jest.fn(), error: jest.fn(), warning: jest.fn() },
}));

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), refresh: jest.fn() }),
  usePathname: jest.fn(() => '/ventas'),
}));

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    auth: { accessToken: 'token', company: { stores: [] } },
    hasPermission: () => false,
  }),
}));

jest.mock('@/components/ui/dialog', () => {
  const Dialog = ({ open, children }: { open?: boolean; children?: React.ReactNode }) =>
    open ? <div data-testid="dialog">{children}</div> : null;
  const DialogContent = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  const DialogHeader = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  const DialogTitle = ({ children }: { children?: React.ReactNode }) => <h2>{children}</h2>;
  return { Dialog, DialogContent, DialogHeader, DialogTitle };
});

jest.mock('@/utils/downloadNotaVentaPdf', () => ({ downloadNotaVentaPdf: jest.fn() }));
jest.mock('@/utils/printOrderLabel', () => ({ printOrderLabel: jest.fn() }));
jest.mock('@/hooks/useQrCode', () => ({ useQRCode: () => '' }));
jest.mock('@/hooks/useCcPurchaseConfirmationAccess', () => ({ useCcPurchaseConfirmationAccess: () => ({ canConfirm: false }) }));
jest.mock('@/services/shalomService', () => ({ trackShalomGuide: jest.fn() }));

jest.mock('@/components/modals/CancellationModal', () => ({ __esModule: true, default: () => null }));
jest.mock('@/components/modals/AddProductsModal', () => ({ __esModule: true, default: () => null }));
jest.mock('@/components/modals/PaymentVerificationModal', () => ({ __esModule: true, default: () => null }));
jest.mock('@/components/modals/GuideDetailsModal', () => ({ __esModule: true, default: () => null }));
jest.mock('@/components/modals/ScheduledDeliverySection', () => ({ __esModule: true, default: () => null }));
jest.mock('@/components/modals/ShalomDocumentModal', () => ({ ShalomDocumentCard: () => null }));
jest.mock('@/app/centro-envios/components/ReassignDeliveryModal', () => ({ __esModule: true, default: () => null }));
jest.mock('@/components/atencion-cliente/cc-v2/DatosIncompletosBlock', () => ({ DatosIncompletosBlock: () => null }));
jest.mock('@/components/atencion-cliente/cc-v2/CcGestionPanel', () => ({ CcGestionPanel: () => null }));
jest.mock('@/components/atencion-cliente/cc-v2/CcScriptPanel', () => ({ CcScriptPanel: () => null }));

import CustomerServiceModal from '@/components/modals/CustomerServiceModal';

const axios = require('axios');


type Receipt = Record<string, unknown>;
const liveReceipt = (extra: Receipt = {}): Receipt => ({
  orderId: 'order-1',
  orderNumber: 'ORD-153866',
  status: 'PENDIENTE',
  createdAt: '2026-11-24T10:00:00.000Z',
  salesChannel: 'TIKTOK_LIVE',
  closingChannel: 'POWIP_LIVE',
  externalSource: 'POWIP_LIVE',
  customer: { fullName: 'Milder Vega', phoneNumber: '999999999' },
  items: [
    { productName: 'Casaca polar', sku: 'CP', quantity: 1, unitPrice: 189, discountAmount: 60, subtotal: 129 },
    { productName: 'Blusa', sku: 'BL', quantity: 2, unitPrice: 89, discountAmount: 60, subtotal: 118 },
    { productName: 'Polo', sku: 'PO', quantity: 1, unitPrice: 40, discountAmount: 0, subtotal: 40 },
  ],
  payments: [],
  totals: { productsTotal: 407, taxTotal: 0, shippingTotal: 10, discountTotal: 120, grandTotal: 297, totalPaid: 0, pendingAmount: 297 },
  ...extra,
});

function mockApi(receipt: Receipt, logs: unknown[] = []) {
  const header = { id: 'order-1', status: 'PENDIENTE', payments: [], courier: null };
  const impl = (url: string) => {
    if (url.endsWith('/receipt')) return Promise.resolve({ data: receipt });
    if (url.endsWith('/evidence')) return Promise.resolve({ data: [] });
    if (url.includes('/log-ventas/')) return Promise.resolve({ data: logs });
    if (url.includes('/order-header/')) return Promise.resolve({ data: header });
    return Promise.reject(new Error('not found'));
  };
  axios.get.mockImplementation(impl);
  axios.default.get.mockImplementation(impl);
}

function renderModal() {
  return render(
    <CustomerServiceModal open orderId="order-1" onClose={jest.fn()} hideCallManagement shippingGuide={null} />,
  );
}

const lineOf = (name: string) => screen.getByText(name).closest('[data-testid="detalle-linea"]') as HTMLElement;

describe('CustomerServiceModal — líneas con precio normal y precio de venta (FEAT-33 A5)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('a Live line shows the normal price, the live price in red and price × quantity', async () => {
    mockApi(liveReceipt());
    renderModal();
    await screen.findByText('Casaca polar');

    const casaca = lineOf('Casaca polar');
    expect(within(casaca).getByText('S/189.00')).toBeInTheDocument();
    const live = within(casaca).getByTestId('detalle-precio-venta');
    expect(live).toHaveTextContent('Precio live');
    expect(live).toHaveTextContent('S/129.00 c/u');
    expect(live).toHaveClass('text-red-600');
    expect(within(casaca).getByTestId('detalle-subtotal')).toHaveTextContent('S/129.00');

    const blusa = lineOf('Blusa');
    expect(within(blusa).getByTestId('detalle-precio-venta')).toHaveTextContent('S/59.00 c/u');
    expect(within(blusa).getByTestId('detalle-subtotal')).toHaveTextContent('S/118.00');

    expect(within(lineOf('Polo')).queryByTestId('detalle-precio-venta')).not.toBeInTheDocument();
  });

  it('a discounted line outside Live says «Precio con descuento»', async () => {
    mockApi(liveReceipt({ externalSource: null, closingChannel: 'WEB', salesChannel: 'WEB' }));
    renderModal();
    await screen.findByText('Casaca polar');
    expect(within(lineOf('Casaca polar')).getByTestId('detalle-precio-venta')).toHaveTextContent(
      'Precio con descuento',
    );
  });

  it('the summary reads Productos − Descuentos + Envío = Total, with discounts before the total', async () => {
    mockApi(liveReceipt());
    renderModal();
    const summary = (await screen.findByText('Resumen de Pagos')).parentElement as HTMLElement;
    const rows = within(summary).getAllByTestId('resumen-fila').map((row) => row.textContent);
    expect(rows.slice(0, 5)).toEqual([
      'Productos:S/407.00',
      'Descuentos (precio live):−S/120.00',
      'IGV 18%:S/0.00',
      'Envío:S/10.00',
      'Total:S/297.00',
    ]);
  });
});

describe('CustomerServiceModal — de dónde vino la venta (FEAT-33 A7)', () => {
  beforeEach(() => jest.clearAllMocks());

  it.each([
    ['POWIP_LIVE', 'TIKTOK_LIVE', 'POWIP Live', 'TIKTOK LIVE', 'POWIP LIVE'],
    ['POWIP_LINK', 'WHATSAPP', 'POWIP Link', 'WHATSAPP', 'POWIP LINK'],
  ])('closing %s shows origin, sales and closing channel readable', async (closing, sales, origin, salesText, closingText) => {
    mockApi(liveReceipt({ closingChannel: closing, salesChannel: sales }));
    renderModal();
    expect(await screen.findByText(new RegExp(`^Origen: ${origin}`))).toBeInTheDocument();
    expect(screen.getByText(/Canal Venta/).nextElementSibling).toHaveTextContent(salesText);
    expect(screen.getByText(/Canal Cierre/).nextElementSibling).toHaveTextContent(closingText);
  });

  it('a non-Live order keeps the sales channel as origin', async () => {
    mockApi(liveReceipt({ externalSource: null, closingChannel: 'WEB', salesChannel: 'WEB' }));
    renderModal();
    expect(await screen.findByText(/^Origen: WEB/)).toBeInTheDocument();
  });
});

describe('CustomerServiceModal — historial (FEAT-33 A7)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('says what the buyer, the system and the reviewer did and hides internal codes', async () => {
    mockApi(liveReceipt(), [
      { id: 1, orderId: 'order-1', operacion: 'UPDATE', timestamp: '2026-11-24T10:00:00Z', userId: null, userName: 'Cliente', isSystemGenerated: true, comentarios: 'Separó 3 prendas en el catálogo del live (TikTok)', data: { actor: 'CUSTOMER' } },
      { id: 2, orderId: 'order-1', operacion: 'CREATE_ORDER_WITH_ITEMS', timestamp: '2026-11-24T10:05:00Z', userId: null, userName: 'Sistema', isSystemGenerated: true, comentarios: 'Orden creada desde POWIP Live', data: { actor: 'SYSTEM' } },
      { id: 3, orderId: 'order-1', operacion: 'UPDATE', timestamp: '2026-11-24T10:06:00Z', userId: 'u-1', userName: null, isSystemGenerated: false, comentarios: 'LIVE_ORDER_CANCELLED', data: { action: 'LIVE_ORDER_CANCELLED' } },
      { id: 4, orderId: 'order-1', operacion: 'UPDATE', timestamp: '2026-11-24T10:07:00Z', userId: 'u-1', userName: 'ana@negocio.pe', isSystemGenerated: false, comentarios: 'Pago validado', data: { actor: 'USER' } },
    ]);
    renderModal();
    const separo = (await screen.findByText('Separó 3 prendas en el catálogo del live (TikTok)')).closest('[data-testid="historial-entrada"]') as HTMLElement;
    expect(within(separo).getByTestId('historial-actor')).toHaveTextContent('Cliente');
    expect(within(separo).queryByText('Sistema')).not.toBeInTheDocument();

    const creada = screen.getByText('Orden creada desde POWIP Live').closest('[data-testid="historial-entrada"]') as HTMLElement;
    expect(within(creada).getByTestId('historial-actor')).toHaveTextContent('Sistema');

    const validado = screen.getByText('Pago validado').closest('[data-testid="historial-entrada"]') as HTMLElement;
    expect(within(validado).getByText('ana@negocio.pe')).toBeInTheDocument();

    expect(screen.queryByText('LIVE_ORDER_CANCELLED')).not.toBeInTheDocument();
  });
});
