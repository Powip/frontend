/* eslint-disable @typescript-eslint/no-require-imports */
import { render, screen, within } from '@testing-library/react';

/**
 * Modal general «Ver», tarjeta Cliente — «Método de envío» (orderHeader.courier) y
 * «Agencia de recojo» (receipt.delivery.agency) bajo «Tipo». Sin dato muestran «-».
 * Mismos mocks de infraestructura que CustomerServiceModal.maps.test.tsx.
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

function mockApi(opts: { courier?: string | null; agency?: string | null; snapshotAgency?: string | null }) {
  const receipt = {
    orderId: 'order-1',
    orderNumber: 'ORD-0001',
    status: 'PENDIENTE',
    createdAt: '2026-09-01T10:00:00.000Z',
    customer: { fullName: 'Cliente Prueba', phoneNumber: '999999999', address: 'Av. Brasil 500' },
    ...(opts.agency
      ? { delivery: { type: 'AGENCY', department: 'LIMA', province: 'LIMA', district: 'JESUS MARIA', address: 'Av. Brasil 500', agency: opts.agency } }
      : {}),
    items: [],
    payments: [],
    totals: { productsTotal: 100, taxTotal: 0, shippingTotal: 0, discountTotal: 0, grandTotal: 100, totalPaid: 100, pendingAmount: 0 },
  };
  const header = {
    id: 'order-1',
    status: 'PENDIENTE',
    payments: [],
    courier: opts.courier ?? null,
    ...(opts.snapshotAgency ? { deliverySnapshot: { agency: opts.snapshotAgency } } : {}),
  };
  const impl = (url: string) => {
    if (url.endsWith('/receipt')) return Promise.resolve({ data: receipt });
    if (url.endsWith('/evidence')) return Promise.resolve({ data: [] });
    if (url.includes('/log-ventas/')) return Promise.resolve({ data: [] });
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

describe('CustomerServiceModal — Método de envío y Agencia de recojo', () => {
  beforeEach(() => jest.clearAllMocks());

  it('con agencia Shalom: muestra courier y agencia, entre Tipo y Canal Venta', async () => {
    mockApi({ courier: 'Shalom', agency: 'SHALOM - JESUS MARIA' });
    renderModal();

    const metodo = await screen.findByTestId('detalle-metodo-envio');
    const agencia = screen.getByTestId('detalle-agencia-recojo');
    expect(metodo).toHaveTextContent('Método de envío: Shalom');
    expect(agencia).toHaveTextContent('Agencia de recojo: SHALOM - JESUS MARIA');
    expect(within(metodo).getByText('Shalom')).toHaveClass('font-medium');
    expect(within(metodo).getByText(/Método de envío/)).toHaveClass('text-muted-foreground');

    const tipo = screen.getByText('Tipo:', { exact: false });
    const canal = screen.getByText(/Canal Venta/);
    expect(tipo.compareDocumentPosition(metodo) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(agencia.compareDocumentPosition(canal) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('sin courier ni agencia: ambas filas muestran «-»', async () => {
    mockApi({ courier: null, agency: null });
    renderModal();

    const metodo = await screen.findByTestId('detalle-metodo-envio');
    expect(metodo).toHaveTextContent(/^Método de envío:\s*-$/);
    expect(screen.getByTestId('detalle-agencia-recojo')).toHaveTextContent(/^Agencia de recojo:\s*-$/);
  });

  it('con courier pero sin agencia: courier visible y agencia «-»', async () => {
    mockApi({ courier: 'Shalom', agency: null });
    renderModal();

    expect(await screen.findByTestId('detalle-metodo-envio')).toHaveTextContent('Método de envío: Shalom');
    expect(screen.getByTestId('detalle-agencia-recojo')).toHaveTextContent(/^Agencia de recojo:\s*-$/);
  });

  it('si el comprobante no trae delivery, usa deliverySnapshot.agency del pedido', async () => {
    mockApi({ courier: 'Shalom', agency: null, snapshotAgency: 'SHALOM - SURCO' });
    renderModal();

    expect(await screen.findByTestId('detalle-agencia-recojo')).toHaveTextContent('Agencia de recojo: SHALOM - SURCO');
  });
});
