import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import axiosAuth from '@/lib/axiosAuth';
import { useTaxDocuments } from '../useTaxDocuments';

let scopeKey = 'company:user:business:KUNCA,WEB';
let sales = [
  { id: 'kunca-order', storeId: 'KUNCA', status: 'ENTREGADO', createdAt: new Date('2026-10-01T15:00:00Z'), grandTotal: 100 },
  { id: 'web-order', storeId: 'WEB', status: 'ENTREGADO', createdAt: new Date('2026-10-12T15:00:00Z'), grandTotal: 200 },
];
jest.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ auth: { company: { id: 'company' }, user: { id: 'user' } } }) }));
jest.mock('@/contexts/BusinessScopeContext', () => ({ useBusinessScope: () => ({ scopeKey, canFetch: true }) }));
jest.mock('@/features/sales/hooks/use-business-sales', () => ({ useBusinessSales: () => ({ data: sales, isLoading: false, isError: false, refetch: jest.fn() }) }));
jest.mock('@/lib/axiosAuth', () => ({ __esModule: true, default: { get: jest.fn() } }));
jest.mock('@/features/sunat/sunat-document/mappers/to-list-sunat-documents.mapper', () => ({ toListSunatDocumentsResult: (dto: { items: unknown[]; total: number }) => ({ documents: dto.items, total: dto.total }) }));
const get = jest.mocked(axiosAuth.get);
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{children}</QueryClientProvider>;
}
const doc = (orderId: string) => ({ id: `doc-${orderId}`, orderId, cdrStatus: 'ACCEPTED', createdAt: new Date('2026-10-12'), taxDocumentPayload: { totals: { grandTotal: 100 } } });

beforeEach(() => {
  get.mockReset();
  scopeKey = 'company:user:business:KUNCA,WEB';
  sales = [
    { id: 'kunca-order', storeId: 'KUNCA', status: 'ENTREGADO', createdAt: new Date('2026-10-01T15:00:00Z'), grandTotal: 100 },
    { id: 'web-order', storeId: 'WEB', status: 'ENTREGADO', createdAt: new Date('2026-10-12T15:00:00Z'), grandTotal: 200 },
  ];
});

it('lee todas las páginas de comprobantes y relaciona ventas de ambas tiendas', async () => {
  get.mockImplementation(async (_url, config) => ({ data: { items: [doc(config?.params.offset === 0 ? 'web-order' : 'kunca-order')], total: 2 } }));
  const { result } = renderHook(() => useTaxDocuments(), { wrapper });
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.rows.map((row) => row.sale.storeId)).toEqual(['WEB', 'KUNCA']);
  expect(result.current.rows.every((row) => row.taxDocument)).toBe(true);
  expect(result.current.kpis.pendientes).toBe(0);
  expect(get.mock.calls.map((call) => call[1]?.params.offset)).toEqual([0, 1]);
  expect(get.mock.calls.every((call) => call[1]?.signal instanceof AbortSignal)).toBe(true);
});

it('cambiar a una tienda vacía limpia filas y selección de la vista anterior', async () => {
  get.mockResolvedValue({ data: { items: [], total: 0 } });
  const { result, rerender } = renderHook(() => useTaxDocuments(), { wrapper });
  await waitFor(() => expect(result.current.loading).toBe(false));
  act(() => result.current.selectAllPending(true));
  expect(result.current.selectedRows).toHaveLength(2);
  scopeKey = 'company:user:store:EMPTY';
  sales = [];
  rerender();
  expect(result.current.rows).toEqual([]);
  expect(result.current.selectedIds.size).toBe(0);
});

it('si SUNAT falla, no trata todas las ventas entregadas como pendientes de emitir', async () => {
  get.mockRejectedValue(new Error('401'));
  const { result } = renderHook(() => useTaxDocuments(), { wrapper });
  await waitFor(() => expect(result.current.error).toBe(true));
  expect(result.current.rows).toEqual([]);
  expect(result.current.kpis.pendientes).toBe(0);
});

it('detecta una página vacía antes del total y señala error de respuesta incompleta', async () => {
  get.mockResolvedValue({ data: { items: [], total: 5 } });
  const { result } = renderHook(() => useTaxDocuments(), { wrapper });
  await waitFor(() => expect(result.current.error).toBe(true));
  expect(result.current.rows).toEqual([]);
});
