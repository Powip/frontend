import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type ComponentType, Suspense } from 'react';
import axiosAuth from '@/lib/axiosAuth';
import ClientesPage from '../clientes/page';
import ComprasPage from '../compras/page';
import ProveedoresPage from '../proveedores/page';

jest.mock('@/lib/axiosAuth', () => ({ __esModule: true, default: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), delete: jest.fn() } }));
jest.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ auth: { accessToken: 'token', user: { id: 'owner', role: 'ADMIN' }, company: { id: 'business-1', stores: [{ id: 'empty-store', name: 'KUNCA' }, { id: 'web-store', name: 'WEB' }] } }, selectedStoreId: 'empty-store' }) }));
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }), usePathname: () => '/compras' }));
jest.mock('@/components/header/HeaderConfig', () => ({ HeaderConfig: ({ title }: { title: string }) => <h1>{title}</h1> }));
jest.mock('@/components/modals/ClienteModal', () => ({ __esModule: true, default: () => null }));
jest.mock('@/api/Productos', () => ({ getBrands: async () => [], getCategories: async () => [] }));
jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
const get = jest.mocked(axiosAuth.get);
// FEAT-24 H3-E: Compras y Proveedores son las pantallas nuevas (órdenes de compra y proveedores de compras), que
// leen la empresa del token por la fachada de ms-products: ni la URL ni los parámetros llevan empresa o tienda.
const purchaseOrder = { id: 'oc-web', number: 'OC-WEB', origin: 'order', status: 'PEDIDA', supplierId: null, supplierName: null, inventoryId: null, storeId: null, pricesIncludeIgv: false, expenses: 0, subtotal: 100, igvAmount: 18, total: 118, document: null, notes: null, purchaseDate: '2026-10-12', receiptType: null, paymentMethod: null, paymentStatus: 'pendiente', paidAt: null, dueDate: null, orderedAt: null, receivedAt: null, hasTrackedUnits: false, cancelReason: null, cancelledBy: null, cancelledAt: null, userEmail: null, userName: null, createdAt: '2026-10-12T15:00:00Z', updatedAt: '2026-10-12T15:00:00Z', lines: [] };
const purchaseSupplier = { id: 'supplier-web', name: 'Proveedor WEB', businessName: 'Proveedor WEB', tradeName: null, ruc: null, paymentTerms: 'CONTADO', isActive: true };
const fixtures = [
  { title: 'Clientes', Page: ClientesPage, endpoint: '/clients/company/business-1', label: 'Cliente WEB', data: [{ id: 'client-web', fullName: 'Cliente WEB', phoneNumber: '999111222', clientType: 'TRADICIONAL', isActive: true, totalOrders: 1, totalSpent: 100 }] },
  { title: 'Compras', Page: ComprasPage, endpoint: '/purchase-orders', label: 'OC-WEB', data: { items: [purchaseOrder], total: 1, page: 1, limit: 20 } },
  { title: 'Proveedores', Page: ProveedoresPage, endpoint: '/purchase-suppliers', label: 'Proveedor WEB', data: { items: [purchaseSupplier] } },
];
/** Responde la lista de la pantalla en su endpoint y vacío en las lecturas auxiliares (proveedores y almacenes de Compras). */
function serve(endpoint: string, data: unknown, failFirst = false) {
  let failed = !failFirst;
  get.mockImplementation(async (url: string) => {
    if (url.includes(endpoint)) {
      if (!failed) {
        failed = true;
        throw new Error('401');
      }
      return { data };
    }
    if (url.includes('/warehouses')) return { data: { warehouses: [] } };
    return { data: { items: [] } };
  });
}
/** Promesa ya cumplida que `use()` lee sin suspender (Compras lee `?oc=` de `searchParams`). */
function resolvedSearchParams() {
  return Object.assign(Promise.resolve({}), { status: 'fulfilled', value: {} });
}
function renderPage(Page: ComponentType<any>) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <Suspense fallback={null}>
        <Page searchParams={resolvedSearchParams()} />
      </Suspense>
    </QueryClientProvider>,
  );
}
const callTo = (endpoint: string) => get.mock.calls.find(([url]) => String(url).includes(endpoint));
beforeEach(() => get.mockReset());

it.each(fixtures)('$title lee por empresa aunque la tienda seleccionada esté vacía', async ({ Page, endpoint, data, label }) => {
  serve(endpoint, data);
  renderPage(Page);
  expect(await screen.findByText(label)).toBeInTheDocument();
  expect(get).toHaveBeenCalledWith(expect.stringContaining(endpoint), expect.objectContaining({ signal: expect.any(AbortSignal) }));
  for (const [url] of get.mock.calls) expect(url).not.toContain('undefined');
  const config = callTo(endpoint)?.[1];
  expect(config?.params?.storeId).toBeUndefined();
  expect(config?.params?.storeIds).toBeUndefined();
});

it.each(fixtures)('$title distingue un fallo de autorización de una lista vacía y permite recuperar', async ({ Page, endpoint, data, label }) => {
  serve(endpoint, data, true);
  renderPage(Page);
  expect(await screen.findByRole('alert')).toHaveTextContent('No se pudieron cargar');
  expect(screen.queryByText(label)).not.toBeInTheDocument();
  expect(screen.queryByText(/No hay proveedores registrados|No hay compras registradas|No se encontraron clientes|Todavía no hay (compras|proveedores)/i)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
  expect(await screen.findByText(label)).toBeInTheDocument();
  await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
});
