/**
 * Tests: aliclikService — funciones de credenciales
 *
 * Comportamiento verificado:
 * 1. getAliclikCredentials hace GET a /aliclik/credentials/:companyId con Bearer.
 * 2. getAliclikCredentials retorna res.data cuando la respuesta es OK.
 * 3. getAliclikCredentials retorna null cuando el servidor responde 404.
 * 4. getAliclikCredentials propaga el error cuando no es 404.
 * 5. saveAliclikCredentials hace POST a /aliclik/credentials con el body correcto.
 * 6. saveAliclikCredentials retorna res.data.
 * 7. saveAliclikCredentials propaga el error cuando axios.post rechaza.
 * 8. testAliclikConnection hace GET a /aliclik/connection-test/:companyId con Bearer.
 * 9. testAliclikConnection retorna res.data.
 * 10. testAliclikConnection propaga el error cuando axios.get rechaza.
 * 11. updateAliclikStore hace PATCH a /aliclik/credentials/:companyId/store con body { storeId }.
 * 12. updateAliclikStore retorna res.data.
 * 13. updateAliclikStore acepta storeId null (limpiar store destino).
 * 14. updateAliclikStore incluye header Authorization con Bearer token.
 *
 * axios está completamente mockeado — sin llamadas reales a la red.
 * isAxiosError también está mockeado para controlar la rama 404.
 */

jest.mock('axios', () => ({
  default: {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
    defaults: { withCredentials: false },
    isAxiosError: jest.fn(),
  },
  get: jest.fn(),
  post: jest.fn(),
  patch: jest.fn(),
  defaults: { withCredentials: false },
  isAxiosError: jest.fn(),
}));

import axios from 'axios';
import {
  getAliclikCredentials,
  saveAliclikCredentials,
  testAliclikConnection,
  updateAliclikStore,
} from '@/services/aliclikService';
import type {
  AliclikCredentialSafe,
  SaveAliclikCredentialPayload,
} from '@/services/aliclikService';

const mockAxiosGet = jest.mocked(axios.get);
const mockAxiosPost = jest.mocked(axios.post);
const mockAxiosPatch = jest.mocked(axios.patch);
const mockIsAxiosError = jest.mocked(axios.isAxiosError);

const FAKE_TOKEN = 'test-token-xyz';
const COMPANY_ID = 'company-abc';
const BASE_URL = 'http://localhost:3004';

const MOCK_CREDENTIAL: AliclikCredentialSafe = {
  id: 'cred-1',
  companyId: COMPANY_ID,
  baseUrl: 'https://api.aliclik.app',
  isActive: true,
  webhookSecret: 'secret-abc123',
  importStoreId: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const SAVE_PAYLOAD: SaveAliclikCredentialPayload = {
  companyId: COMPANY_ID,
  token: 'aliclik-bearer-token',
  baseUrl: 'https://api.aliclik.app',
};

beforeEach(() => {
  jest.clearAllMocks();
  // Por defecto isAxiosError retorna false — cada test que lo necesite lo sobreescribe
  mockIsAxiosError.mockReturnValue(false as unknown as never);
});

describe('aliclikService — credenciales', () => {

  // ── getAliclikCredentials ────────────────────────────────────────────────────

  describe('getAliclikCredentials', () => {
    it('hace GET a la URL correcta con companyId y header Bearer', async () => {
      mockAxiosGet.mockResolvedValue({ data: MOCK_CREDENTIAL });
      await getAliclikCredentials(FAKE_TOKEN, COMPANY_ID);
      expect(mockAxiosGet).toHaveBeenCalledWith(
        `${BASE_URL}/aliclik/credentials/${COMPANY_ID}`,
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: `Bearer ${FAKE_TOKEN}`,
          }),
        }),
      );
    });

    it('retorna res.data cuando la respuesta es exitosa', async () => {
      mockAxiosGet.mockResolvedValue({ data: MOCK_CREDENTIAL });
      const result = await getAliclikCredentials(FAKE_TOKEN, COMPANY_ID);
      expect(result).toEqual(MOCK_CREDENTIAL);
    });

    it('retorna null cuando el servidor responde 404', async () => {
      const err404 = new Error('Not Found') as Error & { response: { status: number }; isAxiosError: boolean };
      err404.isAxiosError = true;
      err404.response = { status: 404 };
      mockAxiosGet.mockRejectedValue(err404);
      mockIsAxiosError.mockReturnValue(true as unknown as never);

      const result = await getAliclikCredentials(FAKE_TOKEN, COMPANY_ID);
      expect(result).toBeNull();
    });

    it('propaga el error cuando el status NO es 404', async () => {
      const err500 = new Error('Internal Server Error') as Error & { response: { status: number }; isAxiosError: boolean };
      err500.isAxiosError = true;
      err500.response = { status: 500 };
      mockAxiosGet.mockRejectedValue(err500);
      // isAxiosError devuelve true, pero status=500 → no es 404 → re-throw
      mockIsAxiosError.mockReturnValue(true as unknown as never);

      await expect(getAliclikCredentials(FAKE_TOKEN, COMPANY_ID)).rejects.toThrow(
        'Internal Server Error',
      );
    });

    it('propaga el error cuando no es un error de axios', async () => {
      const networkErr = new Error('Network Error');
      mockAxiosGet.mockRejectedValue(networkErr);
      mockIsAxiosError.mockReturnValue(false as unknown as never);

      await expect(getAliclikCredentials(FAKE_TOKEN, COMPANY_ID)).rejects.toThrow('Network Error');
    });
  });

  // ── saveAliclikCredentials ───────────────────────────────────────────────────

  describe('saveAliclikCredentials', () => {
    it('hace POST a /aliclik/credentials con el payload correcto', async () => {
      mockAxiosPost.mockResolvedValue({ data: MOCK_CREDENTIAL });
      await saveAliclikCredentials(FAKE_TOKEN, SAVE_PAYLOAD);
      expect(mockAxiosPost).toHaveBeenCalledWith(
        `${BASE_URL}/aliclik/credentials`,
        SAVE_PAYLOAD,
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: `Bearer ${FAKE_TOKEN}`,
          }),
        }),
      );
    });

    it('el body POST incluye companyId, token y baseUrl', async () => {
      mockAxiosPost.mockResolvedValue({ data: MOCK_CREDENTIAL });
      await saveAliclikCredentials(FAKE_TOKEN, SAVE_PAYLOAD);
      const [, body] = mockAxiosPost.mock.calls[0];
      expect(body).toMatchObject({
        companyId: COMPANY_ID,
        token: 'aliclik-bearer-token',
        baseUrl: 'https://api.aliclik.app',
      });
    });

    it('retorna res.data de la respuesta', async () => {
      mockAxiosPost.mockResolvedValue({ data: MOCK_CREDENTIAL });
      const result = await saveAliclikCredentials(FAKE_TOKEN, SAVE_PAYLOAD);
      expect(result).toEqual(MOCK_CREDENTIAL);
    });

    it('el payload puede omitir baseUrl (campo opcional)', async () => {
      const payloadSinUrl: SaveAliclikCredentialPayload = {
        companyId: COMPANY_ID,
        token: 'aliclik-bearer-token',
      };
      mockAxiosPost.mockResolvedValue({ data: { ...MOCK_CREDENTIAL, baseUrl: null } });
      await saveAliclikCredentials(FAKE_TOKEN, payloadSinUrl);
      const [, body] = mockAxiosPost.mock.calls[0];
      expect(body).not.toHaveProperty('baseUrl');
    });

    it('propaga el error cuando axios.post rechaza', async () => {
      const err = { response: { data: { message: 'Token inválido' } } };
      mockAxiosPost.mockRejectedValue(err);
      await expect(saveAliclikCredentials(FAKE_TOKEN, SAVE_PAYLOAD)).rejects.toEqual(err);
    });
  });

  // ── testAliclikConnection ────────────────────────────────────────────────────

  describe('testAliclikConnection', () => {
    it('hace GET a /aliclik/connection-test/:companyId con header Bearer', async () => {
      mockAxiosGet.mockResolvedValue({ data: { ok: true } });
      await testAliclikConnection(FAKE_TOKEN, COMPANY_ID);
      expect(mockAxiosGet).toHaveBeenCalledWith(
        `${BASE_URL}/aliclik/connection-test/${COMPANY_ID}`,
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: `Bearer ${FAKE_TOKEN}`,
          }),
        }),
      );
    });

    it('retorna res.data con ok=true cuando la conexión es exitosa', async () => {
      mockAxiosGet.mockResolvedValue({ data: { ok: true, message: 'Conexión OK' } });
      const result = await testAliclikConnection(FAKE_TOKEN, COMPANY_ID);
      expect(result).toEqual({ ok: true, message: 'Conexión OK' });
    });

    it('retorna res.data con ok=false cuando la conexión falla', async () => {
      mockAxiosGet.mockResolvedValue({ data: { ok: false, message: 'Token inválido' } });
      const result = await testAliclikConnection(FAKE_TOKEN, COMPANY_ID);
      expect(result.ok).toBe(false);
    });

    it('propaga el error cuando axios.get rechaza', async () => {
      const err = new Error('Timeout');
      mockAxiosGet.mockRejectedValue(err);
      await expect(testAliclikConnection(FAKE_TOKEN, COMPANY_ID)).rejects.toThrow('Timeout');
    });
  });

  // ── updateAliclikStore ───────────────────────────────────────────────────────

  describe('updateAliclikStore', () => {
    const STORE_ID = 'store-abc';
    const CREDENTIAL_WITH_STORE: AliclikCredentialSafe = {
      ...MOCK_CREDENTIAL,
      importStoreId: STORE_ID,
    };

    it('hace PATCH a la URL correcta con companyId', async () => {
      mockAxiosPatch.mockResolvedValue({ data: CREDENTIAL_WITH_STORE });
      await updateAliclikStore(FAKE_TOKEN, COMPANY_ID, STORE_ID);
      expect(mockAxiosPatch).toHaveBeenCalledWith(
        `${BASE_URL}/aliclik/credentials/${COMPANY_ID}/store`,
        expect.anything(),
        expect.anything(),
      );
    });

    it('envía body { storeId } con el valor recibido', async () => {
      mockAxiosPatch.mockResolvedValue({ data: CREDENTIAL_WITH_STORE });
      await updateAliclikStore(FAKE_TOKEN, COMPANY_ID, STORE_ID);
      const [, body] = mockAxiosPatch.mock.calls[0];
      expect(body).toEqual({ storeId: STORE_ID });
    });

    it('envía body { storeId: null } cuando storeId es null', async () => {
      const credentialNoStore: AliclikCredentialSafe = { ...MOCK_CREDENTIAL, importStoreId: null };
      mockAxiosPatch.mockResolvedValue({ data: credentialNoStore });
      await updateAliclikStore(FAKE_TOKEN, COMPANY_ID, null);
      const [, body] = mockAxiosPatch.mock.calls[0];
      expect(body).toEqual({ storeId: null });
    });

    it('incluye header Authorization con Bearer token', async () => {
      mockAxiosPatch.mockResolvedValue({ data: CREDENTIAL_WITH_STORE });
      await updateAliclikStore(FAKE_TOKEN, COMPANY_ID, STORE_ID);
      const [, , config] = mockAxiosPatch.mock.calls[0] as [string, unknown, { headers: Record<string, string> }];
      expect(config.headers.Authorization).toBe(`Bearer ${FAKE_TOKEN}`);
    });

    it('retorna res.data de la respuesta', async () => {
      mockAxiosPatch.mockResolvedValue({ data: CREDENTIAL_WITH_STORE });
      const result = await updateAliclikStore(FAKE_TOKEN, COMPANY_ID, STORE_ID);
      expect(result).toEqual(CREDENTIAL_WITH_STORE);
    });

    it('propaga el error cuando axios.patch rechaza', async () => {
      const err = new Error('Server error');
      mockAxiosPatch.mockRejectedValue(err);
      await expect(updateAliclikStore(FAKE_TOKEN, COMPANY_ID, STORE_ID)).rejects.toThrow('Server error');
    });
  });
});
