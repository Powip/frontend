/* eslint-disable @typescript-eslint/no-require-imports */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

/**
 * Modal general «Ver» — "Ubicación en Google Maps" junto a la dirección,
 * leída de receipt.customer.googleMapsUrl (/order-header/:id/receipt).
 * Mismos mocks de infraestructura que CustomerServiceModal.clave.test.tsx.
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

const MAPS_URL =
  'https://www.google.com/maps/place/Av.+Brasil+500,+Jes%C3%BAs+Mar%C3%ADa/@-12.07,-77.05,17z/data=!3m1!4b1?entry=ttu&g_ep=EgoyMDI2';

function mockApi(googleMapsUrl: string | null) {
  const receipt = {
    orderId: 'order-1',
    orderNumber: 'ORD-0001',
    status: 'PENDIENTE',
    createdAt: '2026-09-01T10:00:00.000Z',
    customer: {
      fullName: 'Cliente Prueba',
      phoneNumber: '999999999',
      address: 'Av. Brasil 500',
      googleMapsUrl,
    },
    items: [],
    payments: [],
    totals: {
      productsTotal: 100,
      taxTotal: 0,
      shippingTotal: 0,
      discountTotal: 0,
      grandTotal: 100,
      totalPaid: 100,
      pendingAmount: 0,
    },
  };
  const impl = (url: string) => {
    if (url.endsWith('/receipt')) return Promise.resolve({ data: receipt });
    if (url.endsWith('/evidence')) return Promise.resolve({ data: [] });
    if (url.includes('/log-ventas/')) return Promise.resolve({ data: [] });
    if (url.includes('/order-header/')) {
      return Promise.resolve({ data: { id: 'order-1', status: 'PENDIENTE', payments: [] } });
    }
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

describe('CustomerServiceModal — Ubicación en Google Maps', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: jest.fn().mockResolvedValue(undefined) },
      configurable: true,
    });
  });

  it('con enlace: lo muestra junto a la dirección, lo abre en pestaña nueva y copia la URL completa', async () => {
    mockApi(MAPS_URL);
    renderModal();

    const link = await screen.findByRole('link', { name: /Abrir ubicación en Google Maps/ });
    expect(screen.getByText(/Ubicación en Google Maps/)).toBeInTheDocument();
    expect(link).toHaveTextContent(MAPS_URL);
    expect(link).toHaveAttribute('target', '_blank');

    await userEvent.click(screen.getByRole('button', { name: 'Copiar enlace de Google Maps' }));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(MAPS_URL);
  });

  it('sin enlace: no hay enlace ni botón de copiar', async () => {
    mockApi(null);
    renderModal();

    expect(await screen.findByText(/Ubicación en Google Maps/)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Google Maps/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Copiar enlace de Google Maps' })).not.toBeInTheDocument();
  });
});
