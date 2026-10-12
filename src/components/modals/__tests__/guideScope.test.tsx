import { render as renderRTL, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactElement } from 'react';
import userEvent from '@testing-library/user-event';
import CreateGuideModal from '../CreateGuideModal';
import AddToExistingGuideModal from '../AddToExistingGuideModal';
import { useBusinessGuides } from '@/hooks/useBusinessGuides';
import { useBusinessOrders } from '@/hooks/useBusinessOrders';

jest.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ auth: { company: { id: 'company' }, accessToken: 'token' } }) }));
jest.mock('@/services/courierService', () => ({ fetchCouriers: jest.fn().mockResolvedValue([{ id: 'courier-one', name: 'Courier One' }]) }));
jest.mock('@/hooks/useBusinessGuides', () => ({ useBusinessGuides: jest.fn() }));
jest.mock('@/hooks/useBusinessOrders', () => ({ useBusinessOrders: jest.fn() }));
const selected = { id: 'selected-web-order', storeId: 'web', inventoryId: 'shared-inventory', stockStoreId: 'kunca', orderNumber: 'WEB-ONE', clientName: 'Cliente', address: 'Dirección', district: 'Distrito', total: 20, pendingPayment: 20, zone: 'PROVINCIAS' };
let queryClient: QueryClient;
function render(element: ReactElement) {
  return renderRTL(<QueryClientProvider client={queryClient}>{element}</QueryClientProvider>);
}
const retryGuides = jest.fn();
const retryOrders = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  queryClient.setQueryData(["business-orders", "company", "user", ["web"]], []);
  queryClient.setQueryData(["business-guides", "company", "user", ["web"]], []);
  jest.mocked(useBusinessGuides).mockReturnValue({ guides: [], loading: false, error: false, retry: retryGuides, refetch: retryGuides });
  jest.mocked(useBusinessOrders).mockReturnValue({ orders: [], loading: false, error: false, retry: retryOrders, refetch: retryOrders });
});

describe('guide actions keep the selected orders source', () => {
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

  it('blocks mixed business stores sharing an inventory with an explicit explanation', async () => {
    const confirm = jest.fn();
    render(<CreateGuideModal open onClose={jest.fn()} selectedOrders={[selected, { ...selected, id: 'livii-order', storeId: 'livii' }]} storeId="kunca" onConfirm={confirm} defaultCourierId="courier-one" />);
    await screen.findByText('Courier One');
    expect(screen.getByRole('alert')).toHaveTextContent('una sola tienda');
    expect(screen.getByRole('button', { name: /generar guía/i })).toBeDisabled();
    expect(confirm).not.toHaveBeenCalled();
  });

  it('offers only guides matching both the commercial shop and the stored warehouse', async () => {
    jest.mocked(useBusinessGuides).mockReturnValue({ guides: [
      { id: 'guide-kunca', storeId: 'kunca', guideNumber: 'G-KUNCA', status: 'CREADA', deliveryType: 'COURIER', deliveryZones: [], created_at: '2026-10-12T12:00:00Z', orderIds: ['old-kunca'] },
      { id: 'guide-web', storeId: 'web', guideNumber: 'G-WEB', status: 'CREADA', deliveryType: 'COURIER', deliveryZones: [], created_at: '2026-10-12T12:00:00Z', orderIds: ['old-web'], courierName: 'Courier One' },
      { id: 'guide-other-warehouse', storeId: 'web', guideNumber: 'G-OTHER-WAREHOUSE', status: 'CREADA', deliveryType: 'COURIER', deliveryZones: [], created_at: '2026-10-12T12:00:00Z', orderIds: ['old-other'] },
    ] as unknown as ReturnType<typeof useBusinessGuides>["guides"], loading: false, error: false, retry: retryGuides, refetch: retryGuides });
    jest.mocked(useBusinessOrders).mockReturnValue({ orders: [
      { ...selected, id: 'old-web' }, { ...selected, id: 'old-other', inventoryId: 'other-inventory' }, { ...selected, id: 'old-kunca', storeId: 'kunca' },
    ] as unknown as ReturnType<typeof useBusinessOrders>['orders'], loading: false, error: false, retry: retryOrders, refetch: retryOrders });
    const confirm = jest.fn().mockResolvedValue(undefined);
    render(<AddToExistingGuideModal open onClose={jest.fn()} selectedOrders={[selected]} storeId="kunca" onConfirm={confirm} />);
    expect(screen.getByText('G-WEB')).toBeInTheDocument();
    expect(screen.queryByText('G-KUNCA')).not.toBeInTheDocument();
    expect(screen.queryByText('G-OTHER-WAREHOUSE')).not.toBeInTheDocument();
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
    expect(retryOrders).toHaveBeenCalledTimes(1);
  });
});
