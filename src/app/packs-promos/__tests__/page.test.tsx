/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * PacksPromosPage: catálogo, formularios, variantes exactas y compatibilidad
 * de bundles anteriores. BUNDLE usa una API compartida simulada; regalos
 * conservan persistencia local y VOLUME conserva su servicio independiente.
 * Los tests de aislamiento, importación, sesiones y tombstones viven en
 * PacksContext.shared-bundles.test.tsx.
 */

import React from 'react';
import { tokenStore } from '@/lib/tokenStore';
import { render, screen, waitFor, within, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// ── Mocks de infraestructura ─────────────────────────────────────────────────

jest.mock('@/hooks/useBusinessInventories', () => ({ useBusinessInventories: () => {
  const { auth, inventories } = require('@/contexts/AuthContext').useAuth();
  return { inventories: inventories.map((inv: { id: string; name: string }) => ({ ...inv, storeId: 'owner-store' })), isPending: false, isError: false, refetch: jest.fn() };
} }));

jest.mock('sonner', () => ({
  toast: { success: jest.fn(), error: jest.fn(), warning: jest.fn() },
}));

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), prefetch: jest.fn() }),
  usePathname: () => '/packs-promos',
  // El árbol de esta página solo usa useRouter/usePathname (HeaderConfig), pero
  // se stubea useSearchParams para no romper si un hijo lo agrega más adelante.
  useSearchParams: () => new URLSearchParams(),
}));

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: jest.fn(),
}));

jest.mock('@/lib/axiosAuth', () => ({ __esModule: true, default: { get: jest.fn() } }));

jest.mock('@/api/Productos', () => ({
  getProducts: jest.fn(),
}));

jest.mock('@/services/promos.service', () => ({
  listVolumePromos: jest.fn(),
  createVolumePromo: jest.fn(),
  updatePromo: jest.fn(),
  deletePromo: jest.fn(),
}));

let mockSharedBundles: import('@/interfaces/IPack').BundlePack[] = [];
jest.mock('@/services/bundlePromos.service', () => ({
  listBundlePromos: jest.fn(async () => ({ bundles: mockSharedBundles, deletedIds: [] })),
  getBundleCapabilities: jest.fn(async () => ({ canManage: true })),
  importBundlePromos: jest.fn(async (bundles: import('@/interfaces/IPack').BundlePack[]) => {
    const current = new Map(mockSharedBundles.map((pack) => [pack.id, pack]));
    for (const pack of bundles) if (!current.has(pack.id)) current.set(pack.id, { ...pack, shared: true, synced: false });
    mockSharedBundles = [...current.values()];
    return { acceptedIds: bundles.map((pack) => pack.id), bundles: mockSharedBundles };
  }),
  createBundlePromo: jest.fn(async (pack: import('@/interfaces/IPack').BundlePack) => {
    const saved = { ...pack, shared: true, synced: false };
    mockSharedBundles.push(saved); return saved;
  }),
  updateBundlePromo: jest.fn(async (id: string, pack: import('@/interfaces/IPack').BundlePack) => {
    const saved = { ...pack, id, shared: true, synced: false };
    mockSharedBundles = mockSharedBundles.map((value) => value.id === id ? saved : value); return saved;
  }),
  deleteBundlePromo: jest.fn(async (id: string) => { mockSharedBundles = mockSharedBundles.filter((pack) => pack.id !== id); }),
}));

jest.mock('@/services/inventoryItems.service', () => ({
  searchInventoryItems: jest.fn(),
}));

jest.mock('@/components/ui/dialog', () => {
  const React = require('react');
  return {
    Dialog: ({ open, children }: { open?: boolean; children?: React.ReactNode }) =>
      open ? <div>{children}</div> : null,
    DialogContent: ({ children }: { children?: React.ReactNode }) => (
      <div data-testid="pack-form-modal">{children}</div>
    ),
    DialogHeader: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
    DialogTitle: ({ children }: { children?: React.ReactNode }) => <h2>{children}</h2>,
    DialogFooter: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  };
});

jest.mock('@/components/ui/combobox', () => {
  const React = require('react');
  const Combobox = ({
    value,
    onValueChange,
    options,
    placeholder,
    disabled,
  }: {
    value?: string;
    onValueChange?: (v: string) => void;
    options?: { value: string; label: string }[];
    placeholder?: string;
    disabled?: boolean;
  }) => (
    <select
      aria-label={placeholder}
      disabled={disabled}
      value={value ?? ''}
      onChange={(e) => onValueChange?.(e.target.value)}
    >
      <option value="">{placeholder ?? 'Seleccionar...'}</option>
      {(options ?? []).map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
  return { Combobox };
});

jest.mock('@/components/ui/checkbox', () => {
  const React = require('react');
  const Checkbox = ({
    checked,
    onCheckedChange,
  }: {
    checked?: boolean;
    onCheckedChange?: (v: boolean) => void;
  }) => (
    <input
      type="checkbox"
      checked={!!checked}
      onChange={(e) => onCheckedChange?.(e.target.checked)}
    />
  );
  return { Checkbox };
});

// ── Imports bajo prueba (después de los mocks) ───────────────────────────────

import { AxiosError } from 'axios';
import axiosAuth from '@/lib/axiosAuth';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { getProducts } from '@/api/Productos';
import { listVolumePromos, createVolumePromo } from '@/services/promos.service';
import { searchInventoryItems } from '@/services/inventoryItems.service';
import type { IGetProducts } from '@/api/Interfaces';
import type { BundlePack, GiftPack } from '@/interfaces/IPack';
import type { InventoryItemForSale } from '@/interfaces/IProduct';
import PacksPromosPage from '../page';

// ── Casts ───────────────────────────────────────────────────────────────────

const mockUseAuth = jest.mocked(useAuth);
const mockGetProducts = jest.mocked(getProducts);
const mockGetVariants = jest.mocked(axiosAuth.get);
const mockListVolumePromos = jest.mocked(listVolumePromos);
const mockCreateVolumePromo = jest.mocked(createVolumePromo);
const mockSearchInventoryItems = jest.mocked(searchInventoryItems);
const mockToast = toast as jest.Mocked<typeof toast>;

// ── Fixtures / helpers ──────────────────────────────────────────────────────

const COMPANY_ID = 'company-1';
/** Está en SUPERADMIN_EMAILS (config/permissions.config) → habilita "Nuevo pack". */
const SUPERADMIN_EMAIL = 'octatoledo7@gmail.com';

/**
 * `inventories` es opcional y por defecto `[]` (comportamiento previo intacto para
 * todos los tests de Volumen/Bundle). Los tests del buscador de regalos (tab
 * GIFT) pasan `[{ id: "inv-1", name: "Almacén 1" }]`: la página deriva
 * `selectedInventory = inventories[0]?.id` y lo baja al `PackFormModal` como
 * `inventoryId`, que es lo que habilita `useGiftInventorySearch`
 * (`enabled: !!inventoryId`).
 */
function authValue(
  company: { id: string; name: string } | null,
  inventories: { id: string; name: string }[] = [],
) {
  return {
    auth: {
      user: { id: 'u1', email: SUPERADMIN_EMAIL, role: 'ADMIN', permissions: [] },
      company,
      accessToken: 'tok',
      subscription: null,
      exp: 9999999999,
    },
    loading: false,
    login: jest.fn(),
    logout: jest.fn(),
    updateCompany: jest.fn(),
    selectedStoreId: null,
    setSelectedStore: jest.fn(),
    inventories,
    refreshInventories: jest.fn(),
    hasPermission: jest.fn().mockReturnValue(true),
  };
}

const mkProduct = (id: string, name: string, priceVta: number) =>
  ({ id, name, priceVta } as unknown as IGetProducts);

/** GiftPack mínimo válido para `isValidLocalPack` (PacksContext): type "GIFT",
 *  id/active/channels/triggerBy presentes, `minAmount` numérico (trigger
 *  "amount") y `gifts` con >= 1 `GiftOption` (variantId + productName + value).
 *  Los dos gifts pre-cargados sólo existen para que el pack cargue; los tests son
 *  sobre el buscador de inventario, no sobre esas opciones. */
const mkGiftPack = (): GiftPack => ({
  id: 'gift-por-monto',
  type: 'GIFT',
  name: 'Regalo por Monto',
  active: true,
  channels: ['WHATSAPP'],
  triggerBy: 'amount',
  minAmount: 300,
  minQty: null,
  gifts: [
    {
      variantId: 'v1',
      inventoryItemId: 'ii1',
      sku: 'SKU-1',
      productName: 'Llavero Cuero',
      value: 15,
    },
    {
      variantId: 'v2',
      inventoryItemId: 'ii2',
      sku: 'SKU-2',
      productName: 'Medias Pack',
      value: 12,
    },
  ],
});

/** Item de inventario tal como lo devuelve `searchInventoryItems().data` — sólo
 *  los campos que consume `GiftSearchPicker` (`variantId`, `inventoryItemId`,
 *  `sku`, `productName`, `price`; `attributes` opcional). */
const mkInventoryItem = (
  variantId: string,
  productName: string,
  price: number,
): InventoryItemForSale =>
  ({
    variantId,
    inventoryItemId: `ii-${variantId}`,
    sku: `SKU-${variantId}`,
    productName,
    price,
    availableStock: 10,
    physicalStock: 10,
  } as InventoryItemForSale);

const inventoryMeta = { page: 1, limit: 20, total: 0, totalPages: 0 };

function seedLocalPacks(companyId: string, packs: unknown) {
  window.localStorage.setItem(
    `powip.packs.local.${companyId}`,
    JSON.stringify(packs),
  );
}

function renderPage() {
  const queryClient = new QueryClient({
    // `retry: false` por defecto. `useProductCatalog` sobreescribe `retry` con
    // una fn que SÍ reintenta una vez ante 5xx / errores JS (corta sólo 4xx):
    // `retryDelay: 0` hace ese reintento inmediato para no esperar el backoff
    // real de react-query (~1s) en los tests de la rama de error.
    defaultOptions: { queries: { retry: false, retryDelay: 0 } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <PacksPromosPage />
    </QueryClientProvider>,
  );
}

type User = ReturnType<typeof userEvent.setup>;

async function openNewPackModal(user: User) {
  await user.click(screen.getByRole('button', { name: /nuevo pack/i }));
  return within(await screen.findByTestId('pack-form-modal'));
}

async function openEditModal(user: User, packName: string) {
  await screen.findByText(packName);
  await user.click(screen.getByRole('button', { name: /editar/i }));
  return within(await screen.findByTestId('pack-form-modal'));
}

type Modal = Awaited<ReturnType<typeof openNewPackModal>>;

async function selectBundleVariant(modal: Modal, user: User, row: number, variantId: string) {
  const selector = modal.getByRole('combobox', { name: `Variante ${row}...` });
  await waitFor(() => expect(within(selector).getAllByRole('option', { name: /SKU/ }).length).toBeGreaterThan(0));
  await user.selectOptions(selector, variantId);
}

// ── Setup ───────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  window.localStorage.clear();
  mockSharedBundles = [];
  tokenStore.invalidate();
  tokenStore.set('tok', COMPANY_ID);
  mockUseAuth.mockReturnValue(
    authValue({ id: COMPANY_ID, name: 'ACME' }) as unknown as ReturnType<
      typeof useAuth
    >,
  );
  mockGetProducts.mockResolvedValue([]);
  mockGetVariants.mockImplementation(async (url) => {
    const productId = String(url).split('/').pop()!;
    const prices: Record<string, number> = { pa: 10, pb: 20, pc: 30 };
    return { data: [{ id: `v-${productId}`, sku: `SKU-${productId}`, attributeValues: {}, priceVta: prices[productId] ?? 10, isActive: true }] };
  });
  mockListVolumePromos.mockResolvedValue([]);
  // Default seguro: `searchInventoryItems` (buscador de regalos del tab GIFT) no
  // se ejercita en estos tests, pero sin retorno rompería si algún flujo lo
  // alcanzara — el componente hace `.then((res) => setResults(res.data))`.
  mockSearchInventoryItems.mockResolvedValue({
    data: [],
    meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
  });
});

// ── FIX 1 — el buscador de productos ya no depende de auth.company ───────────

describe('PacksPromosPage — catálogo de productos del modal (FIX 1)', () => {
  it('carga los productos del catálogo en el buscador de Volumen aunque auth.company sea null', async () => {
    mockUseAuth.mockReturnValue(
      authValue(null) as unknown as ReturnType<typeof useAuth>,
    );
    mockGetProducts.mockResolvedValue([
      mkProduct('prod-1', 'Camisa Lino', 120),
      mkProduct('prod-2', 'Jean Slim', 90),
    ]);

    const user = userEvent.setup();
    renderPage();
    const modal = await openNewPackModal(user);

    // El modal abre en la pestaña Volumen; su Combobox de "Producto" debe
    // ofrecer lo que devuelve getProducts. El gate viejo `if (!companyId)` ya
    // no existe.
    const combo = modal.getByRole('combobox');
    await waitFor(() => expect(combo).toHaveTextContent(/Camisa Lino/));
    expect(combo).toHaveTextContent(/Jean Slim/);

    expect(mockGetProducts).toHaveBeenCalledWith(
      expect.objectContaining({ status: true }),
    );
  });

  it('abrir el modal de edición de un pack GIFT no dispara getProducts (enabled gating)', async () => {
    // GiftPack mínimo válido para `isValidLocalPack` (PacksContext): type "GIFT",
    // id/active/channels/triggerBy presentes, `minAmount` numérico (trigger
    // "amount") y `gifts` no vacío con shape `GiftOption` (variantId +
    // productName + value).
    const giftPack: GiftPack = {
      id: 'gift-por-monto',
      type: 'GIFT',
      name: 'Regalo por Monto',
      active: true,
      channels: ['WHATSAPP'],
      triggerBy: 'amount',
      minAmount: 300,
      minQty: null,
      gifts: [
        {
          variantId: 'v1',
          inventoryItemId: 'ii1',
          sku: 'SKU-1',
          productName: 'Llavero Cuero',
          value: 15,
        },
        {
          variantId: 'v2',
          inventoryItemId: 'ii2',
          sku: 'SKU-2',
          productName: 'Medias Pack',
          value: 12,
        },
      ],
    };
    seedLocalPacks(COMPANY_ID, [giftPack]);
    // Si por error se disparara el catálogo, esta respuesta lo dejaría en
    // evidencia (opciones que no deberían llegar a montarse).
    mockGetProducts.mockResolvedValue([mkProduct('prod-x', 'Producto X', 50)]);

    const user = userEvent.setup();
    renderPage();
    const modal = await openEditModal(user, 'Regalo por Monto');

    // El modal abre en el tab Regalo (`type` = editingPack.type = "GIFT"): se
    // ven sus controles propios y no hay ningún `<select>` de producto (ni tab
    // Volumen ni filas de bundle montadas → ninguna otra instancia del hook).
    await modal.findByText(/opciones de regalo/i);
    expect(modal.getByText(/monto mínimo de compra/i)).toBeInTheDocument();
    expect(modal.queryByRole('combobox')).not.toBeInTheDocument();

    // Dejamos correr la ventana del debounce interno de useProductCatalog
    // (setTimeout real de 350ms; esta suite no usa fake timers, así que
    // `jest.advanceTimersByTime` no aplica) para descartar que un efecto
    // pendiente dispare la query después del primer render.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 400));
    });

    // Aserción central: la instancia del buscador de Volumen se crea con
    // `enabled: type === "VOLUME"` → `false` desde el primer render (type
    // arranca en "GIFT" y los botones de tipo están deshabilitados al editar),
    // por lo que react-query nunca invoca queryFn y `GET /products/report` no
    // se pide.
    expect(mockGetProducts).not.toHaveBeenCalled();
  });
});

// ── FIX 2 — tab Bundle: lista dinámica de filas ─────────────────────────────

describe('PacksPromosPage — tab Bundle: filas dinámicas de producto (FIX 2)', () => {
  it('arranca con 2 filas y "＋ Agregar producto" suma hasta 10, luego el botón desaparece', async () => {
    const user = userEvent.setup();
    renderPage();
    const modal = await openNewPackModal(user);
    await user.click(modal.getByRole('button', { name: /bundle/i }));

    await waitFor(() =>
      expect(modal.getAllByRole('combobox', { name: /^Producto \d/ })).toHaveLength(2),
    );

    for (let filas = 3; filas <= 10; filas++) {
      await user.click(
        modal.getByRole('button', { name: /agregar producto/i }),
      );
      expect(modal.getAllByRole('combobox', { name: /^Producto \d/ })).toHaveLength(filas);
    }

    // Con 10 filas el botón de agregar ya no se muestra.
    expect(
      modal.queryByRole('button', { name: /agregar producto/i }),
    ).not.toBeInTheDocument();
    expect(modal.getAllByRole('combobox', { name: /^Producto \d/ })).toHaveLength(10);
  });

  it('el botón "×" aparece solo con 3+ filas y quitar la fila del medio conserva las demás', async () => {
    mockGetProducts.mockResolvedValue([
      mkProduct('pa', 'Producto A', 10),
      mkProduct('pb', 'Producto B', 20),
      mkProduct('pc', 'Producto C', 30),
    ]);

    const user = userEvent.setup();
    renderPage();
    const modal = await openNewPackModal(user);
    await user.click(modal.getByRole('button', { name: /bundle/i }));

    await waitFor(() =>
      expect(modal.getAllByRole('combobox', { name: /^Producto \d/ })).toHaveLength(2),
    );
    // Con exactamente 2 filas no se puede bajar más: no hay "×".
    expect(
      modal.queryAllByRole('button', { name: /quitar producto/i }),
    ).toHaveLength(0);

    // Al pasar a 3 filas, cada fila muestra su "×".
    await user.click(modal.getByRole('button', { name: /agregar producto/i }));
    expect(
      modal.getAllByRole('button', { name: /quitar producto/i }),
    ).toHaveLength(3);

    // Elegimos un producto distinto en cada fila.
    await waitFor(() =>
      expect(modal.getAllByRole('combobox', { name: /^Producto \d/ })[0]).toHaveTextContent(/Producto A/),
    );
    await user.selectOptions(modal.getAllByRole('combobox', { name: /^Producto \d/ })[0], 'pa');
    await user.selectOptions(modal.getAllByRole('combobox', { name: /^Producto \d/ })[1], 'pb');
    await selectBundleVariant(modal, user, 1, 'v-pa');
    await selectBundleVariant(modal, user, 2, 'v-pb');
    await user.selectOptions(modal.getAllByRole('combobox', { name: /^Producto \d/ })[2], 'pc');
    await selectBundleVariant(modal, user, 3, 'v-pc');

    // Quitamos la fila del medio.
    await user.click(modal.getByRole('button', { name: 'Quitar producto 2' }));

    const selects = modal.getAllByRole('combobox', { name: /^Producto \d/ });
    expect(selects).toHaveLength(2);
    expect(selects[0]).toHaveValue('pa');
    expect(selects[1]).toHaveValue('pc');
    // De vuelta en 2 filas: los "×" desaparecen.
    expect(
      modal.queryAllByRole('button', { name: /quitar producto/i }),
    ).toHaveLength(0);
  });

  it('editar un BundlePack con 3 items (con productId) abre 3 filas con cada producto ya seleccionado', async () => {
    const bundle: BundlePack = {
      id: 'bundle-trio',
      type: 'BUNDLE',
      name: 'Combo Trío',
      active: true,
      channels: ['TIENDA_FISICA'],
      items: [
        { productId: 'p1', productKey: 'Polo Rojo', productName: 'Polo Rojo', price: 40 },
        { productId: 'p2', productKey: 'Short Azul', productName: 'Short Azul', price: 35 },
        { productId: 'p3', productKey: 'Gorra Negra', productName: 'Gorra Negra', price: 25 },
      ],
      packPrice: 80,
    };
    seedLocalPacks(COMPANY_ID, [bundle]);
    // El catálogo del buscador viene vacío: los nombres deben salir del ref
    // guardado en el pack (inyección de la opción ya elegida).
    mockGetProducts.mockResolvedValue([]);

    const user = userEvent.setup();
    renderPage();
    const modal = await openEditModal(user, 'Combo Trío');

    await waitFor(() =>
      expect(modal.getAllByRole('combobox', { name: /^Producto \d/ })).toHaveLength(3),
    );
    const selects = modal.getAllByRole('combobox', { name: /^Producto \d/ });

    expect(selects[0]).toHaveTextContent(/Polo Rojo/);
    expect(selects[1]).toHaveTextContent(/Short Azul/);
    expect(selects[2]).toHaveTextContent(/Gorra Negra/);

    expect(selects[0]).toHaveValue('p1');
    expect(selects[1]).toHaveValue('p2');
    expect(selects[2]).toHaveValue('p3');
  });

  it('editar un BundlePack legacy (items sin productId) abre las filas pobladas con los nombres, no vacías', async () => {
    const legacyBundle: BundlePack = {
      id: 'bundle-legacy',
      type: 'BUNDLE',
      name: 'Combo Clásico',
      active: true,
      channels: ['WHATSAPP'],
      items: [
        { productKey: 'Camisa Beige', productName: 'Camisa Beige', price: 60 },
        { productKey: 'Pantalón Gris', productName: 'Pantalón Gris', price: 70 },
        { productKey: 'Correa Cuero', productName: 'Correa Cuero', price: 30 },
      ],
      packPrice: 130,
    };
    seedLocalPacks(COMPANY_ID, [legacyBundle]);
    mockGetProducts.mockResolvedValue([mkProduct('x1', 'Otro Producto', 5)]);

    const user = userEvent.setup();
    renderPage();
    const modal = await openEditModal(user, 'Combo Clásico');

    await waitFor(() =>
      expect(modal.getAllByRole('combobox', { name: /^Producto \d/ })).toHaveLength(3),
    );
    const selects = modal.getAllByRole('combobox', { name: /^Producto \d/ });

    expect(selects[0]).toHaveTextContent(/Camisa Beige/);
    expect(selects[1]).toHaveTextContent(/Pantalón Gris/);
    expect(selects[2]).toHaveTextContent(/Correa Cuero/);

    // Las filas conservan un valor (la clave del item legacy), no quedan vacías.
    expect(selects[0]).toHaveValue('Camisa Beige');
    expect(selects[1]).toHaveValue('Pantalón Gris');
    expect(selects[2]).toHaveValue('Correa Cuero');
  });
});

// ── FIX 2 — validación al guardar un bundle ─────────────────────────────────

describe('PacksPromosPage — validación de bundle al guardar (FIX 2)', () => {
  async function fillNameAndChannel(modal: Modal, user: User, name: string) {
    await user.type(modal.getByPlaceholderText(/Pantalón Denim/), name);
    await user.click(modal.getByRole('checkbox', { name: /tienda fisica/i }));
  }

  it('con un solo producto elegido muestra "Un bundle requiere al menos 2 productos."', async () => {
    mockGetProducts.mockResolvedValue([
      mkProduct('pa', 'Producto A', 10),
      mkProduct('pb', 'Producto B', 20),
    ]);

    const user = userEvent.setup();
    renderPage();
    const modal = await openNewPackModal(user);
    await user.click(modal.getByRole('button', { name: /bundle/i }));
    await fillNameAndChannel(modal, user, 'Mi bundle');

    await waitFor(() =>
      expect(modal.getAllByRole('combobox', { name: /^Producto \d/ })[0]).toHaveTextContent(/Producto A/),
    );
    await user.selectOptions(modal.getAllByRole('combobox', { name: /^Producto \d/ })[0], 'pa');

    await user.click(modal.getByRole('button', { name: /guardar pack/i }));

    expect(
      await modal.findByText(/un bundle requiere al menos 2 productos/i),
    ).toBeInTheDocument();
  });

  it('con precio del pack ≥ suma de PVP muestra el error de precio', async () => {
    mockGetProducts.mockResolvedValue([
      mkProduct('pa', 'Producto A', 10),
      mkProduct('pb', 'Producto B', 20),
    ]);

    const user = userEvent.setup();
    renderPage();
    const modal = await openNewPackModal(user);
    await user.click(modal.getByRole('button', { name: /bundle/i }));
    await fillNameAndChannel(modal, user, 'Bundle caro');

    await waitFor(() =>
      expect(modal.getAllByRole('combobox', { name: /^Producto \d/ })[0]).toHaveTextContent(/Producto A/),
    );
    await user.selectOptions(modal.getAllByRole('combobox', { name: /^Producto \d/ })[0], 'pa');
    await user.selectOptions(modal.getAllByRole('combobox', { name: /^Producto \d/ })[1], 'pb');
    await selectBundleVariant(modal, user, 1, 'v-pa');
    await selectBundleVariant(modal, user, 2, 'v-pb');

    // PVP total = 10 + 20 = 30; ponemos 100 en el precio del bundle.
    await user.type(modal.getByRole('spinbutton'), '100');

    await user.click(modal.getByRole('button', { name: /guardar pack/i }));

    expect(
      await modal.findByText(
        /el precio del bundle debe ser menor a la suma de pvp/i,
      ),
    ).toBeInTheDocument();
  });
});

// ── FIX 2 — guardado feliz de un bundle ────────────────────────────────────

describe('PacksPromosPage — guardar un bundle válido (FIX 2, happy path)', () => {
  // `crypto.randomUUID` no existe en el jsdom de jest-environment-jsdom 29 y
  // `handleSave` lo usa para el `id` de un BUNDLE nuevo. Se parcha solo para este
  // describe agregando el método al objeto `crypto` existente (sin reemplazar el
  // global) y se limpia en `afterAll`.
  type PatchTarget = { randomUUID?: () => string };
  let patchedTarget: PatchTarget | null = null;
  beforeAll(() => {
    const cryptoObj = globalThis.crypto as (Crypto & PatchTarget) | undefined;
    if (!cryptoObj) {
      Object.defineProperty(globalThis, 'crypto', {
        configurable: true,
        value: { randomUUID: () => 'test-uuid-1' },
      });
      patchedTarget = globalThis.crypto as unknown as PatchTarget;
      return;
    }
    if (typeof cryptoObj.randomUUID !== 'function') {
      Object.defineProperty(cryptoObj, 'randomUUID', {
        configurable: true,
        writable: true,
        value: () => 'test-uuid-1',
      });
      patchedTarget = cryptoObj;
    }
  });
  afterAll(() => {
    if (patchedTarget) {
      Reflect.deleteProperty(patchedTarget, 'randomUUID');
      patchedTarget = null;
    }
  });

  async function fillNameAndChannel(modal: Modal, user: User, name: string) {
    await user.type(modal.getByPlaceholderText(/Pantalón Denim/), name);
    await user.click(modal.getByRole('checkbox', { name: /tienda fisica/i }));
  }

  function readStoredBundles(): BundlePack[] {
    return mockSharedBundles.filter((pack) => pack.schemaVersion === 2);
  }

  it('guarda un bundle de 2 productos: toast.success, modal cerrado y pack compartido en el servidor', async () => {
    mockGetProducts.mockResolvedValue([
      mkProduct('pa', 'Producto A', 10),
      mkProduct('pb', 'Producto B', 20),
    ]);

    const user = userEvent.setup();
    renderPage();
    const modal = await openNewPackModal(user);
    await user.click(modal.getByRole('button', { name: /bundle/i }));
    await fillNameAndChannel(modal, user, 'Combo Dúo');

    await waitFor(() =>
      expect(modal.getAllByRole('combobox', { name: /^Producto \d/ })[0]).toHaveTextContent(/Producto A/),
    );
    await user.selectOptions(modal.getAllByRole('combobox', { name: /^Producto \d/ })[0], 'pa');
    await user.selectOptions(modal.getAllByRole('combobox', { name: /^Producto \d/ })[1], 'pb');
    await selectBundleVariant(modal, user, 1, 'v-pa');
    await selectBundleVariant(modal, user, 2, 'v-pb');

    // PVP total = 10 + 20 = 30; el bundle sale 25 (< 30) → válido.
    await user.type(modal.getByRole('spinbutton'), '25');
    await user.click(modal.getByRole('button', { name: /guardar pack/i }));

    // Comportamiento observable: aviso de éxito + modal cerrado.
    await waitFor(() =>
      expect(mockToast.success).toHaveBeenCalledWith('Pack creado'),
    );
    await waitFor(() =>
      expect(screen.queryByTestId('pack-form-modal')).not.toBeInTheDocument(),
    );
    // BUNDLE usa su recurso compartido y no modifica promos VOLUME.
    expect(mockCreateVolumePromo).not.toHaveBeenCalled();

    // Persistencia compartida con el mismo shape de variantes.
    await waitFor(() => expect(readStoredBundles()).toHaveLength(1));
    const [stored] = readStoredBundles();
    expect(stored).toMatchObject({
      type: 'BUNDLE',
      name: 'Combo Dúo',
      packPrice: 25,
    });
    expect(stored.id).toEqual(expect.any(String));
    expect(stored.id.length).toBeGreaterThan(0);
    expect(stored.items).toHaveLength(2);
    expect(stored.items.map((i) => i.productId)).toEqual(['pa', 'pb']);
    expect(stored.items.map((i) => i.price)).toEqual([10, 20]);
  });

  it('guarda un bundle de 3 productos ejercitando la lista dinámica de filas', async () => {
    mockGetProducts.mockResolvedValue([
      mkProduct('pa', 'Producto A', 10),
      mkProduct('pb', 'Producto B', 20),
      mkProduct('pc', 'Producto C', 30),
    ]);

    const user = userEvent.setup();
    renderPage();
    const modal = await openNewPackModal(user);
    await user.click(modal.getByRole('button', { name: /bundle/i }));
    await fillNameAndChannel(modal, user, 'Combo Trío');

    // Tercera fila desde "＋ Agregar producto" (lista dinámica de FIX 2).
    await user.click(modal.getByRole('button', { name: /agregar producto/i }));
    await waitFor(() =>
      expect(modal.getAllByRole('combobox', { name: /^Producto \d/ })).toHaveLength(3),
    );
    await waitFor(() =>
      expect(modal.getAllByRole('combobox', { name: /^Producto \d/ })[2]).toHaveTextContent(/Producto C/),
    );

    await user.selectOptions(modal.getAllByRole('combobox', { name: /^Producto \d/ })[0], 'pa');
    await user.selectOptions(modal.getAllByRole('combobox', { name: /^Producto \d/ })[1], 'pb');
    await selectBundleVariant(modal, user, 1, 'v-pa');
    await selectBundleVariant(modal, user, 2, 'v-pb');
    await user.selectOptions(modal.getAllByRole('combobox', { name: /^Producto \d/ })[2], 'pc');
    await selectBundleVariant(modal, user, 3, 'v-pc');

    // PVP total = 10 + 20 + 30 = 60; el bundle sale 45 (< 60) → válido.
    await user.type(modal.getByRole('spinbutton'), '45');
    await user.click(modal.getByRole('button', { name: /guardar pack/i }));

    await waitFor(() =>
      expect(mockToast.success).toHaveBeenCalledWith('Pack creado'),
    );
    await waitFor(() =>
      expect(screen.queryByTestId('pack-form-modal')).not.toBeInTheDocument(),
    );

    await waitFor(() => expect(readStoredBundles()).toHaveLength(1));
    const [stored] = readStoredBundles();
    expect(stored).toMatchObject({
      type: 'BUNDLE',
      name: 'Combo Trío',
      packPrice: 45,
    });
    expect(stored.id).toEqual(expect.any(String));
    expect(stored.id.length).toBeGreaterThan(0);
    expect(stored.items).toHaveLength(3);
    expect(stored.items.map((i) => i.productId)).toEqual(['pa', 'pb', 'pc']);
    expect(stored.items.map((i) => i.price)).toEqual([10, 20, 30]);
  });
});

// ── FIX 1 — rama de error: falla la carga del catálogo ─────────────────────

describe('PacksPromosPage — bundles con variantes exactas', () => {
  const variantsKey = `powip.packs.variants.v1.${COMPANY_ID}`;
  const legacyKey = `powip.packs.local.${COMPANY_ID}`;
  const supplementVariants = [
    { id: 'mag-150', sku: 'MAG-150', attributeValues: { Tamaño: '150 gramos' }, priceVta: '49.00', isActive: true },
    { id: 'mag-300', sku: 'MAG-300', attributeValues: { Tamaño: '300 gramos' }, priceVta: '79.00', isActive: true },
  ];
  const secondVariant = { id: 'vit-1', sku: 'VIT-1', attributeValues: { Sabor: 'Naranja' }, priceVta: 20, isActive: true };

  function readVariants(): BundlePack[] {
    return mockSharedBundles.filter((pack) => pack.schemaVersion === 2);
  }

  function legacyBundle(withIds = true): BundlePack {
    return {
      id: 'legacy-salud', type: 'BUNDLE', name: 'Kit anterior', active: true, channels: ['TIENDA_FISICA'], packPrice: 60,
      items: [
        { ...(withIds ? { productId: 'mag' } : {}), productKey: 'Magnesio', productName: 'Magnesio', price: 49 },
        { ...(withIds ? { productId: 'vit' } : {}), productKey: 'Vitamina', productName: 'Vitamina', price: 20 },
      ],
    };
  }

  beforeEach(() => {
    Object.defineProperty(globalThis.crypto, 'randomUUID', { configurable: true, value: () => 'bundle-exacto' });
    mockGetProducts.mockResolvedValue([mkProduct('mag', 'Magnesio', 49), mkProduct('vit', 'Vitamina', 20)]);
    mockGetVariants.mockImplementation(async (url) => ({
      data: String(url).endsWith('/mag') ? supplementVariants : [secondVariant],
    }));
  });

  async function newBundle(user: User) {
    const modal = await openNewPackModal(user);
    await user.click(modal.getByRole('button', { name: /bundle/i }));
    await user.type(modal.getByPlaceholderText(/Pantalón Denim/), 'Kit salud');
    await user.click(modal.getByRole('checkbox', { name: /tienda fisica/i }));
    await waitFor(() => expect(modal.getByRole('combobox', { name: 'Producto 1...' })).toHaveTextContent('Magnesio'));
    await user.selectOptions(modal.getByRole('combobox', { name: 'Producto 1...' }), 'mag');
    await user.selectOptions(modal.getByRole('combobox', { name: 'Producto 2...' }), 'vit');
    return modal;
  }

  it('permite elegir 300 gramos, usa su precio y conserva variante/atributos/SKU al recargar y editar', async () => {
    const user = userEvent.setup();
    const view = renderPage();
    let modal = await newBundle(user);
    const selector = modal.getByRole('combobox', { name: 'Variante 1...' });
    await waitFor(() => expect(selector).toHaveTextContent('Tamaño: 300 gramos · SKU: MAG-300 — S/ 79.00'));
    expect(selector).toHaveTextContent('Tamaño: 150 gramos · SKU: MAG-150 — S/ 49.00');
    expect(selector).toHaveValue('');
    await user.selectOptions(selector, 'mag-300');
    await selectBundleVariant(modal, user, 2, 'vit-1');
    // 80 is above the product report's 49 + 20 but below the selected 79 + 20.
    await user.type(modal.getByRole('spinbutton'), '80');
    await user.click(modal.getByRole('button', { name: /guardar pack/i }));
    await waitFor(() => expect(readVariants()).toHaveLength(1));
    expect(readVariants()[0]).toMatchObject({
      schemaVersion: 2, packPrice: 80,
      items: [
        { productId: 'mag', variantId: 'mag-300', sku: 'MAG-300', attributes: { Tamaño: '300 gramos' }, price: 79 },
        { productId: 'vit', variantId: 'vit-1', sku: 'VIT-1', attributes: { Sabor: 'Naranja' }, price: 20 },
      ],
    });
    expect(JSON.parse(window.localStorage.getItem(legacyKey) ?? '[]')).toEqual([]);
    expect(mockGetVariants).toHaveBeenCalledWith(expect.stringMatching(/\/product-variant\/by-product\/mag$/));
    view.unmount();
    renderPage();
    expect(await screen.findByText(/Magnesio \(Tamaño: 300 gramos · SKU: MAG-300\)/)).toBeInTheDocument();
    modal = await openEditModal(user, 'Kit salud');
    expect(modal.getByRole('combobox', { name: 'Variante 1...' })).toHaveValue('mag-300');
    await selectBundleVariant(modal, user, 1, 'mag-150');
    await user.clear(modal.getByRole('spinbutton'));
    await user.type(modal.getByRole('spinbutton'), '60');
    await user.click(modal.getByRole('button', { name: /guardar pack/i }));
    await waitFor(() => expect(readVariants()[0].items[0]).toMatchObject({ variantId: 'mag-150', price: 49, sku: 'MAG-150', attributes: { Tamaño: '150 gramos' } }));
    expect(mockToast.success).toHaveBeenCalledWith('Pack actualizado');
  });

  it('exige selección explícita aunque el segundo producto tenga una sola variante', async () => {
    const user = userEvent.setup();
    renderPage();
    const modal = await newBundle(user);
    await selectBundleVariant(modal, user, 1, 'mag-300');
    await waitFor(() => expect(modal.getByRole('combobox', { name: 'Variante 2...' })).toHaveTextContent('VIT-1'));
    expect(modal.getByRole('combobox', { name: 'Variante 2...' })).toHaveValue('');
    await user.type(modal.getByRole('spinbutton'), '60');
    await user.click(modal.getByRole('button', { name: /guardar pack/i }));
    expect(await modal.findByText(/selecciona una variante específica para cada producto/i)).toBeInTheDocument();
    expect(readVariants()).toEqual([]);
  });

  it('cambiar producto limpia su variante y mantiene la regla de productos distintos', async () => {
    const user = userEvent.setup();
    renderPage();
    const modal = await newBundle(user);
    await selectBundleVariant(modal, user, 1, 'mag-300');
    await user.selectOptions(modal.getByRole('combobox', { name: 'Producto 1...' }), 'vit');
    expect(modal.getByRole('combobox', { name: 'Variante 1...' })).toHaveValue('');
    expect(modal.getByRole('combobox', { name: 'Variante 1...' })).not.toHaveTextContent('MAG-300');
    await user.type(modal.getByRole('spinbutton'), '30');
    await user.click(modal.getByRole('button', { name: /guardar pack/i }));
    expect(await modal.findByText(/los productos del bundle deben ser distintos/i)).toBeInTheDocument();
    expect(readVariants()).toEqual([]);
  });

  it('muestra el alcance anterior y permite renombrar sin inventar variantes ni convertirlo', async () => {
    const original = legacyBundle(false);
    seedLocalPacks(COMPANY_ID, [original]);
    const user = userEvent.setup();
    renderPage();
    expect(await screen.findByText(/bundle anterior: aplica por producto/i)).toBeInTheDocument();
    const modal = await openEditModal(user, original.name);
    expect(modal.getByText(/puedes cambiar nombre, canales o precio conservándolo/i)).toBeInTheDocument();
    expect(mockGetVariants).not.toHaveBeenCalled();
    await user.clear(modal.getByPlaceholderText(/Pantalón Denim/));
    await user.type(modal.getByPlaceholderText(/Pantalón Denim/), 'Kit renombrado');
    await user.click(modal.getByRole('button', { name: /guardar pack/i }));
    await waitFor(() => expect(screen.queryByTestId('pack-form-modal')).not.toBeInTheDocument());
    const [saved] = mockSharedBundles;
    expect(saved).toEqual({ ...original, name: 'Kit renombrado', shared: true, synced: false });
    expect(saved).not.toHaveProperty('schemaVersion');
    expect(readVariants()).toEqual([]);
  });

  it('convierte un bundle anterior solo después de elegir todas las variantes', async () => {
    seedLocalPacks(COMPANY_ID, [legacyBundle()]);
    const user = userEvent.setup();
    renderPage();
    const modal = await openEditModal(user, 'Kit anterior');
    await waitFor(() => expect(modal.getByRole('combobox', { name: 'Variante 1...' })).toHaveTextContent('MAG-300'));
    expect(modal.getByRole('combobox', { name: 'Variante 1...' })).toHaveValue('');
    await selectBundleVariant(modal, user, 1, 'mag-300');
    expect(modal.getByText(/estás convirtiendo este bundle/i)).toBeInTheDocument();
    await user.click(modal.getByRole('button', { name: /guardar pack/i }));
    expect(await modal.findByText(/selecciona una variante específica para cada producto/i)).toBeInTheDocument();
    expect(readVariants()).toEqual([]);
    await selectBundleVariant(modal, user, 2, 'vit-1');
    await user.click(modal.getByRole('button', { name: /guardar pack/i }));
    await waitFor(() => expect(readVariants()).toHaveLength(1));
    expect(readVariants()[0]).toMatchObject({ id: 'legacy-salud', schemaVersion: 2 });
    expect(JSON.parse(window.localStorage.getItem(legacyKey) ?? '[]')).toEqual([]);
  });

  it('un error al pedir variantes ofrece reintento y no escoge otra presentación', async () => {
    mockGetVariants.mockRejectedValue(new AxiosError('unavailable', 'ERR_BAD_RESPONSE', undefined, undefined, { status: 403 } as never));
    const user = userEvent.setup();
    renderPage();
    const modal = await newBundle(user);
    await waitFor(() => expect(modal.getAllByRole('button', { name: /reintentar variantes/i })).toHaveLength(2));
    expect(modal.getByRole('combobox', { name: 'Variante 1...' })).toBeDisabled();
    mockGetVariants.mockResolvedValue({ data: supplementVariants });
    await user.click(modal.getAllByRole('button', { name: /reintentar variantes/i })[0]);
    await waitFor(() => expect(modal.getByRole('combobox', { name: 'Variante 1...' })).toHaveTextContent('MAG-300'));
    expect(modal.getByRole('combobox', { name: 'Variante 1...' })).toHaveValue('');
    expect(readVariants()).toEqual([]);
  });

  it('no ofrece variantes inactivas o con precios inválidos', async () => {
    mockGetVariants.mockResolvedValue({ data: [
      ...supplementVariants,
      { ...supplementVariants[0], id: 'inactive', sku: 'INACTIVE', isActive: false },
      { ...supplementVariants[0], id: 'bad-price', sku: 'BAD-PRICE', priceVta: 'invalid' },
    ] });
    const user = userEvent.setup();
    renderPage();
    const modal = await newBundle(user);
    const selector = modal.getByRole('combobox', { name: 'Variante 1...' });
    await waitFor(() => expect(selector).toHaveTextContent('MAG-300'));
    expect(selector).not.toHaveTextContent('INACTIVE');
    expect(selector).not.toHaveTextContent('BAD-PRICE');
  });

  it('no consulta variantes sin una sesión autenticada', async () => {
    const value = authValue({ id: COMPANY_ID, name: 'ACME' });
    mockUseAuth.mockReturnValue({ ...value, auth: { ...value.auth, accessToken: '' } } as unknown as ReturnType<typeof useAuth>);
    seedLocalPacks(COMPANY_ID, [legacyBundle()]);
    const user = userEvent.setup();
    renderPage();
    expect(await screen.findByText('Kit anterior')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /editar/i })).not.toBeInTheDocument();
    expect(mockGetVariants).not.toHaveBeenCalled();
  });

  it('limpia los componentes del formulario al cambiar de empresa', async () => {
    const user = userEvent.setup();
    const view = renderPage();
    const modal = await newBundle(user);
    await selectBundleVariant(modal, user, 1, 'mag-300');
    mockUseAuth.mockReturnValue(authValue({ id: 'company-2', name: 'Otra empresa' }) as unknown as ReturnType<typeof useAuth>);
    view.rerender(<QueryClientProvider client={new QueryClient()}><PacksPromosPage /></QueryClientProvider>);
    const freshModal = within(await screen.findByTestId('pack-form-modal'));
    expect(freshModal.getByPlaceholderText(/Pantalón Denim/)).toHaveValue('');
    await user.click(freshModal.getByRole('button', { name: /bundle/i }));
    await waitFor(() => expect(freshModal.getByRole('combobox', { name: 'Producto 1...' })).toHaveTextContent('Magnesio'));
    expect(freshModal.getByRole('combobox', { name: 'Producto 1...' })).toHaveValue('');
    expect(freshModal.queryByRole('combobox', { name: 'Variante 1...' })).not.toBeInTheDocument();
    expect(window.localStorage.getItem('powip.packs.variants.v1.company-2')).toBe('[]');
  });
});

describe('PacksPromosPage — error al cargar el catálogo de productos (FIX 1)', () => {
  it('dispara toast.error genérico (id "...-generic") cuando getProducts rechaza', async () => {
    mockGetProducts.mockRejectedValue(new Error('boom'));

    const user = userEvent.setup();
    renderPage(); // QueryClient de renderPage: retry: false + retryDelay: 0
    await openNewPackModal(user); // abre en el tab Volumen

    await waitFor(
      () =>
        expect(mockToast.error).toHaveBeenCalledWith(
          'No se pudo cargar el catálogo de productos.',
          expect.objectContaining({ id: 'packs-catalog-load-error-generic' }),
        ),
      { timeout: 3000 },
    );
  });
});

// ── Hardening (2da ronda) — 403 "sin empresa" vs error genérico del catálogo ─

/**
 * `useProductCatalog` deriva `errorReason: "no-company" | "generic" | null`:
 *
 * - Un 403 de `GET /products/report` (en ms-products el único 403 de ese
 *   endpoint es la cuenta autenticada sin empresa en el JWT — aislamiento
 *   multi-tenant intencional) → `errorReason: "no-company"`: nota inline ámbar
 *   dentro del modal + `toast.error` con copy propio e id
 *   `"packs-catalog-load-error-no-company"`.
 * - Cualquier otro error (5xx, AxiosError de red sin `response`, error JS
 *   plano) → `errorReason: "generic"`: `toast.error("No se pudo cargar el
 *   catálogo de productos.", { id: "packs-catalog-load-error-generic" })`, sin
 *   nota inline. El sufijo por caso en el id evita que sonner pise un aviso con
 *   el otro.
 * - La nota inline la deriva una instancia del hook a nivel de modal
 *   (`catalogError`, `enabled: type === "VOLUME" || type === "BUNDLE"`), así que
 *   aparece en AMBOS tabs, no sólo Volumen.
 * - `retry` del hook corta 4xx (reintento inútil); 5xx y errores JS reintentan
 *   una vez. Una AxiosError de red sin `response` cuenta como `status 0 < 500`
 *   → tampoco reintenta.
 *
 * `sonner` está mockeado (jest.fn): el texto de los toasts NO llega al DOM, así
 * que `findByText`/`queryByText` sobre la nota sólo pueden matchear la nota
 * inline real que renderiza `PackFormModal`.
 */
describe('PacksPromosPage — catálogo: 403 "sin empresa" vs error genérico (hardening 2da ronda)', () => {
  const NO_COMPANY_NOTE = /no tiene una empresa asignada/i;

  /** AxiosError con `response.status`. `axios.isAxiosError` sólo mira
   *  `isAxiosError === true` (lo setea el constructor); el `status` lo lee el
   *  hook vía `error.response?.status`. */
  const axiosErrorWithStatus = (status: number): Error => {
    const err = new AxiosError(`Request failed with status code ${status}`);
    (err as unknown as { response: { status: number } }).response = { status };
    return err;
  };

  const expectGenericToast = () =>
    waitFor(
      () =>
        expect(mockToast.error).toHaveBeenCalledWith(
          'No se pudo cargar el catálogo de productos.',
          expect.objectContaining({ id: 'packs-catalog-load-error-generic' }),
        ),
      { timeout: 3000 },
    );

  it('403 en el tab Volumen: nota inline visible + toast específico con id "...-no-company"', async () => {
    mockGetProducts.mockRejectedValue(axiosErrorWithStatus(403));

    const user = userEvent.setup();
    renderPage();
    const modal = await openNewPackModal(user); // abre en el tab Volumen

    expect(await modal.findByText(NO_COMPANY_NOTE)).toBeInTheDocument();

    await waitFor(() =>
      expect(mockToast.error).toHaveBeenCalledWith(
        expect.stringContaining('no tiene una empresa asignada'),
        expect.objectContaining({
          id: 'packs-catalog-load-error-no-company',
        }),
      ),
    );
  });

  it('403 con el modal en el tab Bundle: la misma nota inline aparece arriba de las filas de producto', async () => {
    mockGetProducts.mockRejectedValue(axiosErrorWithStatus(403));

    const user = userEvent.setup();
    renderPage();
    const modal = await openNewPackModal(user);
    await user.click(modal.getByRole('button', { name: /bundle/i }));

    // Las filas del bundle montan (2 comboboxes) y la nota convive con ellas.
    await waitFor(() =>
      expect(modal.getAllByRole('combobox', { name: /^Producto \d/ })).toHaveLength(2),
    );
    const note = await modal.findByText(NO_COMPANY_NOTE);

    // "arriba de": la nota precede en el DOM al primer selector de producto.
    const firstRow = modal.getAllByRole('combobox', { name: /^Producto \d/ })[0];
    expect(
      note.compareDocumentPosition(firstRow) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('500: toast genérico exacto (id "...-generic") y sin nota inline', async () => {
    mockGetProducts.mockRejectedValue(axiosErrorWithStatus(500));

    const user = userEvent.setup();
    renderPage();
    const modal = await openNewPackModal(user);

    await expectGenericToast();

    expect(modal.queryByText(NO_COMPANY_NOTE)).not.toBeInTheDocument();
    expect(mockToast.error).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        id: 'packs-catalog-load-error-no-company',
      }),
    );
  });

  it('AxiosError de red sin response (Network Error): cae en genérico, sin nota inline', async () => {
    mockGetProducts.mockRejectedValue(new AxiosError('Network Error'));

    const user = userEvent.setup();
    renderPage();
    const modal = await openNewPackModal(user);

    await expectGenericToast();
    expect(modal.queryByText(NO_COMPANY_NOTE)).not.toBeInTheDocument();
  });

  it('queryFn lanza un Error plano no-Axios: cae en genérico sin romper el modal', async () => {
    mockGetProducts.mockRejectedValue(new Error('kaboom no-axios'));

    const user = userEvent.setup();
    renderPage();
    const modal = await openNewPackModal(user);

    await expectGenericToast();
    expect(modal.queryByText(NO_COMPANY_NOTE)).not.toBeInTheDocument();
    // El modal sigue usable: el tab Volumen y su selector de producto siguen
    // montados (el error del catálogo no desmonta nada).
    expect(modal.getByRole('combobox')).toBeInTheDocument();
  });
});

// ── FIX 1 — dedupe del catálogo por queryKey compartida ────────────────────

describe('PacksPromosPage — dedupe del catálogo por queryKey compartida (FIX 1)', () => {
  it('varias filas de bundle sin búsquedas distintas colapsan en una sola llamada a getProducts', async () => {
    mockGetProducts.mockResolvedValue([mkProduct('pa', 'Producto A', 10)]);

    const user = userEvent.setup();
    renderPage();
    const modal = await openNewPackModal(user);
    await user.click(modal.getByRole('button', { name: /bundle/i }));

    await waitFor(() =>
      expect(modal.getAllByRole('combobox', { name: /^Producto \d/ })).toHaveLength(2),
    );

    // Hasta 4 filas de bundle: 4 instancias de useProductCatalog + la del tab
    // Volumen, todas con queryKey ["packs-catalog", ""] (sin tipear búsquedas).
    await user.click(modal.getByRole('button', { name: /agregar producto/i }));
    await user.click(modal.getByRole('button', { name: /agregar producto/i }));
    expect(modal.getAllByRole('combobox', { name: /^Producto \d/ })).toHaveLength(4);

    // react-query colapsa la request compartida en una sola.
    await waitFor(() => expect(mockGetProducts).toHaveBeenCalledTimes(1));
  });
});

// ── FIX 3 — buscador de inventario para regalos (tab GIFT) ──────────────────

describe('PacksPromosPage — buscador de inventario para regalos (tab GIFT)', () => {
  // Timing: la suite corre con timers reales (no hay `jest.useFakeTimers()`), así
  // que el debounce de 350ms de `useGiftInventorySearch` transcurre en tiempo de
  // pared. Para las aserciones "felices" envolvemos en `waitFor` con timeout
  // holgado (350ms de debounce + resolución async de react-query + ticks de
  // userEvent). Para la aserción negativa (`not.toHaveBeenCalled`) no se puede
  // esperar a que "nunca" pase algo: dejamos correr ~400ms reales dentro de
  // `act()` (> ventana del debounce) para vaciar cualquier timer/efecto pendiente
  // y recién ahí afirmamos — mismo criterio que el test de `getProducts` +
  // enabled gating de arriba.

  const SEARCH_PLACEHOLDER = /buscar producto del almacén por nombre o sku/i;

  it('editar un GiftPack con inventario resuelto: la búsqueda con debounce pega a searchInventoryItems, lista resultados y agrega el chip 🎁', async () => {
    mockUseAuth.mockReturnValue(
      authValue({ id: COMPANY_ID, name: 'ACME' }, [
        { id: 'inv-1', name: 'Almacén 1' },
      ]) as unknown as ReturnType<typeof useAuth>,
    );
    seedLocalPacks(COMPANY_ID, [mkGiftPack()]);
    mockSearchInventoryItems.mockResolvedValue({
      data: [
        mkInventoryItem('run', 'Zapatilla Run', 120),
        mkInventoryItem('sol', 'Sandalia Sol', 80),
      ],
      meta: { ...inventoryMeta, total: 2, totalPages: 1 },
    });

    const user = userEvent.setup();
    renderPage();
    const modal = await openEditModal(user, 'Regalo por Monto');

    // El modal abre en el tab Regalo: se ve el buscador propio del GIFT.
    const searchInput = await modal.findByPlaceholderText(SEARCH_PLACEHOLDER);

    // Enfocar abre el dropdown (`onFocus` → `setOpen(true)`); tipear un término
    // dispara el debounce interno de 350ms.
    await user.click(searchInput);
    await user.type(searchInput, 'zapa');

    // Tras la ventana del debounce, react-query refetchea con la queryKey nueva
    // → `searchInventoryItems` recibe el término y el inventario resuelto.
    await waitFor(
      () =>
        expect(mockSearchInventoryItems).toHaveBeenCalledWith(
          expect.objectContaining({
            inventoryId: 'inv-1',
            q: 'zapa',
            page: 1,
            limit: 20,
          }),
        ),
      { timeout: 2000 },
    );

    // El dropdown lista los productName devueltos por el service.
    expect(await modal.findByText('Zapatilla Run')).toBeInTheDocument();
    expect(modal.getByText('Sandalia Sol')).toBeInTheDocument();

    // Click en un resultado → se agrega como opción de regalo (chip "🎁 ...").
    await user.click(modal.getByText('Zapatilla Run'));
    expect(
      await modal.findByText(/🎁\s+Zapatilla Run/),
    ).toBeInTheDocument();
  });

  it('sin inventario resuelto (inventories: []) la query queda deshabilitada y searchInventoryItems no se llama', async () => {
    // `beforeEach` ya deja `authValue` con `inventories: []` →
    // `selectedInventory === ""` → `inventoryId === ""` en el modal.
    seedLocalPacks(COMPANY_ID, [mkGiftPack()]);

    const user = userEvent.setup();
    renderPage();
    const modal = await openEditModal(user, 'Regalo por Monto');

    const searchInput = await modal.findByPlaceholderText(SEARCH_PLACEHOLDER);
    await user.click(searchInput);
    await user.type(searchInput, 'zapa');

    // Dejamos correr la ventana del debounce (350ms) y algo más: con timers
    // reales `jest.advanceTimersByTime` no aplica.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 400));
    });

    // `enabled: !!inventoryId` con `inventoryId === ""` → react-query nunca
    // invoca la queryFn.
    expect(mockSearchInventoryItems).not.toHaveBeenCalled();
  });

  it('si searchInventoryItems rechaza, dispara toast.error con id estable', async () => {
    mockUseAuth.mockReturnValue(
      authValue({ id: COMPANY_ID, name: 'ACME' }, [
        { id: 'inv-1', name: 'Almacén 1' },
      ]) as unknown as ReturnType<typeof useAuth>,
    );
    seedLocalPacks(COMPANY_ID, [mkGiftPack()]);
    mockSearchInventoryItems.mockRejectedValue(new Error('boom'));

    const user = userEvent.setup();
    renderPage(); // el QueryClient de renderPage ya tiene retry: false
    const modal = await openEditModal(user, 'Regalo por Monto');

    // Con `inventoryId` resuelto la query arranca en el primer render (término
    // vacío); enfocar/tipear sólo agrega búsquedas que también fallan.
    const searchInput = await modal.findByPlaceholderText(SEARCH_PLACEHOLDER);
    await user.click(searchInput);
    await user.type(searchInput, 'zapa');

    await waitFor(
      () =>
        expect(mockToast.error).toHaveBeenCalledWith(
          'No se pudo cargar el inventario para regalos.',
          expect.objectContaining({ id: 'gift-inventory-load-error' }),
        ),
      { timeout: 2000 },
    );
  });
});
