/**
 * Tests: inventoryItems.service — getStockByVariants (FEAT-17 Anexo B)
 *
 * Comportamiento verificado:
 * 1. Con 1..100 variantIds, hace un único POST a
 *    `{API_INVENTORY}/inventory-item/stock-by-variants` con
 *    `{ variantIds }` y devuelve `res.data` tal cual.
 * 2. Deduplica ids repetidos antes de armar el body (el backend limita a
 *    100 por request, así que no tiene sentido pagar el límite con
 *    duplicados).
 * 3. Con más de 100 ids, parte en bloques de 100 y hace un POST por
 *    bloque (en paralelo, vía `Promise.all`), concatenando los resultados
 *    de todos los bloques en un único array (`flat`).
 * 4. Con un array vacío, devuelve `[]` sin llamar a `axiosAuth.post`.
 *
 * `axiosAuth` está completamente mockeado — ninguna llamada HTTP real.
 * `NEXT_PUBLIC_API_INVENTORY` se fija ANTES de importar el módulo (vía
 * `jest.isolateModules`), mismo patrón que
 * `reconciliationTask.service.test.ts` — la URL base se resuelve una sola
 * vez al cargar el módulo.
 */

const FAKE_API_INVENTORY = 'http://localhost:9998';

jest.mock('@/lib/axiosAuth', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));

import axiosAuth from '@/lib/axiosAuth';
import type { VariantStock } from '@/services/inventoryItems.service';

type ServiceModule = typeof import('@/services/inventoryItems.service');

let getStockByVariants: ServiceModule['getStockByVariants'];

beforeAll(() => {
  process.env.NEXT_PUBLIC_API_INVENTORY = FAKE_API_INVENTORY;

  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('@/services/inventoryItems.service') as ServiceModule;
    getStockByVariants = mod.getStockByVariants;
  });
});

const mockPost = jest.mocked(axiosAuth.post);

function makeStock(variantId: string, overrides: Partial<VariantStock> = {}): VariantStock {
  return {
    variant_id: variantId,
    quantity: 0,
    reserved_quantity: 0,
    available: 0,
    inventories: [],
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('inventoryItems.service', () => {
  describe('getStockByVariants', () => {
    it('con <=100 ids, hace un único POST con { variantIds } y devuelve res.data tal cual', async () => {
      const stock = [makeStock('variant-1', { quantity: 5 }), makeStock('variant-2', { quantity: 3 })];
      mockPost.mockResolvedValueOnce({ data: stock });

      const result = await getStockByVariants(['variant-1', 'variant-2']);

      expect(mockPost).toHaveBeenCalledTimes(1);
      expect(mockPost).toHaveBeenCalledWith(
        `${FAKE_API_INVENTORY}/inventory-item/stock-by-variants`,
        { variantIds: ['variant-1', 'variant-2'] },
      );
      expect(result).toEqual(stock);
    });

    it('deduplica ids repetidos antes de armar el body', async () => {
      mockPost.mockResolvedValueOnce({ data: [makeStock('variant-1')] });

      await getStockByVariants(['variant-1', 'variant-2', 'variant-1']);

      expect(mockPost).toHaveBeenCalledTimes(1);
      expect(mockPost).toHaveBeenCalledWith(
        `${FAKE_API_INVENTORY}/inventory-item/stock-by-variants`,
        { variantIds: ['variant-1', 'variant-2'] },
      );
    });

    it('con más de 100 ids, parte en bloques de 100 y concatena los resultados de cada POST', async () => {
      const ids = Array.from({ length: 150 }, (_, i) => `variant-${i}`);
      const firstChunk = ids.slice(0, 100);
      const secondChunk = ids.slice(100, 150);
      const firstChunkStock = firstChunk.map((id) => makeStock(id));
      const secondChunkStock = secondChunk.map((id) => makeStock(id));

      // `chunks.map(async (chunk) => axiosAuth.post(...))` dispara ambos
      // POST sincrónicamente (antes de que cualquiera resuelva) y en el
      // orden de los bloques, así que las dos respuestas se encolan en ese
      // mismo orden con `mockResolvedValueOnce`.
      mockPost
        .mockResolvedValueOnce({ data: firstChunkStock })
        .mockResolvedValueOnce({ data: secondChunkStock });

      const result = await getStockByVariants(ids);

      expect(mockPost).toHaveBeenCalledTimes(2);
      expect(mockPost).toHaveBeenNthCalledWith(
        1,
        `${FAKE_API_INVENTORY}/inventory-item/stock-by-variants`,
        { variantIds: firstChunk },
      );
      expect(mockPost).toHaveBeenNthCalledWith(
        2,
        `${FAKE_API_INVENTORY}/inventory-item/stock-by-variants`,
        { variantIds: secondChunk },
      );
      expect(result).toHaveLength(150);
      expect(result).toEqual([...firstChunkStock, ...secondChunkStock]);
    });

    it('con un array vacío, devuelve [] sin llamar a axiosAuth.post', async () => {
      const result = await getStockByVariants([]);

      expect(result).toEqual([]);
      expect(mockPost).not.toHaveBeenCalled();
    });
  });
});
