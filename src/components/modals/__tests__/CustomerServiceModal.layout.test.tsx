/* eslint-disable @typescript-eslint/no-require-imports */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

/**
 * Modal general «Ver» — «Promo del día» y «Evidencia de despacho» ocupan solo
 * la columna izquierda de la fila Gestión / Historial (arriba de la gestión).
 * Mismos mocks que CustomerServiceModal.maps.
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
jest.mock('@/components/modals/AddProductsModal', () => ({
  __esModule: true,
  default: ({ open }: { open: boolean }) => (open ? <div>Agregar productos abierto</div> : null),
}));
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

function renderModal(hideCallManagement: boolean) {
  return render(
    <CustomerServiceModal
      open
      orderId="order-1"
      onClose={jest.fn()}
      hideCallManagement={hideCallManagement}
      shippingGuide={null}
    />,
  );
}

describe("CustomerServiceModal — Promo del día y Evidencia en la columna izquierda", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockApi(null);
  });

  function lowerRowParts() {
    const historial = screen.getByRole("heading", { name: "Historial / Comentarios" }).closest("div.border");
    const row = historial?.parentElement;
    return { row, leftColumn: row?.firstElementChild, historial };
  }

  it("con Promo visible: Promo y luego Evidencia encabezan la columna izquierda; Historial queda a la derecha", async () => {
    renderModal(false);

    const evidence = (await screen.findByRole("heading", { name: "Evidencia de despacho" })).closest("section");
    const promo = screen.getByText("Promo del día").closest("div");
    const { row, leftColumn, historial } = lowerRowParts();

    expect(row).toHaveClass("grid", "lg:grid-cols-2", "gap-4", "items-start");
    expect(promo?.parentElement).toBe(leftColumn);
    expect(evidence?.parentElement).toBe(leftColumn);
    expect(leftColumn?.firstElementChild).toBe(promo);
    expect(promo?.nextElementSibling).toBe(evidence);
    expect(row?.lastElementChild).toBe(historial);
    expect(leftColumn).toContainElement(screen.getByRole("heading", { name: "Gestión de llamada" }));
    expect(screen.getAllByText("Promo del día")).toHaveLength(1);

    await userEvent.click(screen.getByRole("button", { name: /Agregar/ }));
    expect(screen.getByText("Agregar productos abierto")).toBeInTheDocument();
  });

  it("sin Promo (hideCallManagement): Evidencia sigue solo en la columna izquierda", async () => {
    renderModal(true);

    const evidence = (await screen.findByRole("heading", { name: "Evidencia de despacho" })).closest("section");
    const { row, leftColumn, historial } = lowerRowParts();

    expect(screen.queryByText("Promo del día")).not.toBeInTheDocument();
    expect(row).toHaveClass("grid", "lg:grid-cols-2");
    expect(evidence?.parentElement).toBe(leftColumn);
    expect(row?.lastElementChild).toBe(historial);
  });
});
