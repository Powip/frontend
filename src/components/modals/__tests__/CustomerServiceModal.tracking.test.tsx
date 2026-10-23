/* eslint-disable @typescript-eslint/no-require-imports */
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';


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
  useAuth: jest.fn(),
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
jest.mock('@/utils/printCustomerShippingLabel', () => ({ printCustomerShippingLabel: jest.fn() }));
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

jest.mock('@/components/registrar-venta/SaleUnitLifecycleModal', () => ({ __esModule: true, default: ({ action, orderId }: { action: string; orderId: string }) => <div data-testid="lifecycle-flow">{action}:{orderId}</div> }));
jest.mock('@/components/registrar-venta/SaleUnitLifecycleActions', () => ({ SaleUnitLifecycleButtons: () => null }));
jest.mock('@/components/ui/select', () => ({
  Select: ({ children, onValueChange, value, disabled }: any) => <select aria-label="Order status" value={value} disabled={disabled} onChange={(event) => onValueChange(event.target.value)}>{children}</select>,
  SelectTrigger: () => null,
  SelectValue: () => null,
  SelectContent: ({ children }: any) => <>{children}</>,
  SelectItem: ({ children, value }: any) => <option value={value}>{children}</option>,
}));

import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import CustomerServiceModal from '@/components/modals/CustomerServiceModal';

const axios = require('axios');

const base = { id: 'order-1', status: 'PREPARADO', payments: [], courier: 'Local', unitAssignmentStatus: 'NONE' };
const tracked = { ...base, hasTrackedUnits: true, unitCatalogValidated: true, unitAssignmentStatus: 'CONFIRMED', stockVersion: 1, confirmedStockVersion: 1 };
function setup(header: Record<string, unknown>, response: Record<string, unknown>, pendingBalance = 0) {
  const receipt = { orderId: 'order-1', orderNumber: 'ORD-0001', status: header.status, createdAt: '2026-09-01T10:00:00.000Z',
    customer: { fullName: 'Cliente Prueba', phoneNumber: '999999999', address: 'Av. Brasil 500' }, items: header.hasTrackedUnits ? [{ productName: 'Teléfono', quantity: 1, unitPrice: 100, subtotal: 100, discountAmount: 0, units: [{ id: 'unit-1', code: '001234567890123', status: 'RESERVED' }] }] : [], payments: [],
    totals: { productsTotal: 100, taxTotal: 0, shippingTotal: 0, discountTotal: 0, grandTotal: 100, totalPaid: 100 - pendingBalance, pendingAmount: pendingBalance } };
  const impl = (url: string) => {
    if (url.endsWith('/receipt')) return Promise.resolve({ data: receipt });
    if (url.endsWith('/evidence') || url.includes('/log-ventas/')) return Promise.resolve({ data: [] });
    if (url.includes('/order-header/')) return Promise.resolve({ data: header });
    return Promise.reject(new Error('not found'));
  };
  axios.get.mockImplementation(impl);
  axios.default.get.mockImplementation(impl);
  axios.patch.mockResolvedValue({ data: response });
  axios.default.patch.mockResolvedValue({ data: response });
  return render(<CustomerServiceModal open orderId="order-1" onClose={jest.fn()} hideCallManagement shippingGuide={null} />);
}

describe('CustomerServiceModal: tracked status transitions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    require('@/utils/printOrderLabel').printOrderLabel.mockReset().mockResolvedValue(undefined);
    require('@/utils/downloadNotaVentaPdf').downloadNotaVentaPdf.mockReset().mockResolvedValue(undefined);
    require('@/utils/printCustomerShippingLabel').printCustomerShippingLabel.mockReset().mockResolvedValue(undefined);
    jest.mocked(useAuth).mockReturnValue({ auth: { accessToken: 'token', company: { id: 'company-a', stores: [] }, user: { id: 'user-a' } }, hasPermission: () => false } as any);
    process.env.NEXT_PUBLIC_API_VENTAS = 'https://ventas.test';
  });
  async function changeStatus(status: string) {
    const select = await screen.findByRole('combobox', { name: 'Order status' });
    await act(async () => { fireEvent.change(select, { target: { value: status } }); });
  }
  it('shows a legacy paid order as operationally pending with an independent paid badge', async () => {
    setup({ ...base, status: 'PAGADO' }, {});
    expect(await screen.findByRole('combobox', { name: 'Order status' })).toHaveValue('PENDIENTE');
    expect(screen.getByText('Pagado')).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'PAGADO' })).not.toBeInTheDocument();
  });
  it('allows dispatch with debt but blocks delivery when one cent remains unapproved', async () => {
    setup({ ...base, status: 'LLAMADO' }, { ...base, status: 'EN_ENVIO' }, 0.01);
    await changeStatus('EN_ENVIO');
    expect(axios.patch).toHaveBeenCalledWith('https://ventas.test/order-header/order-1', { status: 'EN_ENVIO' });
    axios.patch.mockClear();
    await changeStatus('ENTREGADO');
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('saldo pendiente')));
    expect(axios.patch).not.toHaveBeenCalled();
  });
  it('shows acknowledged quantity hold while blocking preparation without unit assignment', async () => {
    setup({ ...tracked, status: 'PENDIENTE', unitAssignmentStatus: 'PENDING_SELECTION', unitStockState: 'reserved' }, {});
    expect(await screen.findByText('Stock reservado · falta asignar IMEI/serie')).toBeInTheDocument();
    await changeStatus('PREPARADO');
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('falta asignar IMEI/serie')));
    expect(axios.patch).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
  });
  it('opens physical return before cancelling an in-transit tracked order and sends no status patch', async () => {
    setup({ ...tracked, status: 'EN_ENVIO' }, {});
    await changeStatus('ANULADO');
    expect(await screen.findByTestId('lifecycle-flow')).toHaveTextContent('return:order-1');
    expect(axios.patch).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
  });
  it('routes confirmed serial dispatch through the authenticated status endpoint', async () => {
    setup(tracked, { ...tracked, status: 'EN_ENVIO' });
    await changeStatus('EN_ENVIO');
    await waitFor(() => expect(axios.patch).toHaveBeenCalledWith('https://ventas.test/order-header/manual/order-1/status', { status: 'EN_ENVIO' }));
    expect(toast.success).toHaveBeenCalledWith('Estado actualizado a EN_ENVIO');
    expect(axios.get).toHaveBeenCalledWith('https://ventas.test/order-header/manual/order-1/receipt');
    expect(axios.get).not.toHaveBeenCalledWith('https://ventas.test/order-header/order-1/receipt');
    expect(screen.getByText('IMEI / series: 001234567890123')).toBeInTheDocument();
  });
  it('preserves the legacy NONE status endpoint', async () => {
    setup(base, { ...base, status: 'EN_ENVIO' });
    await changeStatus('EN_ENVIO');
    await waitFor(() => expect(axios.patch).toHaveBeenCalledWith('https://ventas.test/order-header/order-1', { status: 'EN_ENVIO' }));
    expect(toast.success).toHaveBeenCalledWith('Estado actualizado a EN_ENVIO');
    expect(axios.get).toHaveBeenCalledWith('https://ventas.test/order-header/order-1/receipt');
  });
  it('loads Angela legacy CC detail and permits preparation with its existing stock', async () => {
    const angela = { ...base, status: 'PENDIENTE', commercialStage: null, subEstadoCc: 'entrega_lima', canalOrigen: null, stockVersion: 1, salesOperationalEligible: false };
    setup(angela, { ...angela, status: 'PREPARADO' });
    expect(await screen.findByRole('heading', { name: 'Productos' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Pagos' })).toBeEnabled();
    expect(axios.get).toHaveBeenCalledWith('https://ventas.test/order-header/order-1/receipt');
    await changeStatus('PREPARADO');
    await waitFor(() => expect(axios.patch).toHaveBeenCalledWith('https://ventas.test/order-header/order-1', { status: 'PREPARADO' }));
    expect(toast.error).not.toHaveBeenCalled();
  });
  it('loads Elisa legacy Shopify CC detail and keeps printing readable without a preparation action', async () => {
    setup({ ...base, status: 'PENDIENTE', commercialStage: null, externalSource: 'shopify', shopifyCommercialGate: true,
      commercialCommittedAt: null, stockVersion: 0, subEstadoCc: 'por_confirmar', canalOrigen: 'shopify_cod', salesOperationalEligible: false }, {});
    expect(await screen.findByRole('heading', { name: 'Productos' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Pagos' })).toBeEnabled();
    expect(axios.get).toHaveBeenCalledWith('https://ventas.test/order-header/order-1/receipt');
    expect(screen.queryByRole('option', { name: 'PREPARADO' })).not.toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'ANULADO' })).toBeInTheDocument();
    expect(screen.getByTitle('Imprimir')).toBeEnabled();
    expect(screen.getByTitle('Descargar PDF')).toBeEnabled();
    await act(async () => { fireEvent.click(screen.getByTitle('Imprimir')); });
    expect(require('@/utils/printOrderLabel').printOrderLabel).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    await act(async () => { fireEvent.click(screen.getByTitle('Descargar PDF')); });
    expect(require('@/utils/downloadNotaVentaPdf').downloadNotaVentaPdf).toHaveBeenCalledTimes(1);
    expect(axios.patch).not.toHaveBeenCalled();
  });
  it('blocks dispatch with a pending reserve without sending a patch', async () => {
    setup({ ...tracked, unitAssignmentStatus: 'PENDING' }, {});
    await changeStatus('EN_ENVIO');
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('pendiente')));
    expect(axios.patch).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
  });
  it('does not announce delivery until the backend acknowledges the unit stock', async () => {
    setup({ ...tracked, status: 'EN_ENVIO' }, { ...tracked, status: 'EN_ENVIO', unitAssignmentStatus: 'PENDING', stockVersion: 2 });
    await changeStatus('ENTREGADO');
    await waitFor(() => expect(toast.warning).toHaveBeenCalledWith(expect.stringContaining('pendiente de confirmación')));
    expect(toast.success).not.toHaveBeenCalled();
    expect(axios.patch).toHaveBeenCalledWith('https://ventas.test/order-header/manual/order-1/status', { status: 'ENTREGADO' });
  });
  it('hides private receipt codes immediately when the active company changes', async () => {
    const view = setup(tracked, { ...tracked, status: 'EN_ENVIO' });
    expect(await screen.findByText('IMEI / series: 001234567890123')).toBeInTheDocument();
    axios.get.mockImplementation(() => new Promise(() => {}));
    jest.mocked(useAuth).mockReturnValue({ auth: { accessToken: 'new-token', company: { id: 'company-b', stores: [] }, user: { id: 'user-a' } }, hasPermission: () => false } as any);
    view.rerender(<CustomerServiceModal open orderId="order-1" onClose={jest.fn()} hideCallManagement shippingGuide={null} />);
    expect(screen.queryByText('IMEI / series: 001234567890123')).not.toBeInTheDocument();
  });

  it('invalidates PDF and label work when its company changes during generation', async () => {
    const pdf=require('@/utils/downloadNotaVentaPdf').downloadNotaVentaPdf;
    const label=require('@/utils/printOrderLabel').printOrderLabel;
    let finishPdf!:()=>void,finishLabel!:()=>void;
    pdf.mockImplementation(()=>new Promise<void>(resolve=>{finishPdf=resolve}));
    label.mockImplementation(()=>new Promise<void>(resolve=>{finishLabel=resolve}));
    const view=setup(tracked,tracked);
    await screen.findByText('IMEI / series: 001234567890123');
    fireEvent.click(screen.getByTitle('Descargar PDF'));
    fireEvent.click(screen.getByTitle('Imprimir'));
    await waitFor(()=>{expect(pdf).toHaveBeenCalled();expect(label).toHaveBeenCalled();});
    const options=[pdf.mock.calls[0][3],label.mock.calls[0][3]];
    expect(options.every(option=>option.isCurrent())).toBe(true);
    axios.get.mockImplementation(()=>new Promise(()=>{}));
    jest.mocked(useAuth).mockReturnValue({auth:{accessToken:'new-token',company:{id:'company-b',stores:[]},user:{id:'user-a'}},hasPermission:()=>false} as any);
    view.rerender(<CustomerServiceModal open orderId="order-1" onClose={jest.fn()} hideCallManagement shippingGuide={null}/>);
    expect(options.every(option=>option.signal.aborted&&!option.isCurrent())).toBe(true);
    await act(async()=>{finishPdf();finishLabel();});
  });

  it.each(['company', 'order', 'close'])('discards print preparation confirmation after %s changes', async (change) => {
    const pending = { ...base, status: 'PENDIENTE' };
    const view = setup(pending, pending);
    await screen.findByTitle('Imprimir');
    await act(async () => { fireEvent.click(screen.getByTitle('Imprimir')); });
    expect(await screen.findByText('¿Se imprimió correctamente el recibo?')).toBeInTheDocument();
    if (change === 'company') jest.mocked(useAuth).mockReturnValue({ auth: { accessToken: 'new-token', company: { id: 'company-b', stores: [] }, user: { id: 'user-a' } }, hasPermission: () => false } as any);
    axios.get.mockImplementation(() => new Promise(() => {}));
    view.rerender(<CustomerServiceModal open={change !== 'close'} orderId={change === 'order' ? 'order-2' : 'order-1'} onClose={jest.fn()} hideCallManagement shippingGuide={null} />);
    expect(screen.queryByText('¿Se imprimió correctamente el recibo?')).not.toBeInTheDocument();
    expect(axios.patch).not.toHaveBeenCalled();
  });

  it('prints the courier label with the same receipt and aborts it when the modal closes', async () => {
    const printShipping = require('@/utils/printCustomerShippingLabel').printCustomerShippingLabel;
    let finish!: () => void;
    printShipping.mockImplementation(() => new Promise<void>(resolve => { finish = resolve; }));
    const view = setup(tracked, tracked);
    await screen.findByText('IMEI / series: 001234567890123');
    const shippingGuide = { id: 'guide-1', guideNumber: 'GS-1', courierName: 'Local', status: 'CREADA', chargeType: 'CONTRA_ENTREGA', amountToCollect: 100, created_at: '2026-10-17T15:00:00.000Z' } as any;
    view.rerender(<CustomerServiceModal open orderId="order-1" onClose={jest.fn()} hideCallManagement shippingGuide={shippingGuide} initialTab="seguimiento" />);
    fireEvent.click(await screen.findByTitle('Imprimir Comprobante de Envío'));
    expect(printShipping).toHaveBeenCalledWith(expect.objectContaining({ orderId: 'order-1' }), shippingGuide, expect.objectContaining({ id: 'company-a' }), expect.any(Object));
    const operation = printShipping.mock.calls[0][3];
    view.rerender(<CustomerServiceModal open={false} orderId="order-1" onClose={jest.fn()} hideCallManagement shippingGuide={shippingGuide} />);
    expect(operation.signal.aborted).toBe(true);
    await act(async () => finish());
  });

});
