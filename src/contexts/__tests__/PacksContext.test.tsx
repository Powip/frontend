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
import { renderHook, waitFor } from '@testing-library/react';
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
  jest.clearAllMocks();
  window.localStorage.clear();
  mockUseAuth.mockReturnValue(MOCK_AUTH as unknown as ReturnType<typeof useAuth>);
  mockListVolumePromos.mockResolvedValue([]);
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
