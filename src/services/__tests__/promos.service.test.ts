/**
 * Tests: promos.service — listVolumePromos (mapToVolumePack)
 *
 * Contexto del fix: `ApiPromo.packPrice` (y minQty/maxQty) llegan como STRING
 * desde ms-ventas (columna Postgres `decimal` sin transformer, ej. "150.00").
 * Antes del fix, `mapToVolumePack` los dejaba pasar tal cual (`p.packPrice ?? 0`),
 * rompiendo cualquier `fmt()`/`toFixed()` que operara sobre el VolumePack
 * resultante. El fix envuelve `packPrice` en `Number.isFinite(Number(...))`
 * con fallback a 0, y `minQty`/`maxQty` en `Number(...)`.
 *
 * `mapToVolumePack` no está exportada — se verifica indirectamente a través
 * de `listVolumePromos`, mockeando `axiosAuth` (HTTP real de la Promos API)
 * y `getProducts` (resolución de nombre/precio contra ms-products).
 *
 * Comportamiento verificado:
 * 1. packPrice viene como string (ej. "150.00") → el VolumePack resultante
 *    tiene packPrice como number (150), no string.
 * 2. packPrice viene como number ya (no-regresión) → se mantiene sin cambios.
 * 3. packPrice null o no numérico (ej. "abc") → cae a 0, nunca NaN.
 * 4. packPrice undefined (dispara la ruta de "needsDetail", que re-consulta
 *    el detalle por id) → si el detalle tampoco trae un valor numérico válido,
 *    también cae a 0, nunca NaN.
 * 5. maxQty null se preserva como null (no se convierte en 0).
 * 6. minQty viene como string → se convierte a number.
 *
 * axiosAuth y getProducts están completamente mockeados — sin llamadas
 * reales a la red.
 */

jest.mock('@/lib/axiosAuth', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
  },
}));

jest.mock('@/api/Productos', () => ({
  __esModule: true,
  getProducts: jest.fn(),
}));

import axiosAuth from '@/lib/axiosAuth';
import { getProducts } from '@/api/Productos';
import { listVolumePromos } from '@/services/promos.service';

const mockGet = jest.mocked(axiosAuth.get);
const mockGetProducts = jest.mocked(getProducts);

// ── Fixtures ─────────────────────────────────────────────────────────────────

/** Promo "completa" (sin campos undefined) para no disparar la ruta needsDetail. */
function makeRawPromo(overrides: Record<string, unknown> = {}) {
  return {
    id: 'promo-1',
    companyId: 'company-1',
    name: 'Pack x3',
    type: 'VOLUME',
    productId: 'prod-1',
    minQty: 3,
    maxQty: 10,
    packPrice: 150,
    channels: ['WHATSAPP'],
    isActive: true,
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetProducts.mockResolvedValue([]);
});

describe('promos.service — listVolumePromos (mapToVolumePack)', () => {
  it('convierte packPrice de string (ej. "150.00") a number', async () => {
    mockGet.mockResolvedValueOnce({
      data: [makeRawPromo({ packPrice: '150.00' })],
    });

    const [result] = await listVolumePromos({ companyId: 'company-1' });

    expect(result.packPrice).toBe(150);
    expect(typeof result.packPrice).toBe('number');
  });

  it('no-regresión: packPrice ya numérico se mantiene sin cambios', async () => {
    mockGet.mockResolvedValueOnce({
      data: [makeRawPromo({ packPrice: 200 })],
    });

    const [result] = await listVolumePromos({ companyId: 'company-1' });

    expect(result.packPrice).toBe(200);
    expect(typeof result.packPrice).toBe('number');
  });

  it('packPrice null o no numérico cae a 0, nunca NaN', async () => {
    mockGet.mockResolvedValueOnce({
      data: [
        makeRawPromo({ id: 'promo-null', packPrice: null }),
        makeRawPromo({ id: 'promo-nan', packPrice: 'abc' }),
      ],
    });

    const [resultNull, resultNaN] = await listVolumePromos({
      companyId: 'company-1',
    });

    expect(resultNull.packPrice).toBe(0);
    expect(resultNull.packPrice).not.toBeNaN();
    expect(resultNaN.packPrice).toBe(0);
    expect(resultNaN.packPrice).not.toBeNaN();
  });

  it('packPrice undefined dispara la búsqueda de detalle y, si tampoco trae un valor válido, cae a 0', async () => {
    // El listado resumido no trae packPrice → needsDetail === true.
    mockGet.mockResolvedValueOnce({
      data: [makeRawPromo({ packPrice: undefined })],
    });
    // El detalle por id tampoco trae un packPrice numérico válido.
    mockGet.mockResolvedValueOnce({
      data: makeRawPromo({ packPrice: undefined }),
    });

    const [result] = await listVolumePromos({ companyId: 'company-1' });

    expect(mockGet).toHaveBeenCalledTimes(2);
    expect(result.packPrice).toBe(0);
    expect(result.packPrice).not.toBeNaN();
  });

  it('maxQty null se preserva como null, no se convierte en 0', async () => {
    mockGet.mockResolvedValueOnce({
      data: [makeRawPromo({ maxQty: null })],
    });

    const [result] = await listVolumePromos({ companyId: 'company-1' });

    expect(result.maxQty).toBeNull();
  });

  it('minQty viene como string y se convierte a number', async () => {
    mockGet.mockResolvedValueOnce({
      data: [makeRawPromo({ minQty: '5' })],
    });

    const [result] = await listVolumePromos({ companyId: 'company-1' });

    expect(result.minQty).toBe(5);
    expect(typeof result.minQty).toBe('number');
  });
});
