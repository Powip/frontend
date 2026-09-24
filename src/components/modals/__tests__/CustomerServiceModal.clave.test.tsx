/* eslint-disable @typescript-eslint/no-require-imports */
import { render, screen, waitFor } from '@testing-library/react';

jest.mock('axios', () => {
  const isAxiosError = (e: unknown) =>
    Boolean(e && (e as { isAxiosError?: boolean }).isAxiosError);
  return {
    default: {
      get: jest.fn(),
      patch: jest.fn(),
      post: jest.fn(),
      isAxiosError,
    },
    get: jest.fn(),
    patch: jest.fn(),
    post: jest.fn(),
    isAxiosError,
  };
});

jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
    warning: jest.fn(),
  },
}));

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), refresh: jest.fn() }),
  usePathname: jest.fn(() => '/ventas'),
}));

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ auth: { accessToken: 'token', company: { stores: [] } } }),
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

const CLAVE = 'CLAVE-9876';

function buildReceipt(pendingAmount: number, shippingKey: string) {
  return {
    orderId: 'order-1',
    orderNumber: 'ORD-0001',
    status: 'PENDIENTE',
    createdAt: '2026-09-01T10:00:00.000Z',
    customer: { fullName: 'Cliente Prueba', phoneNumber: '999999999' },
    items: [],
    payments: [],
    totals: {
      productsTotal: 100,
      taxTotal: 0,
      shippingTotal: 0,
      discountTotal: 0,
      grandTotal: 100,
      totalPaid: 100 - pendingAmount,
      pendingAmount,
    },
    externalTrackingNumber: 'TRK-1',
    shippingCode: 'COD-1',
    shippingKey,
    shippingOffice: 'Oficina Centro',
  };
}

function mockApi(pendingAmount: number, shippingKey: string = CLAVE) {
  const impl = (url: string) => {
    if (url.endsWith('/receipt')) return Promise.resolve({ data: buildReceipt(pendingAmount, shippingKey) });
    if (url.includes('/log-ventas/')) return Promise.resolve({ data: [] });
    if (url.includes('/order-header/')) {
      return Promise.resolve({ data: { id: 'order-1', status: 'PENDIENTE', payments: [] } });
    }
    return Promise.reject(new Error('not found'));
  };
  axios.get.mockImplementation(impl);
  axios.default.get.mockImplementation(impl);
}

function renderModal(showTracking: boolean) {
  return render(
    <CustomerServiceModal
      open
      orderId="order-1"
      onClose={jest.fn()}
      hideCallManagement
      shippingGuide={null}
      showTracking={showTracking}
    />,
  );
}

describe('CustomerServiceModal — visibilidad de la clave', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('showTracking=false con saldo pendiente: no muestra la clave y muestra el bloqueo', async () => {
    mockApi(40);
    renderModal(false);

    expect(await screen.findByText('Clave de recojo bloqueada')).toBeInTheDocument();
    expect(screen.getByText('Pendiente de cobro · S/ 40.00')).toBeInTheDocument();
    expect(screen.getByText('TRK-1')).toBeInTheDocument();
    expect(screen.queryByText(CLAVE)).not.toBeInTheDocument();
  });

  it.each([false, true])(
    'showTracking=%s con saldo pendiente y sin clave: no muestra la card bloqueada',
    async (showTracking) => {
      mockApi(40, '');
      renderModal(showTracking);

      if (showTracking) {
        expect(await screen.findByDisplayValue('TRK-1')).toBeInTheDocument();
      } else {
        expect(await screen.findByText('TRK-1')).toBeInTheDocument();
      }
      expect(screen.queryByText('Clave de recojo bloqueada')).not.toBeInTheDocument();
      expect(screen.queryByText('Registrar cobranza')).not.toBeInTheDocument();
      expect(screen.queryByPlaceholderText('Clave...')).not.toBeInTheDocument();
    },
  );

  it('showTracking=false sin saldo pendiente: muestra la clave', async () => {
    mockApi(0);
    renderModal(false);

    expect(await screen.findByText(CLAVE)).toBeInTheDocument();
    expect(screen.queryByText('Clave de recojo bloqueada')).not.toBeInTheDocument();
  });

  it('showTracking=true con saldo pendiente: la clave sigue bloqueada', async () => {
    mockApi(40);
    renderModal(true);

    expect(await screen.findByText('Clave de recojo bloqueada')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByDisplayValue(CLAVE)).not.toBeInTheDocument());
    expect(screen.queryByText(CLAVE)).not.toBeInTheDocument();
  });
});
