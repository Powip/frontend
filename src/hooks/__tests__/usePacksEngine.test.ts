import { act, renderHook } from '@testing-library/react';
import { useState } from 'react';
import { usePacksEngine } from '../usePacksEngine';
import type { BundlePack, Pack, VolumePack } from '@/interfaces/IPack';
import type { CartItem } from '@/interfaces/IOrder';
import type { InventoryItemForSale } from '@/interfaces/IProduct';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const CHANNEL = 'TIENDA_FISICA';

const VALID_BUNDLE: BundlePack = {
  id: 'bundle-valido',
  type: 'BUNDLE',
  name: 'Combo Verano',
  active: true,
  channels: [CHANNEL],
  items: [
    { productKey: 'prod-a', productName: 'Producto A', price: 50 },
    { productKey: 'prod-b', productName: 'Producto B', price: 30 },
  ],
  packPrice: 70,
};

/**
 * Pack BUNDLE con shape corrupto: `items` no es un array (undefined), tal como
 * puede quedar persistido en localStorage por PacksContext.tsx en datos viejos.
 * Se castea porque el tipo `BundlePack` exige `items: PackProductRef[]` — el
 * objetivo del test es reproducir exactamente el dato corrupto real.
 */
const CORRUPTED_BUNDLE_UNDEFINED_ITEMS = {
  id: 'bundle-corrupto-undefined',
  type: 'BUNDLE',
  name: 'Combo Corrupto (items undefined)',
  active: true,
  channels: [CHANNEL],
  items: undefined,
  packPrice: 70,
} as unknown as BundlePack;

/** Variante del dato corrupto: `items` es un objeto en vez de array. */
const CORRUPTED_BUNDLE_NON_ARRAY_ITEMS = {
  id: 'bundle-corrupto-objeto',
  type: 'BUNDLE',
  name: 'Combo Corrupto (items objeto)',
  active: true,
  channels: [CHANNEL],
  items: { productKey: 'prod-a' },
  packPrice: 70,
} as unknown as BundlePack;

const VALID_VOLUME: VolumePack = {
  id: 'volume-valido',
  type: 'VOLUME',
  name: 'Lleva 3 paga 2',
  active: true,
  channels: [CHANNEL],
  product: { productKey: 'prod-a', productName: 'Producto A', price: 50 },
  variantFree: false,
  minQty: 3,
  packPrice: 100,
};

// ── Helper: render del hook con mocks mínimos ─────────────────────────────────

function renderEngine(packs: Pack[], cart: CartItem[] = []) {
  const setCart = jest.fn();
  const getVariantsForProduct = jest
    .fn()
    .mockResolvedValue([] as InventoryItemForSale[]);

  const { result } = renderHook(() =>
    usePacksEngine({
      packs,
      channel: CHANNEL,
      cart,
      setCart,
      getVariantsForProduct,
    }),
  );

  return { result, setCart, getVariantsForProduct };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('usePacksEngine — activePacksForProduct', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('devuelve un pack BUNDLE cuyo items es un array válido que contiene el productKey buscado', () => {
    const { result } = renderEngine([VALID_BUNDLE]);

    const active = result.current.activePacksForProduct('prod-a');

    expect(active).toHaveLength(1);
    expect(active[0].id).toBe('bundle-valido');
  });

  it('no incluye el pack BUNDLE cuando el productKey buscado no está en items', () => {
    const { result } = renderEngine([VALID_BUNDLE]);

    const active = result.current.activePacksForProduct('prod-inexistente');

    expect(active).toHaveLength(0);
  });

  // ── Regresión: items corrupto (no-array) no debe romper el hook ───────────
  //
  // Bug original: un pack BUNDLE persistido en localStorage (PacksContext.tsx)
  // con `items` no-array (dato corrupto de un shape viejo) hacía explotar
  // `activePacksForProduct` con un TypeError en `p.items.some(...)`. Al no
  // haber Error Boundary en el árbol de registrar-venta, React desmontaba
  // toda la página y el buscador de productos quedaba en blanco.
  describe('regresión — pack BUNDLE con items corrupto (no-array)', () => {
    it('no lanza excepción cuando items es undefined y excluye el pack corrupto del resultado', () => {
      const { result } = renderEngine([CORRUPTED_BUNDLE_UNDEFINED_ITEMS]);

      expect(() => result.current.activePacksForProduct('prod-a')).not.toThrow();
      expect(result.current.activePacksForProduct('prod-a')).toHaveLength(0);
    });

    it('no lanza excepción cuando items no es un array (objeto) y excluye el pack corrupto', () => {
      const { result } = renderEngine([CORRUPTED_BUNDLE_NON_ARRAY_ITEMS]);

      expect(() => result.current.activePacksForProduct('prod-a')).not.toThrow();
      expect(result.current.activePacksForProduct('prod-a')).toHaveLength(0);
    });

    it('excluye el pack BUNDLE corrupto pero sigue devolviendo los demás packs válidos del mismo listado', () => {
      const { result } = renderEngine([VALID_VOLUME, CORRUPTED_BUNDLE_UNDEFINED_ITEMS]);

      let active: Pack[] = [];
      expect(() => {
        active = result.current.activePacksForProduct('prod-a');
      }).not.toThrow();

      expect(active).toHaveLength(1);
      expect(active[0].id).toBe('volume-valido');
    });
  });
});

const EXACT_BUNDLE: BundlePack = {
  id: 'bundle-300g',
  schemaVersion: 2,
  type: 'BUNDLE',
  name: 'Kit salud 300 g',
  active: true,
  channels: [CHANNEL],
  items: [
    {
      productId: 'supplement', productKey: 'Suplemento', productName: 'Suplemento',
      variantId: 'supplement-300', sku: 'SUP-300', attributes: { Tamaño: '300 g' }, price: 100,
    },
    {
      productId: 'vitamin', productKey: 'Vitamina', productName: 'Vitamina',
      variantId: 'vitamin-1', price: 50,
    },
  ],
  packPrice: 120,
};

function cartLine(variantId: string, productName: string, price: number, quantity = 1): CartItem {
  return {
    id: `line-${variantId}`, inventoryItemId: `inventory-${variantId}`, variantId,
    sku: `SKU-${variantId}`, productName, quantity, price, pvp: price, discount: 0,
  };
}

function renderStatefulEngine(packs: Pack[], initialCart: CartItem[], channel = CHANNEL) {
  const getVariantsForProduct = jest.fn().mockResolvedValue([]);
  return renderHook(({ currentPacks, currentChannel }) => {
    const [cart, setCart] = useState(initialCart);
    const engine = usePacksEngine({
      packs: currentPacks, channel: currentChannel, cart, setCart, getVariantsForProduct,
    });
    return { ...engine, cart, setCart };
  }, { initialProps: { currentPacks: packs, currentChannel: channel } });
}

describe('usePacksEngine — bundles con variante exacta', () => {
  it('150 g no activa ni permite aplicar el bundle configurado para 300 g', () => {
    const cart = [cartLine('supplement-150', 'Suplemento', 49), cartLine('vitamin-1', 'Vitamina', 50)];
    const { result } = renderStatefulEngine([EXACT_BUNDLE], cart);

    expect(result.current.bundleQtyInCart(EXACT_BUNDLE.items[0])).toBe(0);
    expect(result.current.pendingHints).toEqual([]);
    act(() => expect(result.current.applyPack(EXACT_BUNDLE)).toBe(false));
    expect(result.current.cart).toEqual(cart);
    expect(result.current.appliedPacks).toEqual({});
  });

  it('en carrito mixto descuenta sólo 300 g y conserva cantidades, atributos y unidades', () => {
    const small = cartLine('supplement-150', 'Suplemento', 49, 2);
    const large = {
      ...cartLine('supplement-300', 'Suplemento', 100),
      trackingMode: 'SERIAL' as const, unitIds: ['unit-300'], attributes: { Tamaño: '300 g' },
    };
    const vitamin = cartLine('vitamin-1', 'Vitamina', 50);
    const { result } = renderStatefulEngine([EXACT_BUNDLE], [small, large, vitamin]);

    expect(result.current.pendingHints).toEqual([EXACT_BUNDLE]);
    act(() => expect(result.current.applyPack(EXACT_BUNDLE)).toBe(true));
    expect(result.current.cart).toEqual([
      small,
      { ...large, price: 80, packId: EXACT_BUNDLE.id },
      { ...vitamin, price: 40, packId: EXACT_BUNDLE.id },
    ]);

    act(() => result.current.undoPack(EXACT_BUNDLE.id));
    expect(result.current.cart[0]).toEqual(small);
    expect(result.current.cart[1]).toEqual({ ...large, packId: null });
    expect(result.current.cart[2]).toEqual({ ...vitamin, packId: null });
  });

  it('un producto renombrado sigue calificando por variantId', () => {
    const { result } = renderStatefulEngine([EXACT_BUNDLE], [
      cartLine('supplement-300', 'Magnificent renovado', 100),
      cartLine('vitamin-1', 'Nombre actualizado', 50),
    ]);
    expect(result.current.pendingHints).toEqual([EXACT_BUNDLE]);
    act(() => result.current.applyPack(EXACT_BUNDLE));
    expect(result.current.cart.map((line) => line.price)).toEqual([80, 40]);
  });

  it('productos distintos con el mismo nombre mantienen sus precios por variante', () => {
    const pack: BundlePack = {
      ...EXACT_BUNDLE,
      items: EXACT_BUNDLE.items.map((item) => ({ ...item, productKey: 'Mismo nombre', productName: 'Mismo nombre' })),
    };
    const unrelated = cartLine('another-variant', 'Mismo nombre', 90);
    const { result } = renderStatefulEngine([pack], [
      cartLine('supplement-300', 'Mismo nombre', 100),
      cartLine('vitamin-1', 'Mismo nombre', 50),
      unrelated,
    ]);
    act(() => result.current.applyPack(pack));
    expect(result.current.cart.map((line) => line.price)).toEqual([80, 40, 90]);
    expect(result.current.cart[2]).toEqual(unrelated);
  });

  it('un regalo de 300 g no satisface la condición del bundle', () => {
    const { result } = renderStatefulEngine([EXACT_BUNDLE], [
      { ...cartLine('supplement-300', 'Suplemento', 0), isGift: true },
      cartLine('vitamin-1', 'Vitamina', 50),
    ]);
    expect(result.current.pendingHints).toEqual([]);
    act(() => expect(result.current.applyPack(EXACT_BUNDLE)).toBe(false));
  });

  it('revalida el carrito al aplicar una sugerencia que ya perdió 300 g', () => {
    const { result } = renderStatefulEngine([EXACT_BUNDLE], [
      cartLine('supplement-300', 'Suplemento', 100), cartLine('vitamin-1', 'Vitamina', 50),
    ]);
    expect(result.current.pendingHints).toEqual([EXACT_BUNDLE]);
    act(() => result.current.setCart((cart) => cart.filter((line) => line.variantId !== 'supplement-300')));
    act(() => expect(result.current.applyPack(EXACT_BUNDLE)).toBe(false));
    expect(result.current.cart[0].price).toBe(50);
    expect(result.current.appliedPacks).toEqual({});
  });

  it('usa la configuración actual y rechaza un bundle desactivado o de otro canal', () => {
    const { result, rerender } = renderStatefulEngine([EXACT_BUNDLE], [
      cartLine('supplement-300', 'Suplemento', 100), cartLine('vitamin-1', 'Vitamina', 50),
    ]);
    rerender({ currentPacks: [{ ...EXACT_BUNDLE, active: false }], currentChannel: CHANNEL });
    act(() => expect(result.current.applyPack(EXACT_BUNDLE)).toBe(false));
    rerender({ currentPacks: [EXACT_BUNDLE], currentChannel: 'WHATSAPP' });
    act(() => expect(result.current.applyPack(EXACT_BUNDLE)).toBe(false));
    rerender({
      currentPacks: [{ ...EXACT_BUNDLE, items: [
        { ...EXACT_BUNDLE.items[0], variantId: 'supplement-450' }, EXACT_BUNDLE.items[1],
      ] }], currentChannel: CHANNEL,
    });
    act(() => expect(result.current.applyPack(EXACT_BUNDLE)).toBe(false));
    expect(result.current.cart.map((line) => line.price)).toEqual([100, 50]);
  });

  it('al cambiar 300 g por 150 g deshace la aplicación anterior aunque ambas variantes estén en carrito', () => {
    const small = cartLine('supplement-150', 'Suplemento', 50);
    const large = cartLine('supplement-300', 'Suplemento', 100);
    const vitamin = cartLine('vitamin-1', 'Vitamina', 50);
    const { result, rerender } = renderStatefulEngine([EXACT_BUNDLE], [small, large, vitamin]);
    act(() => result.current.applyPack(EXACT_BUNDLE));
    expect(result.current.cart[1].price).toBe(80);

    const edited: BundlePack = {
      ...EXACT_BUNDLE,
      packPrice: 80,
      items: [{ ...EXACT_BUNDLE.items[0], variantId: 'supplement-150', price: 50 }, EXACT_BUNDLE.items[1]],
    };
    rerender({ currentPacks: [edited], currentChannel: CHANNEL });
    expect(result.current.cart).toEqual([small, { ...large, packId: null }, { ...vitamin, packId: null }]);
    expect(result.current.appliedPacks).toEqual({});
    expect(result.current.pendingHints).toEqual([edited]);

    // Even a caller holding the old suggestion must apply the current refs.
    act(() => expect(result.current.applyPack(EXACT_BUNDLE)).toBe(true));
    expect(result.current.cart[0]).toEqual({ ...small, price: 40, packId: edited.id });
    expect(result.current.cart[1]).toEqual({ ...large, packId: null });
    expect(result.current.cart[2]).toEqual({ ...vitamin, price: 40, packId: edited.id });
    act(() => result.current.applyPack(edited));
    expect(result.current.cart[1]).toEqual({ ...large, packId: null });
  });

  it('invalida una aplicación si se añade un componente nuevo que aún no está aplicado', () => {
    const third = cartLine('third-1', 'Tercer producto', 30);
    const { result, rerender } = renderStatefulEngine([EXACT_BUNDLE], [
      cartLine('supplement-300', 'Suplemento', 100), cartLine('vitamin-1', 'Vitamina', 50), third,
    ]);
    act(() => result.current.applyPack(EXACT_BUNDLE));
    const edited: BundlePack = {
      ...EXACT_BUNDLE,
      items: [...EXACT_BUNDLE.items, {
        productKey: 'Tercer producto', productName: 'Tercer producto', variantId: 'third-1', price: 30,
      }],
    };
    rerender({ currentPacks: [edited], currentChannel: CHANNEL });
    expect(result.current.appliedPacks).toEqual({});
    expect(result.current.cart.map((line) => line.price)).toEqual([100, 50, 30]);
    expect(result.current.cart[2]).toEqual(third);
  });

  it.each([undefined, ''])('un bundle v2 incompleto con variantId %s nunca cae al nombre', (variantId) => {
    const incomplete: BundlePack = {
      ...EXACT_BUNDLE,
      items: [{ ...EXACT_BUNDLE.items[0], variantId }, EXACT_BUNDLE.items[1]],
    };
    const { result } = renderStatefulEngine([incomplete], [
      cartLine('supplement-150', 'Suplemento', 49), cartLine('vitamin-1', 'Vitamina', 50),
    ]);
    expect(result.current.pendingHints).toEqual([]);
    expect(result.current.activePacksForProduct('Suplemento')).toEqual([]);
    act(() => expect(result.current.applyPack(incomplete)).toBe(false));
  });

  it('v2 sin propiedad variantId tampoco usa la compatibilidad legacy', () => {
    const { variantId: _variantId, ...missingVariant } = EXACT_BUNDLE.items[0];
    const incomplete: BundlePack = { ...EXACT_BUNDLE, items: [missingVariant, EXACT_BUNDLE.items[1]] };
    const { result } = renderStatefulEngine([incomplete], [
      cartLine('supplement-150', 'Suplemento', 49), cartLine('vitamin-1', 'Vitamina', 50),
    ]);
    expect(result.current.pendingHints).toEqual([]);
    act(() => expect(result.current.applyPack(incomplete)).toBe(false));
  });

  it('badges exactos requieren una variante configurada, incluso si cambió su nombre', () => {
    const { result } = renderStatefulEngine([EXACT_BUNDLE], []);
    expect(result.current.activePacksForProduct('Suplemento')).toEqual([]);
    expect(result.current.activePacksForProduct('Suplemento', [
      { variantId: 'supplement-150', productName: 'Suplemento' },
    ])).toEqual([]);
    expect(result.current.activePacksForProduct('Nombre nuevo', [
      { variantId: 'supplement-300', productName: 'Nombre nuevo' },
    ])).toEqual([EXACT_BUNDLE]);
  });

  it('legacy sin versión conserva matching y aplicación por producto', () => {
    const { result } = renderStatefulEngine([VALID_BUNDLE], [
      cartLine('a-any-size', 'prod-a', 50), cartLine('b-any-size', 'prod-b', 30),
    ]);
    expect(result.current.pendingHints).toEqual([VALID_BUNDLE]);
    expect(result.current.bundleQtyInCart(VALID_BUNDLE.items[0])).toBe(1);
    act(() => expect(result.current.applyPack(VALID_BUNDLE)).toBe(true));
    expect(result.current.cart.map((line) => line.price)).toEqual([43.75, 26.25]);
  });
});
