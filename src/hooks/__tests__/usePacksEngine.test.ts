import { renderHook } from '@testing-library/react';
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
