import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ComponentType } from 'react';
import axiosAuth from '@/lib/axiosAuth';
import ClientesPage from '../clientes/page';
import ComprasPage from '../compras/page';
import ProveedoresPage from '../proveedores/page';

jest.mock('@/lib/axiosAuth', () => ({ __esModule: true, default: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), delete: jest.fn() } }));
jest.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ auth: { accessToken: 'token', user: { id: 'owner', role: 'ADMIN' }, company: { id: 'business-1', stores: [{ id: 'empty-store', name: 'KUNCA' }, { id: 'web-store', name: 'WEB' }] } }, selectedStoreId: 'empty-store' }) }));
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock('@/components/header/HeaderConfig', () => ({ HeaderConfig: ({ title }: { title: string }) => <h1>{title}</h1> }));
jest.mock('@/components/modals/ClienteModal', () => ({ __esModule: true, default: () => null }));
jest.mock('@/api/Productos', () => ({ getBrands: async () => [], getCategories: async () => [] }));
jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
const get = jest.mocked(axiosAuth.get);
const fixtures = [
  { title: 'Clientes', Page: ClientesPage, endpoint: '/clients/company/business-1', label: 'Cliente WEB', data: [{ id: 'client-web', fullName: 'Cliente WEB', phoneNumber: '999111222', clientType: 'TRADICIONAL', isActive: true, totalOrders: 1, totalSpent: 100 }] },
  { title: 'Compras', Page: ComprasPage, endpoint: '/purchase/company/business-1', label: 'BUY-WEB', data: { data: [{ id: 'purchase-web', purchaseNumber: 'BUY-WEB', totalAmount: 200, notes: null, status: 'COMPLETED', createdAt: '2026-10-12T15:00:00Z', items: [] }], meta: { total: 1 } } },
  { title: 'Proveedores', Page: ProveedoresPage, endpoint: '/suppliers/company/business-1', label: 'Proveedor WEB', data: [{ id: 'supplier-web', name: 'Proveedor WEB', isActive: true, brands: [] }] },
];
function renderPage(Page: ComponentType) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><Page /></QueryClientProvider>);
}
beforeEach(() => get.mockReset());

it.each(fixtures)('$title lee por empresa aunque la tienda seleccionada esté vacía', async ({ Page, endpoint, data, label }) => {
  get.mockResolvedValue({ data });
  renderPage(Page);
  expect(await screen.findByText(label)).toBeInTheDocument();
  expect(get).toHaveBeenCalledWith(expect.stringContaining(endpoint), expect.objectContaining({ signal: expect.any(AbortSignal) }));
  expect(get.mock.calls[0][0]).not.toContain("undefined");
  const config = get.mock.calls[0][1];
  expect(config?.params?.storeId).toBeUndefined();
  expect(config?.params?.storeIds).toBeUndefined();
});

it.each(fixtures)('$title distingue un fallo de autorización de una lista vacía y permite recuperar', async ({ Page, data, label }) => {
  get.mockRejectedValueOnce(new Error('401')).mockResolvedValueOnce({ data });
  renderPage(Page);
  expect(await screen.findByRole('alert')).toHaveTextContent('No se pudieron cargar');
  expect(screen.queryByText(label)).not.toBeInTheDocument();
  expect(screen.queryByText(/No hay proveedores registrados|No hay compras registradas|No se encontraron clientes/i)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
  expect(await screen.findByText(label)).toBeInTheDocument();
  await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
});
