/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Tests: PacksPromosPage (app/packs-promos/page.tsx) — fixes del modal "Nuevo pack"
 *
 * Contexto de los cambios probados (se testea COMPORTAMIENTO de usuario, no
 * detalle de implementación):
 *
 * FIX 1 — `useProductCatalog` ya no gatea por `companyId`.
 *   Antes: `if (!companyId) { setProducts([]); return; }` dejaba el buscador de
 *   productos del modal vacío cuando `auth.company` era null/undefined (bug
 *   reportado). Ahora usa react-query (`queryKey: ["packs-catalog", debounced]`,
 *   debounce 350ms) y el backend deriva la empresa del JWT, así que el
 *   `<Combobox>` de "Producto" carga el catálogo aunque no haya empresa en el
 *   contexto de auth.
 *
 * FIX 2 — Tab "Bundle": lista dinámica de 2 a 10 productos (antes 2 fijos).
 *   - Botón "＋ Agregar producto" visible mientras hay < 10 filas.
 *   - Botón "×" (aria-label "Quitar producto N") por fila, visible mientras hay
 *     > 2 filas; con exactamente 2 no se puede bajar más.
 *   - `handleSave` rama BUNDLE valida: mínimo 2 productos con valor, distintos,
 *     máximo 10, todos resueltos y precio del pack < suma de PVP.
 *
 * Comportamiento verificado:
 * 1. (FIX 1) Modal "Nuevo pack" con `auth.company = null` → pestaña Volumen → el
 *    Combobox de "Producto" ofrece las opciones de `getProducts` mockeado
 *    (el gate viejo ya no bloquea). Corazón del bug.
 * 2. (FIX 2) Tab Bundle arranca con 2 filas; "＋ Agregar producto" agrega hasta
 *    llegar a 10; al llegar a 10 el botón desaparece.
 * 3. (FIX 2) Con 2 filas no hay "×"; al pasar a 3 cada fila tiene "×"; quitar la
 *    fila del medio conserva la selección de las otras dos (keys estables).
 * 4. (FIX 2) Editar un BundlePack con 3 items (todos con `productId`) → el modal
 *    abre con 3 filas y cada Combobox muestra el producto ya elegido.
 * 5. (FIX 2) Editar un BundlePack legacy (items sin `productId`, solo
 *    `productKey`/`productName`) → abre con las 3 filas pobladas y los nombres
 *    visibles, no vacías.
 * 6. (FIX 2) Guardar un bundle con 1 solo producto → error "Un bundle requiere
 *    al menos 2 productos.". Guardar con precio ≥ suma de PVP → error de precio.
 * 7. (FIX 2 — happy path) Guardar un bundle válido (2 y 3 productos): se llama a
 *    `toast.success("Pack creado")`, el modal cierra y el pack queda persistido
 *    en `localStorage` (`powip.packs.local.<companyId>`) con `type: "BUNDLE"`,
 *    `items` con los `productId`/`price` de cada fila (en orden) y el `packPrice`
 *    elegido. Los BUNDLE van solo a localStorage, no tocan `promos.service`
 *    (ver `PacksContext.addPack`, rama `pack.type !== "VOLUME"`).
 * 8. (FIX 1 — rama de error) Si `getProducts` rechaza, `useProductCatalog`
 *    dispara `toast.error("No se pudo cargar el catálogo de productos.",
 *    { id: "packs-catalog-load-error" })`.
 * 9. (FIX 1 — dedupe) Con varias filas de bundle montadas y sin búsquedas
 *    distintas, todas las instancias del hook comparten
 *    `queryKey: ["packs-catalog", ""]` y react-query colapsa la carga del
 *    catálogo en una única llamada a `getProducts`.
 *
 * NOTA — `handleSave` rama BUNDLE llama a `crypto.randomUUID()` para el `id` de
 * un pack nuevo, y ese método no existe en el jsdom de jest-environment-jsdom 29.
 * El describe del happy path (7) lo define puntualmente en un `beforeAll` y
 * restaura el original en `afterAll`; el resto de los tests solo ejercita ramas
 * de validación que hacen `return` antes de esa línea.
 *
 * Work-arounds jsdom (mismo criterio que src/components/eva/__tests__/*):
 * - @/components/ui/dialog → contenedor plano visible cuando `open`. Como el
 *   mock no usa portal ni `aria-hidden`, la página de fondo (con sus botones de
 *   filtro "Volumen"/"Bundle"/...) sigue en el DOM: por eso las queries del
 *   modal se acotan con `within(getByTestId('pack-form-modal'))`.
 * - @/components/ui/combobox → `<select>` nativo (mismo rol accesible
 *   "combobox"): expone las `options` que le pasa el componente y reporta la
 *   selección por `onValueChange`. Radix Popover no funciona en jsdom.
 * - @/components/ui/checkbox → `<input type="checkbox">` nativo.
 */

import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// ── Mocks de infraestructura ─────────────────────────────────────────────────

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

jest.mock('@/api/Productos', () => ({
  getProducts: jest.fn(),
}));

jest.mock('@/services/promos.service', () => ({
  listVolumePromos: jest.fn(),
  createVolumePromo: jest.fn(),
  updatePromo: jest.fn(),
  deletePromo: jest.fn(),
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
  }: {
    value?: string;
    onValueChange?: (v: string) => void;
    options?: { value: string; label: string }[];
    placeholder?: string;
  }) => (
    <select
      aria-label={placeholder}
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

import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { getProducts } from '@/api/Productos';
import { listVolumePromos, createVolumePromo } from '@/services/promos.service';
import { searchInventoryItems } from '@/services/inventoryItems.service';
import type { IGetProducts } from '@/api/Interfaces';
import type { BundlePack } from '@/interfaces/IPack';
import PacksPromosPage from '../page';

// ── Casts ───────────────────────────────────────────────────────────────────

const mockUseAuth = jest.mocked(useAuth);
const mockGetProducts = jest.mocked(getProducts);
const mockListVolumePromos = jest.mocked(listVolumePromos);
const mockCreateVolumePromo = jest.mocked(createVolumePromo);
const mockSearchInventoryItems = jest.mocked(searchInventoryItems);
const mockToast = toast as jest.Mocked<typeof toast>;

// ── Fixtures / helpers ──────────────────────────────────────────────────────

const COMPANY_ID = 'company-1';
/** Está en SUPERADMIN_EMAILS (config/permissions.config) → habilita "Nuevo pack". */
const SUPERADMIN_EMAIL = 'octatoledo7@gmail.com';

function authValue(company: { id: string; name: string } | null) {
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
    inventories: [],
    refreshInventories: jest.fn(),
    hasPermission: jest.fn().mockReturnValue(true),
  };
}

const mkProduct = (id: string, name: string, priceVta: number) =>
  ({ id, name, priceVta } as unknown as IGetProducts);

function seedLocalPacks(companyId: string, packs: unknown) {
  window.localStorage.setItem(
    `powip.packs.local.${companyId}`,
    JSON.stringify(packs),
  );
}

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
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

// ── Setup ───────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  window.localStorage.clear();
  mockUseAuth.mockReturnValue(
    authValue({ id: COMPANY_ID, name: 'ACME' }) as unknown as ReturnType<
      typeof useAuth
    >,
  );
  mockGetProducts.mockResolvedValue([]);
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
});

// ── FIX 2 — tab Bundle: lista dinámica de filas ─────────────────────────────

describe('PacksPromosPage — tab Bundle: filas dinámicas de producto (FIX 2)', () => {
  it('arranca con 2 filas y "＋ Agregar producto" suma hasta 10, luego el botón desaparece', async () => {
    const user = userEvent.setup();
    renderPage();
    const modal = await openNewPackModal(user);
    await user.click(modal.getByRole('button', { name: /bundle/i }));

    await waitFor(() =>
      expect(modal.getAllByRole('combobox')).toHaveLength(2),
    );

    for (let filas = 3; filas <= 10; filas++) {
      await user.click(
        modal.getByRole('button', { name: /agregar producto/i }),
      );
      expect(modal.getAllByRole('combobox')).toHaveLength(filas);
    }

    // Con 10 filas el botón de agregar ya no se muestra.
    expect(
      modal.queryByRole('button', { name: /agregar producto/i }),
    ).not.toBeInTheDocument();
    expect(modal.getAllByRole('combobox')).toHaveLength(10);
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
      expect(modal.getAllByRole('combobox')).toHaveLength(2),
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
      expect(modal.getAllByRole('combobox')[0]).toHaveTextContent(/Producto A/),
    );
    await user.selectOptions(modal.getAllByRole('combobox')[0], 'pa');
    await user.selectOptions(modal.getAllByRole('combobox')[1], 'pb');
    await user.selectOptions(modal.getAllByRole('combobox')[2], 'pc');

    // Quitamos la fila del medio.
    await user.click(modal.getByRole('button', { name: 'Quitar producto 2' }));

    const selects = modal.getAllByRole('combobox');
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
      expect(modal.getAllByRole('combobox')).toHaveLength(3),
    );
    const selects = modal.getAllByRole('combobox');

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
      expect(modal.getAllByRole('combobox')).toHaveLength(3),
    );
    const selects = modal.getAllByRole('combobox');

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
      expect(modal.getAllByRole('combobox')[0]).toHaveTextContent(/Producto A/),
    );
    await user.selectOptions(modal.getAllByRole('combobox')[0], 'pa');

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
      expect(modal.getAllByRole('combobox')[0]).toHaveTextContent(/Producto A/),
    );
    await user.selectOptions(modal.getAllByRole('combobox')[0], 'pa');
    await user.selectOptions(modal.getAllByRole('combobox')[1], 'pb');

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
    const raw = window.localStorage.getItem(`powip.packs.local.${COMPANY_ID}`);
    return raw ? (JSON.parse(raw) as BundlePack[]) : [];
  }

  it('guarda un bundle de 2 productos: toast.success, modal cerrado y pack persistido en localStorage', async () => {
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
      expect(modal.getAllByRole('combobox')[0]).toHaveTextContent(/Producto A/),
    );
    await user.selectOptions(modal.getAllByRole('combobox')[0], 'pa');
    await user.selectOptions(modal.getAllByRole('combobox')[1], 'pb');

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
    // Los BUNDLE se persisten solo en localStorage: no tocan la Promos API.
    expect(mockCreateVolumePromo).not.toHaveBeenCalled();

    // Persistencia en localStorage con el shape correcto.
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
      expect(modal.getAllByRole('combobox')).toHaveLength(3),
    );
    await waitFor(() =>
      expect(modal.getAllByRole('combobox')[2]).toHaveTextContent(/Producto C/),
    );

    await user.selectOptions(modal.getAllByRole('combobox')[0], 'pa');
    await user.selectOptions(modal.getAllByRole('combobox')[1], 'pb');
    await user.selectOptions(modal.getAllByRole('combobox')[2], 'pc');

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

describe('PacksPromosPage — error al cargar el catálogo de productos (FIX 1)', () => {
  it('dispara toast.error con id estable cuando getProducts rechaza', async () => {
    mockGetProducts.mockRejectedValue(new Error('boom'));

    const user = userEvent.setup();
    renderPage(); // el QueryClient de renderPage ya tiene retry: false
    await openNewPackModal(user); // abre en el tab Volumen

    await waitFor(() =>
      expect(mockToast.error).toHaveBeenCalledWith(
        'No se pudo cargar el catálogo de productos.',
        expect.objectContaining({ id: 'packs-catalog-load-error' }),
      ),
    );
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
      expect(modal.getAllByRole('combobox')).toHaveLength(2),
    );

    // Hasta 4 filas de bundle: 4 instancias de useProductCatalog + la del tab
    // Volumen, todas con queryKey ["packs-catalog", ""] (sin tipear búsquedas).
    await user.click(modal.getByRole('button', { name: /agregar producto/i }));
    await user.click(modal.getByRole('button', { name: /agregar producto/i }));
    expect(modal.getAllByRole('combobox')).toHaveLength(4);

    // react-query colapsa la request compartida en una sola.
    await waitFor(() => expect(mockGetProducts).toHaveBeenCalledTimes(1));
  });
});
