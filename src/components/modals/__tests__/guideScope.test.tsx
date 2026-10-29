import { render as renderRTL, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactElement } from 'react';
import userEvent from '@testing-library/user-event';
import CreateGuideModal from '../CreateGuideModal';
import AddToExistingGuideModal from '../AddToExistingGuideModal';
import { useBusinessGuides } from '@/hooks/useBusinessGuides';
import { fetchCouriers } from '@/services/courierService';

jest.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ auth: { company: { id: 'company', stores: [{ id: 'web' }, { id: 'livii' }, { id: 'kunca' }] }, accessToken: 'token' } }) }));
jest.mock('@/services/courierService', () => ({ fetchCouriers: jest.fn().mockResolvedValue([{ id: 'courier-one', name: 'Courier One' }]) }));
jest.mock('@/hooks/useBusinessGuides', () => ({ useBusinessGuides: jest.fn() }));
const selected = { id: 'selected-web-order', storeId: 'web', inventoryId: 'shared-inventory', stockStoreId: 'kunca', orderNumber: 'WEB-ONE', clientName: 'Cliente', address: 'Dirección', district: 'Distrito', total: 20, pendingPayment: 20, zone: 'PROVINCIAS' };
let queryClient: QueryClient;
function render(element: ReactElement) {
  return renderRTL(<QueryClientProvider client={queryClient}>{element}</QueryClientProvider>);
}
const retryGuides = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  queryClient.setQueryData(["business-orders", "company", "user", ["web"]], []);
  queryClient.setQueryData(["business-guides", "company", "user", ["web"]], []);
  jest.mocked(useBusinessGuides).mockReturnValue({ guides: [], loading: false, error: false, retry: retryGuides, refetch: retryGuides });
});

describe('guide actions keep the selected orders source', () => {
  it('shows a courier load failure and can retry to create a guide with the real Shalom ID', async () => {
    jest.mocked(fetchCouriers).mockRejectedValueOnce(new Error('503')).mockResolvedValueOnce([
      { id: 'real-shalom-id', name: 'Shalom', companyId: 'company', isActive: true, created_at: '2026-10-12T12:00:00Z' },
    ]);
    const confirm = jest.fn().mockResolvedValue(undefined);
    render(<CreateGuideModal open onClose={jest.fn()} selectedOrders={[selected]} storeId="kunca" onConfirm={confirm} defaultCourierName=" SHALOM " />);
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudieron cargar los couriers.');
    const submit = screen.getByRole('button', { name: /generar guía/i });
    expect(submit).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: /reintentar/i }));
    await waitFor(() => expect(submit).toBeEnabled());
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    await userEvent.click(submit);
    expect(confirm).toHaveBeenCalledWith([expect.objectContaining({
      storeId: 'web', courierId: 'real-shalom-id', courierName: 'Shalom',
    })]);
  });

  it('retains the generic Otros method when the company has an empty courier catalogue', async () => {
    jest.mocked(fetchCouriers).mockResolvedValueOnce([]);
    const confirm = jest.fn().mockResolvedValue(undefined);
    render(<CreateGuideModal open onClose={jest.fn()} selectedOrders={[selected]} storeId="kunca" onConfirm={confirm} defaultCourierName="OTROS" />);
    const submit = screen.getByRole('button', { name: /generar guía/i });
    await waitFor(() => expect(submit).toBeEnabled());
    await userEvent.click(submit);
    expect(confirm).toHaveBeenCalledWith([expect.objectContaining({ courierName: 'Otros', courierId: undefined })]);
  });

  it('creates a WEB guide even while KUNCA is selected as the global destination', async () => {
    const confirm = jest.fn().mockResolvedValue(undefined);
    render(<CreateGuideModal open onClose={jest.fn()} selectedOrders={[selected]} storeId="kunca" onConfirm={confirm} defaultCourierId="courier-one" />);
    const submit = screen.getByRole('button', { name: /generar guía/i });
    await waitFor(() => expect(submit).toBeEnabled());
    await userEvent.click(submit);
    expect(confirm).toHaveBeenCalledWith([expect.objectContaining({ storeId: 'web', orderIds: ['selected-web-order'] })]);
    await waitFor(() => expect(queryClient.getQueriesData({ queryKey: ['business-orders'] }).every(([key]) => queryClient.getQueryState(key)?.isInvalidated)).toBe(true));
    expect(queryClient.getQueriesData({ queryKey: ['business-guides'] }).every(([key]) => queryClient.getQueryState(key)?.isInvalidated)).toBe(true);
  });


  it('keeps cached data unchanged when the guide mutation reports failure', async () => {
    const confirm = jest.fn().mockResolvedValue(false);
    render(<CreateGuideModal open onClose={jest.fn()} selectedOrders={[selected]} storeId="kunca" onConfirm={confirm} defaultCourierId="courier-one" />);
    const submit = screen.getByRole('button', { name: /generar guía/i });
    await waitFor(() => expect(submit).toBeEnabled());
    await userEvent.click(submit);
    await waitFor(() => expect(confirm).toHaveBeenCalledTimes(1));
    expect(queryClient.getQueriesData({ queryKey: ['business-orders'] }).every(([key]) => !queryClient.getQueryState(key)?.isInvalidated)).toBe(true);
    expect(queryClient.getQueriesData({ queryKey: ['business-guides'] }).every(([key]) => !queryClient.getQueryState(key)?.isInvalidated)).toBe(true);
  });

  it('creates one joint guide for 11 orders across stores and warehouses', async () => {
    const orders = Array.from({ length: 11 }, (_, index) => ({
      ...selected,
      id: `order-${index}`,
      storeId: index < 6 ? 'web' : 'livii',
      inventoryId: index < 9 ? 'shared-inventory' : 'other-inventory',
      pendingPayment: index + 1,
      zone: index < 6 ? 'PROVINCIAS' : 'LIMA_NORTE',
    }));
    const confirm = jest.fn().mockResolvedValue(undefined);
    render(<CreateGuideModal open onClose={jest.fn()} selectedOrders={orders} storeId="kunca" onConfirm={confirm} defaultCourierId="courier-one" />);
    const submit = screen.getByRole('button', { name: 'Generar Guía' });
    await waitFor(() => expect(submit).toBeEnabled());
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByText('Se creará una guía para 11 pedido(s)')).toBeInTheDocument();
    const costs = screen.getAllByPlaceholderText('0.00');
    await userEvent.type(costs[0], '12.50');
    await userEvent.type(costs[6], '8');
    await userEvent.type(costs[10], '3.25');
    await userEvent.click(submit);
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(confirm).toHaveBeenCalledWith([
      expect.objectContaining({
        storeId: 'web', orderIds: orders.map((order) => order.id),
        amountToCollect: 66, deliveryZones: ['PROVINCIAS', 'LIMA_NORTE'],
        orderCarrierCosts: { 'order-0': 12.5, 'order-6': 8, 'order-10': 3.25 },
        courierId: 'courier-one',
      }),
    ]);
  });

  it('does not collect pending balances again for prepaid guides across stores', async () => {
    const confirm = jest.fn().mockResolvedValue(undefined);
    render(<CreateGuideModal open onClose={jest.fn()} selectedOrders={[selected, { ...selected, id: 'livii-order', storeId: 'livii' }]} storeId="kunca" onConfirm={confirm} defaultCourierId="courier-one" />);
    const submit = screen.getByRole('button', { name: 'Generar Guía' });
    await waitFor(() => expect(submit).toBeEnabled());
    await userEvent.selectOptions(screen.getByLabelText('Tipo de cobro'), 'PREPAGADO');
    await userEvent.click(submit);
    expect(confirm).toHaveBeenCalledWith([
      expect.objectContaining({ chargeType: 'PREPAGADO', amountToCollect: undefined }),
    ]);
  });

  it('still blocks a selection missing the order store', async () => {
    const confirm = jest.fn();
    render(<CreateGuideModal open onClose={jest.fn()} selectedOrders={[selected, { ...selected, id: 'unknown', storeId: undefined }]} storeId="kunca" onConfirm={confirm} defaultCourierId="courier-one" />);
    await screen.findByText('Courier One');
    expect(screen.getByRole('alert')).toHaveTextContent('identificar la tienda');
    expect(screen.getByRole('button', { name: /generar guía/i })).toBeDisabled();
    expect(confirm).not.toHaveBeenCalled();
  });

  it('blocks orders from another business when creating or adding to a guide', async () => {
    const confirm = jest.fn();
    const orders = [selected, { ...selected, id: 'foreign-order', storeId: 'foreign' }];
    const view = render(<CreateGuideModal open onClose={jest.fn()} selectedOrders={orders} storeId="kunca" onConfirm={confirm} defaultCourierId="courier-one" />);
    await screen.findByText('Courier One');
    expect(screen.getByRole('alert')).toHaveTextContent('mismo negocio');
    expect(screen.getByRole('button', { name: 'Generar Guía' })).toBeDisabled();
    view.unmount();
    render(<AddToExistingGuideModal open onClose={jest.fn()} selectedOrders={orders} storeId="kunca" onConfirm={confirm} />);
    expect(screen.getByRole('alert')).toHaveTextContent('mismo negocio');
    expect(screen.getByRole('button', { name: /agregar/i })).toBeDisabled();
    expect(confirm).not.toHaveBeenCalled();
  });

  it('adds mixed stores to a compatible guide of the same business regardless of warehouse', async () => {
    jest.mocked(useBusinessGuides).mockReturnValue({ guides: [
      { id: 'foreign-guide', storeId: 'foreign', guideNumber: 'G-FOREIGN', status: 'CREADA', deliveryType: 'COURIER', deliveryZones: [], created_at: '2026-10-12T12:00:00Z', orderIds: [] },
      { id: 'guide-kunca', storeId: 'kunca', guideNumber: 'G-KUNCA', status: 'CREADA', deliveryType: 'COURIER', deliveryZones: [], created_at: '2026-10-12T12:00:00Z', orderIds: ['old-kunca'] },
      { id: 'guide-web', storeId: 'web', guideNumber: 'G-WEB', status: 'CREADA', deliveryType: 'COURIER', deliveryZones: [], created_at: '2026-10-12T12:00:00Z', orderIds: ['old-web'], courierName: 'Courier One' },
      { id: 'guide-other-warehouse', storeId: 'web', guideNumber: 'G-OTHER-WAREHOUSE', status: 'CREADA', deliveryType: 'COURIER', deliveryZones: [], created_at: '2026-10-12T12:00:00Z', orderIds: ['old-other'] },
    ] as unknown as ReturnType<typeof useBusinessGuides>["guides"], loading: false, error: false, retry: retryGuides, refetch: retryGuides });
    const confirm = jest.fn().mockResolvedValue(undefined);
    render(<AddToExistingGuideModal open onClose={jest.fn()} selectedOrders={[selected, { ...selected, id: "livii-order", storeId: "livii", inventoryId: "other-inventory" }]} storeId="kunca" onConfirm={confirm} />);
    expect(screen.getByText('G-WEB')).toBeInTheDocument();
    expect(screen.getByText('G-KUNCA')).toBeInTheDocument();
    expect(screen.getByText('G-OTHER-WAREHOUSE')).toBeInTheDocument();
    expect(screen.queryByText('G-FOREIGN')).not.toBeInTheDocument();
    expect(useBusinessGuides).toHaveBeenCalledWith({ includeAllStores: true });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    await userEvent.click(screen.getByText('G-WEB'));
    await userEvent.click(screen.getByRole('button', { name: /agregar/i }));
    expect(confirm).toHaveBeenCalledWith('guide-web', 'G-WEB', 'CREADA', 'Courier One');
    await waitFor(() => expect(queryClient.getQueriesData({ queryKey: ['business-guides'] }).every(([key]) => queryClient.getQueryState(key)?.isInvalidated)).toBe(true));
    expect(queryClient.getQueriesData({ queryKey: ['business-orders'] }).every(([key]) => queryClient.getQueryState(key)?.isInvalidated)).toBe(true);
  });

  it('does not treat a guide service failure as an empty successful result', async () => {
    jest.mocked(useBusinessGuides).mockReturnValue({ guides: [], loading: false, error: true, retry: retryGuides, refetch: retryGuides });
    render(<AddToExistingGuideModal open onClose={jest.fn()} selectedOrders={[selected]} storeId="kunca" onConfirm={jest.fn()} />);
    expect(screen.getByRole('alert')).toHaveTextContent('No se pudieron cargar las guías.');
    await userEvent.click(screen.getByRole('button', { name: /reintentar/i }));
    expect(retryGuides).toHaveBeenCalledTimes(1);
  });
});
