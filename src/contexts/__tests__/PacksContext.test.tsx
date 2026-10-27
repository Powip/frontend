/**
 * Tests: PacksContext — sanitización de packs BUNDLE/GIFT leídos de localStorage
 *
 * Contexto (bug de producción, FEAT-07): datos corruptos de una versión previa
 * del shape de packs BUNDLE/GIFT persistidos en localStorage explotaban en
 * consumidores de usePacks() (ver regresión ya cubierta a nivel de hook en
 * src/hooks/__tests__/usePacksEngine.test.ts). El fix sanea el shape en el
 * origen (PacksContext) con `isValidLocalPack` antes de exponer `packs`.
 *
 * Comportamiento verificado:
 * 1. Un pack BUNDLE válido (items no vacío, cada item con productKey) aparece
 *    en `packs` y no dispara ningún toast.
 * 2. Un pack BUNDLE corrupto (items no es un array) se descarta silenciosamente
 *    del árbol (no aparece en `packs`) y dispara un toast.error de aviso.
 * 3. Un pack GIFT corrupto (gifts no es un array) tiene el mismo tratamiento.
 * 4. Una lista mixta (1 válido + 1 corrupto) conserva el válido, descarta el
 *    corrupto y dispara un único toast (no uno por cada pack corrupto ni por
 *    cada render).
 * 5. Si el JSON top-level de localStorage no es un array (ej. un objeto),
 *    `packs` local queda vacío sin lanzar ninguna excepción — comportamiento
 *    ya preexistente (`Array.isArray(parsed) ? parsed : []`), aquí solo se
 *    confirma con un test.
 * 6. Un pack GIFT con `gifts` siendo SÍ un array, pero con al menos un
 *    elemento malformado dentro (ej. `null` o `{}` sin variantId/productName/
 *    value) también se descarta por completo — vector más sutil que el de
 *    (3), cubierto por `isGiftOption` sobre cada elemento del array.
 * 7. Un pack GIFT válido con 2 elementos bien formados en `gifts` aparece
 *    normalmente y no dispara ningún toast (confirma que el guard de (6) no
 *    rompe el caso feliz con múltiples regalos).
 *
 * Nota sobre localStorage: se usa el localStorage real de jsdom (get/setItem)
 * en vez de un mock manual — jsdom lo implementa por completo y es el propio
 * `window.localStorage` que el componente bajo prueba usa, por lo que sembrar
 * datos con `window.localStorage.setItem(...)` antes de renderizar reproduce
 * el escenario real (JSON.stringify/JSON.parse incluidos) sin reimplementar
 * su semántica a mano.
 */

import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { listVolumePromos } from '@/services/promos.service';
import { PacksProvider, usePacks } from '../PacksContext';
import type { BundlePack, GiftPack } from '@/interfaces/IPack';

// ── Mocks de infraestructura ─────────────────────────────────────────────────

jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: jest.fn(),
}));

jest.mock('@/services/promos.service', () => ({
  listVolumePromos: jest.fn(),
  createVolumePromo: jest.fn(),
  updatePromo: jest.fn(),
  deletePromo: jest.fn(),
}));

// ── Casts ────────────────────────────────────────────────────────────────────

const mockUseAuth = jest.mocked(useAuth);
const mockListVolumePromos = jest.mocked(listVolumePromos);
const mockToast = toast as jest.Mocked<typeof toast>;

// ── Fixtures ─────────────────────────────────────────────────────────────────

const COMPANY_ID = 'company-1';
const DAMAGED_PACK_TOAST =
  'Se encontró un pack dañado y fue eliminado automáticamente. Si era necesario, volvé a crearlo.';

const MOCK_AUTH = {
  auth: {
    user: { id: 'user-1', email: 'test@powip.com', role: 'ADMIN', permissions: [] },
    company: { id: COMPANY_ID, name: 'Powip Test' },
    accessToken: 'fake-token',
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

const VALID_BUNDLE: BundlePack = {
  id: 'bundle-valido',
  type: 'BUNDLE',
  name: 'Combo Verano',
  active: true,
  channels: ['TIENDA_FISICA'],
  items: [{ productKey: 'prod-a', productName: 'Producto A', price: 50 }],
  packPrice: 70,
};

const EXACT_BUNDLE: BundlePack = {
  ...VALID_BUNDLE,
  id: 'bundle-300',
  schemaVersion: 2,
  items: [
    { productId: 'supplement', productKey: 'Suplemento', productName: 'Suplemento', variantId: 'variant-300', sku: 'SUP-300', attributes: { Tamaño: '300 g' }, price: 80 },
    { productId: 'vitamin', productKey: 'Vitamina', productName: 'Vitamina', variantId: 'variant-vitamin', sku: 'VIT', price: 40 },
  ],
};

function variantKey(companyId: string) {
  return `powip.packs.variants.v1.${companyId}`;
}

/** `items` es un objeto en vez de array — dato corrupto real de un shape viejo. */
const CORRUPT_BUNDLE = {
  id: 'bundle-corrupto',
  type: 'BUNDLE',
  name: 'Combo Corrupto',
  active: true,
  channels: ['TIENDA_FISICA'],
  items: { productKey: 'prod-a', productName: 'Producto A', price: 50 },
  packPrice: 70,
} as unknown as BundlePack;

/** `gifts` es `null` en vez de array. */
const CORRUPT_GIFT: GiftPack = {
  id: 'gift-corrupto',
  type: 'GIFT',
  name: 'Regalo Corrupto',
  active: true,
  channels: ['TIENDA_FISICA'],
  triggerBy: 'qty',
  minQty: 2,
  gifts: null as unknown as GiftPack['gifts'],
};

/** `gifts` SÍ es un array, pero contiene elementos malformados (sin
 *  variantId/productName/value) — vector más sutil, distinto de CORRUPT_GIFT. */
const CORRUPT_GIFT_ELEMENTS: GiftPack = {
  id: 'gift-elementos-corruptos',
  type: 'GIFT',
  name: 'Regalo Con Elementos Corruptos',
  active: true,
  channels: ['TIENDA_FISICA'],
  triggerBy: 'qty',
  minQty: 2,
  gifts: [null, { foo: 'bar' }] as unknown as GiftPack['gifts'],
};

/** Pack GIFT válido con 2 elementos bien formados en `gifts` (caso feliz). */
const VALID_GIFT: GiftPack = {
  id: 'gift-valido',
  type: 'GIFT',
  name: 'Regalo Válido',
  active: true,
  channels: ['TIENDA_FISICA'],
  triggerBy: 'qty',
  minQty: 2,
  gifts: [
    {
      variantId: 'variant-1',
      inventoryItemId: 'inv-1',
      sku: 'SKU-1',
      productName: 'Producto Regalo 1',
      value: 10,
    },
    {
      variantId: 'variant-2',
      inventoryItemId: 'inv-2',
      sku: 'SKU-2',
      productName: 'Producto Regalo 2',
      value: 20,
    },
  ],
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function storageKey(companyId: string) {
  return `powip.packs.local.${companyId}`;
}

function seedLocalStorage(companyId: string, value: unknown) {
  window.localStorage.setItem(storageKey(companyId), JSON.stringify(value));
}

function wrapper({ children }: { children: React.ReactNode }) {
  return <PacksProvider>{children}</PacksProvider>;
}

function renderPacks() {
  return renderHook(() => usePacks(), { wrapper });
}

// ── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
  window.localStorage.clear();
  mockUseAuth.mockReturnValue(MOCK_AUTH as unknown as ReturnType<typeof useAuth>);
  mockListVolumePromos.mockResolvedValue([]);
});

describe('PacksContext — variantes exactas y aislamiento por empresa', () => {
  it.each(['legacy', 'variants'])('conserva el bucket sano si hay JSON malformado en %s', async (damaged) => {
    seedLocalStorage(COMPANY_ID, [VALID_BUNDLE]);
    window.localStorage.setItem(variantKey(COMPANY_ID), JSON.stringify([EXACT_BUNDLE]));
    window.localStorage.setItem(damaged === 'legacy' ? storageKey(COMPANY_ID) : variantKey(COMPANY_ID), '{');
    const { result } = renderPacks();
    const expected = damaged === 'legacy' ? EXACT_BUNDLE : VALID_BUNDLE;
    await waitFor(() => expect(result.current.packs).toEqual([expected]));
    expect(mockToast.error).toHaveBeenCalledWith(DAMAGED_PACK_TOAST);
    await act(async () => expect(await result.current.addPack(VALID_GIFT)).toBe(true));
    expect(result.current.packs).toEqual([expected, VALID_GIFT]);
  });

  it('deja de cargar y oculta los packs al salir de la empresa durante una consulta', async () => {
    let resolveFirst!: (packs: never[]) => void;
    mockListVolumePromos.mockReturnValueOnce(new Promise((resolve) => { resolveFirst = resolve; }));
    seedLocalStorage(COMPANY_ID, [VALID_BUNDLE]);
    const { result, rerender } = renderPacks();
    await waitFor(() => expect(result.current.loading).toBe(true));
    mockUseAuth.mockReturnValue({ ...MOCK_AUTH, auth: null } as unknown as ReturnType<typeof useAuth>);
    rerender();
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.packs).toHaveLength(0);
    await act(async () => resolveFirst([]));
    expect(result.current.packs).toHaveLength(0);
  });

  it('guarda bundles exactos fuera de la clave que pueden leer clientes antiguos y los restaura', async () => {
    seedLocalStorage(COMPANY_ID, [VALID_BUNDLE, VALID_GIFT]);
    const { result, unmount } = renderPacks();
    await waitFor(() => expect(result.current.packs).toHaveLength(2));

    await act(async () => expect(await result.current.addPack(EXACT_BUNDLE)).toBe(true));
    expect(JSON.parse(window.localStorage.getItem(storageKey(COMPANY_ID))!)).toEqual([VALID_BUNDLE, VALID_GIFT]);
    expect(JSON.parse(window.localStorage.getItem(variantKey(COMPANY_ID))!)).toEqual([EXACT_BUNDLE]);
    unmount();

    const restored = renderPacks();
    await waitFor(() => expect(restored.result.current.packs).toHaveLength(3));
    expect(restored.result.current.packs.find((pack) => pack.id === EXACT_BUNDLE.id)).toEqual(EXACT_BUNDLE);
  });

  it('convierte un bundle legacy sólo al actualizarlo explícitamente y conserva regalos', async () => {
    seedLocalStorage(COMPANY_ID, [VALID_BUNDLE, VALID_GIFT]);
    const { result } = renderPacks();
    await waitFor(() => expect(result.current.packs).toHaveLength(2));
    const converted = { ...EXACT_BUNDLE, id: VALID_BUNDLE.id };

    await act(async () => expect(await result.current.updatePack(VALID_BUNDLE.id, converted)).toBe(true));
    expect(JSON.parse(window.localStorage.getItem(storageKey(COMPANY_ID))!)).toEqual([VALID_GIFT]);
    expect(JSON.parse(window.localStorage.getItem(variantKey(COMPANY_ID))!)).toEqual([converted]);
    expect(result.current.packs).toEqual([converted, VALID_GIFT]);
  });

  it('descarta un bundle v2 sin variante en lugar de tratarlo como legacy', async () => {
    const broken = { ...EXACT_BUNDLE, items: EXACT_BUNDLE.items.map(({ variantId: _variantId, ...item }) => item) };
    window.localStorage.setItem(variantKey(COMPANY_ID), JSON.stringify([broken]));
    const { result } = renderPacks();
    await waitFor(() => expect(mockToast.error).toHaveBeenCalledWith(DAMAGED_PACK_TOAST));
    expect(result.current.packs).toHaveLength(0);
  });

  it('prefiere la versión exacta ante un id duplicado y retira la copia legacy', async () => {
    seedLocalStorage(COMPANY_ID, [VALID_BUNDLE]);
    const converted = { ...EXACT_BUNDLE, id: VALID_BUNDLE.id };
    window.localStorage.setItem(variantKey(COMPANY_ID), JSON.stringify([converted]));
    const { result } = renderPacks();
    await waitFor(() => expect(result.current.packs).toEqual([converted]));
    expect(window.localStorage.getItem(storageKey(COMPANY_ID))).toBe('[]');
  });

  it('no escribe los bundles de A en B al cambiar de empresa', async () => {
    seedLocalStorage(COMPANY_ID, [VALID_BUNDLE]);
    seedLocalStorage('company-2', [VALID_GIFT]);
    window.localStorage.setItem(variantKey(COMPANY_ID), JSON.stringify([EXACT_BUNDLE]));
    const { result, rerender } = renderPacks();
    await waitFor(() => expect(result.current.packs).toHaveLength(2));

    mockUseAuth.mockReturnValue({ ...MOCK_AUTH, auth: { ...MOCK_AUTH.auth, company: { id: 'company-2' } } } as unknown as ReturnType<typeof useAuth>);
    rerender();
    await waitFor(() => expect(result.current.packs).toEqual([VALID_GIFT]));
    expect(JSON.parse(window.localStorage.getItem(storageKey(COMPANY_ID))!)).toEqual([VALID_BUNDLE]);
    expect(JSON.parse(window.localStorage.getItem(variantKey(COMPANY_ID))!)).toEqual([EXACT_BUNDLE]);
    expect(JSON.parse(window.localStorage.getItem(storageKey('company-2'))!)).toEqual([VALID_GIFT]);
    expect(window.localStorage.getItem(variantKey('company-2'))).toBe('[]');
  });

  it('ignora una respuesta tardía de packs del servidor de otra empresa', async () => {
    let resolveFirst!: (packs: never[]) => void;
    mockListVolumePromos.mockReturnValueOnce(new Promise((resolve) => { resolveFirst = resolve; }));
    seedLocalStorage('company-2', [VALID_GIFT]);
    const { result, rerender } = renderPacks();
    mockUseAuth.mockReturnValue({ ...MOCK_AUTH, auth: { ...MOCK_AUTH.auth, company: { id: 'company-2' } } } as unknown as ReturnType<typeof useAuth>);
    rerender();
    await waitFor(() => expect(result.current.packs).toEqual([VALID_GIFT]));
    await act(async () => resolveFirst([]));
    expect(result.current.packs).toEqual([VALID_GIFT]);
  });

  it('informa un error de persistencia sin mostrar el pack como guardado', async () => {
    const { result } = renderPacks();
    await waitFor(() => expect(window.localStorage.getItem(storageKey(COMPANY_ID))).toBe('[]'));
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Quota', 'QuotaExceededError'); });

    await act(async () => expect(await result.current.addPack(EXACT_BUNDLE)).toBe(false));
    expect(result.current.packs).toHaveLength(0);
    expect(mockToast.error).toHaveBeenCalledWith('No se pudieron guardar los packs locales en este navegador.');
  });

  it('revierte la escritura exacta si falla retirar la copia legacy al convertir', async () => {
    seedLocalStorage(COMPANY_ID, [VALID_BUNDLE]);
    const { result } = renderPacks();
    await waitFor(() => expect(result.current.packs).toEqual([VALID_BUNDLE]));
    const originalSet = Storage.prototype.setItem;
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
      if (key === storageKey(COMPANY_ID)) throw new DOMException('Quota', 'QuotaExceededError');
      originalSet.call(this, key, value);
    });
    await act(async () => expect(await result.current.updatePack(VALID_BUNDLE.id, { ...EXACT_BUNDLE, id: VALID_BUNDLE.id })).toBe(false));
    expect(result.current.packs).toEqual([VALID_BUNDLE]);
    expect(JSON.parse(window.localStorage.getItem(storageKey(COMPANY_ID))!)).toEqual([VALID_BUNDLE]);
    expect(window.localStorage.getItem(variantKey(COMPANY_ID))).toBe('[]');
  });

  it('persiste activar y eliminar un bundle exacto conservando los legacy', async () => {
    seedLocalStorage(COMPANY_ID, [VALID_BUNDLE]);
    window.localStorage.setItem(variantKey(COMPANY_ID), JSON.stringify([EXACT_BUNDLE]));
    const { result } = renderPacks();
    await waitFor(() => expect(result.current.packs).toHaveLength(2));
    await act(async () => { await result.current.togglePack(EXACT_BUNDLE.id); });
    expect(JSON.parse(window.localStorage.getItem(variantKey(COMPANY_ID))!)[0].active).toBe(false);
    await act(async () => expect(await result.current.deletePack(EXACT_BUNDLE.id)).toBe(true));
    expect(window.localStorage.getItem(variantKey(COMPANY_ID))).toBe('[]');
    expect(result.current.packs).toEqual([VALID_BUNDLE]);
  });
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe('PacksContext — sanitización de packs locales (BUNDLE/GIFT) leídos de localStorage', () => {
  it('expone un pack BUNDLE válido y no dispara ningún toast de aviso', async () => {
    seedLocalStorage(COMPANY_ID, [VALID_BUNDLE]);

    const { result } = renderPacks();

    await waitFor(() => {
      expect(result.current.packs.some((p) => p.id === 'bundle-valido')).toBe(true);
    });
    expect(mockToast.error).not.toHaveBeenCalled();
  });

  it('descarta un pack BUNDLE corrupto (items no es array) y avisa con toast.error', async () => {
    seedLocalStorage(COMPANY_ID, [CORRUPT_BUNDLE]);

    const { result } = renderPacks();

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith(DAMAGED_PACK_TOAST);
    });
    expect(result.current.packs.some((p) => p.id === 'bundle-corrupto')).toBe(false);
  });

  it('descarta un pack GIFT corrupto (gifts no es array) y avisa con toast.error', async () => {
    seedLocalStorage(COMPANY_ID, [CORRUPT_GIFT]);

    const { result } = renderPacks();

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith(DAMAGED_PACK_TOAST);
    });
    expect(result.current.packs.some((p) => p.id === 'gift-corrupto')).toBe(false);
  });

  it('en una lista mixta conserva el pack válido, descarta el corrupto y dispara un único toast', async () => {
    seedLocalStorage(COMPANY_ID, [VALID_BUNDLE, CORRUPT_GIFT]);

    const { result } = renderPacks();

    await waitFor(() => {
      expect(result.current.packs.some((p) => p.id === 'bundle-valido')).toBe(true);
    });
    expect(result.current.packs.some((p) => p.id === 'gift-corrupto')).toBe(false);
    expect(mockToast.error).toHaveBeenCalledTimes(1);
    expect(mockToast.error).toHaveBeenCalledWith(DAMAGED_PACK_TOAST);
  });

  it('si el JSON top-level no es un array (objeto), no expone packs locales y no lanza ninguna excepción', async () => {
    window.localStorage.setItem(
      storageKey(COMPANY_ID),
      JSON.stringify({ foo: 'bar' }),
    );

    const { result } = renderPacks();

    // Confirma que el efecto de saneo ya corrió (persiste el array local, ya
    // saneado, de vuelta en localStorage) antes de aserciones negativas.
    await waitFor(() => {
      expect(window.localStorage.getItem(storageKey(COMPANY_ID))).toBe('[]');
    });

    expect(result.current.packs).toHaveLength(0);
    expect(mockToast.error).not.toHaveBeenCalled();
  });

  it('descarta un pack GIFT con elementos malformados dentro de gifts (array con null/objeto vacío) y avisa con toast.error', async () => {
    seedLocalStorage(COMPANY_ID, [CORRUPT_GIFT_ELEMENTS]);

    const { result } = renderPacks();

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith(DAMAGED_PACK_TOAST);
    });
    expect(
      result.current.packs.some((p) => p.id === 'gift-elementos-corruptos'),
    ).toBe(false);
    expect(mockToast.error).toHaveBeenCalledTimes(1);
  });

  it('expone un pack GIFT válido con 2 elementos bien formados en gifts y no dispara ningún toast', async () => {
    seedLocalStorage(COMPANY_ID, [VALID_GIFT]);

    const { result } = renderPacks();

    await waitFor(() => {
      expect(result.current.packs.some((p) => p.id === 'gift-valido')).toBe(true);
    });
    expect(mockToast.error).not.toHaveBeenCalled();
  });
});
