/**
 * Tests: evaService
 *
 * Comportamiento verificado:
 * 1. getEvaCredentials hace GET a /eva/credentials/:companyId con Bearer.
 * 2. getEvaCredentials retorna res.data cuando la respuesta es OK.
 * 3. getEvaCredentials retorna null cuando el servidor responde 404.
 * 4. getEvaCredentials propaga el error cuando el status NO es 404.
 * 5. getEvaCredentials propaga el error cuando no es un error de axios.
 * 6. saveEvaCredentials hace POST a /eva/credentials con el payload correcto.
 * 7. saveEvaCredentials retorna res.data.
 * 8. saveEvaCredentials propaga el error cuando axios.post rechaza.
 * 9. testEvaConnection hace POST a /eva/credentials/:companyId/connection-test con body vacío.
 * 10. testEvaConnection retorna res.data (la credencial actualizada).
 * 11. testEvaConnection propaga el error cuando axios.post rechaza (p.ej. 401 de Api-Key inválida).
 * 12. createEvaOrder hace POST a /eva/orders con el payload completo.
 * 13. createEvaOrder retorna res.data.
 * 14. createEvaOrder propaga el error cuando axios.post rechaza.
 * 15. getEvaDistricts hace GET a /eva/districts con Bearer y retorna el array
 *     `districts` de la respuesta (maestro de distritos EVA, hallazgo #14).
 * 16. getEvaDistricts cachea en memoria: dos llamadas seguidas exitosas solo
 *     disparan un único request HTTP real.
 * 17. getEvaDistricts NO cachea errores: si el primer intento falla, la
 *     próxima llamada reintenta el request (no queda "cacheado" un fallo).
 *
 * axios está completamente mockeado — sin llamadas reales a la red.
 * isAxiosError también está mockeado para controlar la rama 404 de getEvaCredentials.
 * Los tests de getEvaDistricts usan jest.isolateModules() + require() para
 * obtener una instancia fresca del módulo (y de axios) por test, dado que el
 * cache vive en una variable a nivel de módulo — mismo patrón que
 * clientsService.test.ts.
 */

jest.mock('axios', () => ({
  default: {
    get: jest.fn(),
    post: jest.fn(),
    defaults: { withCredentials: false },
    isAxiosError: jest.fn(),
  },
  get: jest.fn(),
  post: jest.fn(),
  defaults: { withCredentials: false },
  isAxiosError: jest.fn(),
}));

import axios from 'axios';
import {
  getEvaCredentials,
  saveEvaCredentials,
  testEvaConnection,
  createEvaOrder,
} from '@/services/evaService';
import type {
  EvaCredentialSafe,
  SaveEvaCredentialPayload,
  CreateEvaOrderPayload,
} from '@/services/evaService';

const mockAxiosGet = jest.mocked(axios.get);
const mockAxiosPost = jest.mocked(axios.post);
const mockIsAxiosError = jest.mocked(axios.isAxiosError);

const FAKE_TOKEN = 'test-token-xyz';
const COMPANY_ID = 'company-abc';
const ORDER_ID = 'order-123';
const BASE_URL = 'http://localhost:3004';

const MOCK_CREDENTIAL: EvaCredentialSafe = {
  id: 'cred-1',
  companyId: COMPANY_ID,
  baseUrl: null,
  clientType: 'RECOJO',
  maskedApiKey: '****abcd',
  hasWebhookSecret: true,
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const SAVE_PAYLOAD: SaveEvaCredentialPayload = {
  companyId: COMPANY_ID,
  apiKey: 'eva-api-key-123',
  baseUrl: 'https://api.evacourier.pe',
  clientType: 'RECOJO',
};

const MOCK_CREATE_RESULT = {
  trackingId: 'EVA-TRK-999',
  externalOrderId: 'EVA-EXT-999',
};

const MOCK_ORDER_PAYLOAD: CreateEvaOrderPayload = {
  companyId: COMPANY_ID,
  orderId: ORDER_ID,
  recipientName: 'Juan Pérez',
  recipientPhone: '+51987654321',
  district: 'Miraflores',
  address: 'Av. Test 123',
  amount: 50,
  paymentMethod: 'EFECTIVO',
  serviceType: 1,
  product: 'Caja mediana',
  packages: 1,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockIsAxiosError.mockReturnValue(false as unknown as never);
});

describe('evaService', () => {

  // ── getEvaCredentials ────────────────────────────────────────────────────

  describe('getEvaCredentials', () => {
    it('hace GET a la URL correcta con companyId y header Bearer', async () => {
      mockAxiosGet.mockResolvedValue({ data: MOCK_CREDENTIAL });
      await getEvaCredentials(FAKE_TOKEN, COMPANY_ID);
      expect(mockAxiosGet).toHaveBeenCalledWith(
        `${BASE_URL}/eva/credentials/${COMPANY_ID}`,
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: `Bearer ${FAKE_TOKEN}`,
          }),
        }),
      );
    });

    it('retorna res.data cuando la respuesta es exitosa', async () => {
      mockAxiosGet.mockResolvedValue({ data: MOCK_CREDENTIAL });
      const result = await getEvaCredentials(FAKE_TOKEN, COMPANY_ID);
      expect(result).toEqual(MOCK_CREDENTIAL);
    });

    it('retorna null cuando el servidor responde 404', async () => {
      const err404 = new Error('Not Found') as Error & { response: { status: number }; isAxiosError: boolean };
      err404.isAxiosError = true;
      err404.response = { status: 404 };
      mockAxiosGet.mockRejectedValue(err404);
      mockIsAxiosError.mockReturnValue(true as unknown as never);

      const result = await getEvaCredentials(FAKE_TOKEN, COMPANY_ID);
      expect(result).toBeNull();
    });

    it('propaga el error cuando el status NO es 404', async () => {
      const err500 = new Error('Internal Server Error') as Error & { response: { status: number }; isAxiosError: boolean };
      err500.isAxiosError = true;
      err500.response = { status: 500 };
      mockAxiosGet.mockRejectedValue(err500);
      mockIsAxiosError.mockReturnValue(true as unknown as never);

      await expect(getEvaCredentials(FAKE_TOKEN, COMPANY_ID)).rejects.toThrow(
        'Internal Server Error',
      );
    });

    it('propaga el error cuando no es un error de axios', async () => {
      const networkErr = new Error('Network Error');
      mockAxiosGet.mockRejectedValue(networkErr);
      mockIsAxiosError.mockReturnValue(false as unknown as never);

      await expect(getEvaCredentials(FAKE_TOKEN, COMPANY_ID)).rejects.toThrow('Network Error');
    });
  });

  // ── saveEvaCredentials ───────────────────────────────────────────────────

  describe('saveEvaCredentials', () => {
    it('hace POST a /eva/credentials con el payload correcto', async () => {
      mockAxiosPost.mockResolvedValue({ data: MOCK_CREDENTIAL });
      await saveEvaCredentials(FAKE_TOKEN, SAVE_PAYLOAD);
      expect(mockAxiosPost).toHaveBeenCalledWith(
        `${BASE_URL}/eva/credentials`,
        SAVE_PAYLOAD,
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: `Bearer ${FAKE_TOKEN}`,
          }),
        }),
      );
    });

    it('el body POST incluye companyId, apiKey y clientType', async () => {
      mockAxiosPost.mockResolvedValue({ data: MOCK_CREDENTIAL });
      await saveEvaCredentials(FAKE_TOKEN, SAVE_PAYLOAD);
      const [, body] = mockAxiosPost.mock.calls[0];
      expect(body).toMatchObject({
        companyId: COMPANY_ID,
        apiKey: 'eva-api-key-123',
        clientType: 'RECOJO',
      });
    });

    it('retorna res.data de la respuesta', async () => {
      mockAxiosPost.mockResolvedValue({ data: MOCK_CREDENTIAL });
      const result = await saveEvaCredentials(FAKE_TOKEN, SAVE_PAYLOAD);
      expect(result).toEqual(MOCK_CREDENTIAL);
    });

    it('propaga el error cuando axios.post rechaza', async () => {
      const err = { response: { data: { message: 'Api-Key inválida' } } };
      mockAxiosPost.mockRejectedValue(err);
      await expect(saveEvaCredentials(FAKE_TOKEN, SAVE_PAYLOAD)).rejects.toEqual(err);
    });
  });

  // ── testEvaConnection ────────────────────────────────────────────────────

  describe('testEvaConnection', () => {
    it('hace POST a /eva/credentials/:companyId/connection-test con body vacío y header Bearer', async () => {
      mockAxiosPost.mockResolvedValue({ data: MOCK_CREDENTIAL });
      await testEvaConnection(FAKE_TOKEN, COMPANY_ID);
      expect(mockAxiosPost).toHaveBeenCalledWith(
        `${BASE_URL}/eva/credentials/${COMPANY_ID}/connection-test`,
        {},
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: `Bearer ${FAKE_TOKEN}`,
          }),
        }),
      );
    });

    it('retorna la credencial actualizada (res.data)', async () => {
      const activated = { ...MOCK_CREDENTIAL, isActive: true };
      mockAxiosPost.mockResolvedValue({ data: activated });
      const result = await testEvaConnection(FAKE_TOKEN, COMPANY_ID);
      expect(result).toEqual(activated);
    });

    it('propaga el error cuando axios.post rechaza (p.ej. 401 de Api-Key inválida)', async () => {
      const err401 = { response: { status: 401, data: { message: 'Unauthorized' } } };
      mockAxiosPost.mockRejectedValue(err401);
      await expect(testEvaConnection(FAKE_TOKEN, COMPANY_ID)).rejects.toEqual(err401);
    });
  });

  // ── createEvaOrder ───────────────────────────────────────────────────────

  describe('createEvaOrder', () => {
    it('hace POST a /eva/orders con el payload completo', async () => {
      mockAxiosPost.mockResolvedValue({ data: MOCK_CREATE_RESULT });
      await createEvaOrder(FAKE_TOKEN, MOCK_ORDER_PAYLOAD);
      expect(mockAxiosPost).toHaveBeenCalledWith(
        `${BASE_URL}/eva/orders`,
        MOCK_ORDER_PAYLOAD,
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: `Bearer ${FAKE_TOKEN}`,
          }),
        }),
      );
    });

    it('retorna res.data con trackingId y externalOrderId', async () => {
      mockAxiosPost.mockResolvedValue({ data: MOCK_CREATE_RESULT });
      const result = await createEvaOrder(FAKE_TOKEN, MOCK_ORDER_PAYLOAD);
      expect(result).toEqual(MOCK_CREATE_RESULT);
    });

    it('propaga el error cuando axios.post rechaza', async () => {
      const err = { response: { data: { message: 'Distrito no habilitado por EVA' } } };
      mockAxiosPost.mockRejectedValue(err);
      await expect(createEvaOrder(FAKE_TOKEN, MOCK_ORDER_PAYLOAD)).rejects.toEqual(err);
    });

    it('el header Authorization incluye el token recibido', async () => {
      mockAxiosPost.mockResolvedValue({ data: MOCK_CREATE_RESULT });
      await createEvaOrder('mi-token-secreto', MOCK_ORDER_PAYLOAD);
      const [, , config] = mockAxiosPost.mock.calls[0] as [string, unknown, { headers: Record<string, string> }];
      expect(config.headers.Authorization).toBe('Bearer mi-token-secreto');
    });
  });

  // ── getEvaDistricts (maestro de distritos EVA — hallazgo #14) ─────────────

  describe('getEvaDistricts', () => {
    const DISTRICTS_URL = `${BASE_URL}/eva/districts`;

    /**
     * `cachedEvaDistricts` vive en una variable a nivel de módulo dentro de
     * evaService.ts. Para probar el cacheo (y el no-cacheo de errores) en
     * aislamiento por test, se carga una instancia fresca del módulo — y de
     * axios, para que ambos apunten al mismo mock — vía jest.isolateModules().
     */
    function loadFreshEvaDistricts(): {
      getEvaDistricts: typeof import('@/services/evaService').getEvaDistricts;
      axiosGetMock: jest.Mock;
    } {
      let freshGetEvaDistricts!: typeof import('@/services/evaService').getEvaDistricts;
      let freshAxiosGetMock!: jest.Mock;

      jest.isolateModules(() => {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const freshAxios = require('axios') as { get: jest.Mock };
        freshAxiosGetMock = freshAxios.get;
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const mod = require('@/services/evaService') as {
          getEvaDistricts: typeof import('@/services/evaService').getEvaDistricts;
        };
        freshGetEvaDistricts = mod.getEvaDistricts;
      });

      return { getEvaDistricts: freshGetEvaDistricts, axiosGetMock: freshAxiosGetMock };
    }

    it('devuelve el array de distritos de la respuesta', async () => {
      const { getEvaDistricts: freshGetEvaDistricts, axiosGetMock } = loadFreshEvaDistricts();
      axiosGetMock.mockResolvedValue({ data: { districts: ['MIRAFLORES', 'SURCO'] } });

      const result = await freshGetEvaDistricts(FAKE_TOKEN);

      expect(result).toEqual(['MIRAFLORES', 'SURCO']);
      expect(axiosGetMock).toHaveBeenCalledWith(
        DISTRICTS_URL,
        expect.objectContaining({
          headers: expect.objectContaining({ Authorization: `Bearer ${FAKE_TOKEN}` }),
        }),
      );
    });

    it('cachea en memoria: dos llamadas seguidas exitosas solo disparan UN request HTTP real', async () => {
      const { getEvaDistricts: freshGetEvaDistricts, axiosGetMock } = loadFreshEvaDistricts();
      axiosGetMock.mockResolvedValue({ data: { districts: ['MIRAFLORES', 'SURCO'] } });

      const first = await freshGetEvaDistricts(FAKE_TOKEN);
      const second = await freshGetEvaDistricts(FAKE_TOKEN);

      expect(first).toEqual(['MIRAFLORES', 'SURCO']);
      expect(second).toEqual(['MIRAFLORES', 'SURCO']);
      expect(axiosGetMock).toHaveBeenCalledTimes(1);
    });

    it('si el primer intento falla, NO cachea el error: la segunda llamada reintenta el request', async () => {
      const { getEvaDistricts: freshGetEvaDistricts, axiosGetMock } = loadFreshEvaDistricts();
      axiosGetMock
        .mockRejectedValueOnce(new Error('Network Error'))
        .mockResolvedValueOnce({ data: { districts: ['MIRAFLORES'] } });

      await expect(freshGetEvaDistricts(FAKE_TOKEN)).rejects.toThrow('Network Error');

      const result = await freshGetEvaDistricts(FAKE_TOKEN);

      expect(result).toEqual(['MIRAFLORES']);
      expect(axiosGetMock).toHaveBeenCalledTimes(2);
    });
  });
});
