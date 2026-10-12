import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useCcPedidos } from '../useCcPedidos';
import { getAllPedidosCC } from '@/services/atencionClienteService';
import type { OrderHeader } from '@/interfaces/IOrder';

jest.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ auth: { accessToken: 'token', company: { id: 'company' }, user: { id: 'owner' } } }) }));
jest.mock('@/services/atencionClienteService', () => ({ getAllPedidosCC: jest.fn(), getPedidosCC: jest.fn() }));
const getAll = jest.mocked(getAllPedidosCC);
function createWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function Wrapper({ children }: { children: ReactNode }) { return <QueryClientProvider client={client}>{children}</QueryClientProvider>; };
}
const orders = [
  { id: 'web-order', storeId: 'WEB', inventoryId: 'shared' },
  { id: 'kunca-order', storeId: 'KUNCA', inventoryId: 'shared' },
] as OrderHeader[];

beforeEach(() => getAll.mockReset());

it('pagina la lista global cacheada sin descargar de nuevo cada tienda', async () => {
  getAll.mockResolvedValue({ data: orders, total: 2, truncated: false });
  const { result, rerender } = renderHook(({ page }) => useCcPedidos({ storeIds: ['KUNCA', 'WEB'], page, limit: 1 }), { initialProps: { page: 1 }, wrapper: createWrapper() });
  await waitFor(() => expect(result.current.data?.data[0].id).toBe('web-order'));
  rerender({ page: 2 });
  expect(result.current.data).toMatchObject({ page: 2, total: 2, totalPages: 2, data: [{ id: 'kunca-order', storeId: 'KUNCA', inventoryId: 'shared' }] });
  expect(getAll).toHaveBeenCalledTimes(1);
  expect(getAll.mock.calls[0][0]).toMatchObject({ storeIds: ['KUNCA', 'WEB'] });
  expect(getAll.mock.calls[0][1]).toBeInstanceOf(AbortSignal);
});

it('cambiar al alcance de una tienda vacía reemplaza los pedidos del negocio', async () => {
  getAll.mockImplementation(async (filters) => ({ data: filters.storeIds?.length === 2 ? orders : [], total: filters.storeIds?.length === 2 ? 2 : 0, truncated: false }));
  const { result, rerender } = renderHook(({ storeIds }) => useCcPedidos({ storeIds }), { initialProps: { storeIds: ['KUNCA', 'WEB'] }, wrapper: createWrapper() });
  await waitFor(() => expect(result.current.data?.total).toBe(2));
  rerender({ storeIds: ['EMPTY'] });
  await waitFor(() => expect(result.current.data?.total).toBe(0));
  expect(result.current.data?.data).toEqual([]);
});
