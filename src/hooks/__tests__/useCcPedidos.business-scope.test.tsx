import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useCcPedidos } from '../useCcPedidos';
import { getAllPedidosCC, getPedidosCC } from '@/services/atencionClienteService';
import type { OrderHeader } from '@/interfaces/IOrder';

jest.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ auth: { accessToken: 'token', company: { id: 'company' }, user: { id: 'owner' } } }) }));
jest.mock('@/services/atencionClienteService', () => ({ getAllPedidosCC: jest.fn(), getPedidosCC: jest.fn() }));
const getAll = jest.mocked(getAllPedidosCC);
const getPage = jest.mocked(getPedidosCC);
function createWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function Wrapper({ children }: { children: ReactNode }) { return <QueryClientProvider client={client}>{children}</QueryClientProvider>; };
}
const orders = [
  { id: 'web-order', storeId: 'WEB', inventoryId: 'shared' },
  { id: 'kunca-order', storeId: 'KUNCA', inventoryId: 'shared' },
] as OrderHeader[];

beforeEach(() => { getAll.mockReset(); getPage.mockReset(); });

it('solicita cada página global al servidor sin descargar el negocio completo', async () => {
  getPage.mockImplementation(async (filters) => ({ data: [orders[(filters.page ?? 1) - 1]], total: 2, page: filters.page ?? 1, totalPages: 2 }));
  const { result, rerender } = renderHook(({ page }) => useCcPedidos({ storeIds: ['KUNCA', 'WEB'], page, limit: 1 }), { initialProps: { page: 1 }, wrapper: createWrapper() });
  await waitFor(() => expect(result.current.data?.data[0].id).toBe('web-order'));
  rerender({ page: 2 });
  await waitFor(() => expect(result.current.data?.data[0].id).toBe('kunca-order'));
  expect(result.current.data).toMatchObject({ page: 2, total: 2, totalPages: 2, data: [{ id: 'kunca-order', storeId: 'KUNCA', inventoryId: 'shared' }] });
  expect(getPage).toHaveBeenCalledTimes(2);
  expect(getPage.mock.calls[1][0]).toMatchObject({ storeIds: ['KUNCA', 'WEB'], page: 2, limit: 1 });
  expect(getPage.mock.calls[0][1]).toBeInstanceOf(AbortSignal);
  expect(getAll).not.toHaveBeenCalled();
});

it('cambiar al alcance de una tienda vacía reemplaza los pedidos del negocio', async () => {
  getPage.mockImplementation(async (filters) => ({ data: filters.storeIds?.length === 2 ? orders : [], total: filters.storeIds?.length === 2 ? 2 : 0, page: 1, totalPages: 1 }));
  const { result, rerender } = renderHook(({ storeIds }) => useCcPedidos({ storeIds }), { initialProps: { storeIds: ['KUNCA', 'WEB'] }, wrapper: createWrapper() });
  await waitFor(() => expect(result.current.data?.total).toBe(2));
  rerender({ storeIds: ['EMPTY'] });
  await waitFor(() => expect(result.current.data?.total).toBe(0));
  expect(result.current.data?.data).toEqual([]);
  expect(getAll).not.toHaveBeenCalled();
});

it('abre el negocio con una sola petición de 50 y no consulta con tiendas vacías', async () => {
  getPage.mockResolvedValue({ data: orders, total: 5000, page: 1, totalPages: 100 });
  const { result, rerender } = renderHook(({ storeIds }) => useCcPedidos({ storeIds }), { initialProps: { storeIds: ['KUNCA', 'WEB'] }, wrapper: createWrapper() });
  await waitFor(() => expect(result.current.data?.total).toBe(5000));
  expect(getPage).toHaveBeenCalledTimes(1);
  expect(getPage.mock.calls[0][0]).toMatchObject({ page: 1, limit: 50 });
  rerender({ storeIds: [] });
  expect(result.current.data).toBeUndefined();
  expect(getPage).toHaveBeenCalledTimes(1);
  expect(getAll).not.toHaveBeenCalled();
});

it('espera 350 ms al escribir y busca una página del servidor sin descargar el negocio', async () => {
  getPage.mockResolvedValue({ data: orders, total: 5000, page: 1, totalPages: 100 });
  const { result, rerender } = renderHook(({ search }) => useCcPedidos({ storeIds: ['KUNCA', 'WEB'], search, page: 1, limit: 50 }), { initialProps: { search: '' }, wrapper: createWrapper() });
  await waitFor(() => expect(result.current.data?.total).toBe(5000));
  jest.useFakeTimers();
  try {
    rerender({ search: 'El' });
    expect(result.current.isDebouncing).toBe(true);
    expect(result.current.data).toBeUndefined();
    act(() => jest.advanceTimersByTime(200));
    rerender({ search: 'Elisa' });
    act(() => jest.advanceTimersByTime(349));
    expect(getPage).toHaveBeenCalledTimes(1);
    await act(async () => { jest.advanceTimersByTime(1); });
    expect(getPage).toHaveBeenCalledTimes(2);
    expect(getPage.mock.calls[1][0]).toMatchObject({ storeIds: ['KUNCA', 'WEB'], search: 'Elisa', page: 1, limit: 50 });
    expect(getAll).not.toHaveBeenCalled();
  } finally {
    jest.useRealTimers();
  }
});
