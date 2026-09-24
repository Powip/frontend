/**
 * Tests: clients.service
 *
 * Comportamiento verificado:
 * 1. createClient hace POST a ${GATEWAY.ventas}/clients con el payload.
 * 2. createClient incluye latitude y longitude en el body cuando se pasan.
 * 3. createClient NO rompe (funciona correctamente) cuando no se pasan lat/lng.
 * 4. updateClient hace PATCH a ${GATEWAY.ventas}/clients/:id con el payload.
 * 5. updateClient incluye latitude y longitude en el body cuando se pasan.
 * 6. updateClient NO rompe cuando no se pasan lat/lng.
 * 7. updateClient propaga el error HTTP de axiosAuth.
 * 8. createClient propaga el error HTTP de axiosAuth.
 *
 * @/lib/axiosAuth está mockeado para evitar llamadas reales a la red.
 */

import axiosAuth from '@/lib/axiosAuth';
import { GATEWAY } from '@/lib/gateway';
import { createClient, updateClient } from '@/services/clients.service';

jest.mock('@/lib/axiosAuth', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
  },
}));

const mockPost = axiosAuth.post as jest.Mock;
const mockPatch = axiosAuth.patch as jest.Mock;

const API_VENTAS = GATEWAY.ventas;

// ── Fixtures ─────────────────────────────────────────────────────────────────

const MOCK_CLIENT = {
  id: 'client-1',
  companyId: 'company-1',
  fullName: 'Ana Torres',
  phoneNumber: '999888777',
  documentType: 'DNI',
  documentNumber: '12345678',
  clientType: 'TRADICIONAL' as const,
  province: 'Lima',
  city: 'Lima',
  district: 'Miraflores',
  address: 'Av. Larco 123',
  reference: 'Frente al parque',
  latitude: -12.046374,
  longitude: -77.042793,
  isActive: true,
};

const BASE_CREATE_PAYLOAD = {
  companyId: 'company-1',
  fullName: 'Ana Torres',
  phoneNumber: '999888777',
  clientType: 'TRADICIONAL' as const,
  province: 'Lima',
  city: 'Lima',
  district: 'Miraflores',
  address: 'Av. Larco 123',
};

function mockOkResponse(data: unknown) {
  return { status: 200, data };
}

function buildHttpError(status: number) {
  return Object.assign(new Error(`Request failed with status code ${status}`), {
    isAxiosError: true,
    response: { status, data: { message: 'Error' } },
  });
}

// ── Setup por test ────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('clients.service', () => {

  // ── createClient ─────────────────────────────────────────────────────────

  describe('createClient', () => {
    it('hace POST a /clients', async () => {
      mockPost.mockResolvedValue(mockOkResponse(MOCK_CLIENT));

      await createClient(BASE_CREATE_PAYLOAD);

      expect(mockPost).toHaveBeenCalledWith(`${API_VENTAS}/clients`, expect.any(Object));
    });

    it('envía el payload recibido como body', async () => {
      mockPost.mockResolvedValue(mockOkResponse(MOCK_CLIENT));

      await createClient(BASE_CREATE_PAYLOAD);

      const [, body] = mockPost.mock.calls[0];
      expect(body).toEqual(BASE_CREATE_PAYLOAD);
    });

    it('incluye latitude y longitude en el body cuando se pasan', async () => {
      mockPost.mockResolvedValue(mockOkResponse(MOCK_CLIENT));

      await createClient({
        ...BASE_CREATE_PAYLOAD,
        latitude: -12.046374,
        longitude: -77.042793,
      });

      const [, body] = mockPost.mock.calls[0];
      expect(body.latitude).toBe(-12.046374);
      expect(body.longitude).toBe(-77.042793);
    });

    it('NO incluye latitude/longitude en el body cuando no se pasan', async () => {
      mockPost.mockResolvedValue(mockOkResponse(MOCK_CLIENT));

      await createClient(BASE_CREATE_PAYLOAD);

      const [, body] = mockPost.mock.calls[0];
      expect(body).not.toHaveProperty('latitude');
      expect(body).not.toHaveProperty('longitude');
    });

    it('retorna el cliente creado en la respuesta', async () => {
      mockPost.mockResolvedValue(mockOkResponse(MOCK_CLIENT));

      const result = await createClient(BASE_CREATE_PAYLOAD);

      expect(result).toEqual(MOCK_CLIENT);
    });

    it('propaga el error cuando la respuesta no es ok', async () => {
      const error = buildHttpError(400);
      mockPost.mockRejectedValue(error);

      await expect(createClient(BASE_CREATE_PAYLOAD)).rejects.toBe(error);
    });
  });

  // ── updateClient ─────────────────────────────────────────────────────────

  describe('updateClient', () => {
    it('hace PATCH a /clients/:id con el id correcto', async () => {
      mockPatch.mockResolvedValue(mockOkResponse(MOCK_CLIENT));

      await updateClient('client-42', { companyId: 'company-1' });

      expect(mockPatch).toHaveBeenCalledWith(
        `${API_VENTAS}/clients/client-42`,
        expect.any(Object),
      );
    });

    it('envía el payload recibido como body', async () => {
      mockPatch.mockResolvedValue(mockOkResponse(MOCK_CLIENT));

      await updateClient('client-1', { companyId: 'company-1' });

      const [, body] = mockPatch.mock.calls[0];
      expect(body).toEqual({ companyId: 'company-1' });
    });

    it('incluye latitude y longitude en el body cuando se pasan', async () => {
      mockPatch.mockResolvedValue(mockOkResponse(MOCK_CLIENT));

      await updateClient('client-1', {
        companyId: 'company-1',
        latitude: -12.046374,
        longitude: -77.042793,
      });

      const [, body] = mockPatch.mock.calls[0];
      expect(body.latitude).toBe(-12.046374);
      expect(body.longitude).toBe(-77.042793);
    });

    it('incluye companyId en el body del payload', async () => {
      mockPatch.mockResolvedValue(mockOkResponse(MOCK_CLIENT));

      await updateClient('client-1', {
        companyId: 'company-99',
        latitude: -11.0,
        longitude: -76.0,
      });

      const [, body] = mockPatch.mock.calls[0];
      expect(body.companyId).toBe('company-99');
    });

    it('NO rompe cuando no se pasan lat/lng (payload parcial)', async () => {
      mockPatch.mockResolvedValue(mockOkResponse(MOCK_CLIENT));

      const result = await updateClient('client-1', {
        fullName: 'Nuevo Nombre',
      });

      expect(result).toEqual(MOCK_CLIENT);
      const [, body] = mockPatch.mock.calls[0];
      expect(body.fullName).toBe('Nuevo Nombre');
    });

    it('retorna el cliente actualizado en la respuesta', async () => {
      mockPatch.mockResolvedValue(mockOkResponse(MOCK_CLIENT));

      const result = await updateClient('client-1', { companyId: 'company-1' });

      expect(result).toEqual(MOCK_CLIENT);
    });

    it('propaga el error cuando la respuesta no es ok', async () => {
      const error = buildHttpError(404);
      mockPatch.mockRejectedValue(error);

      await expect(
        updateClient('client-not-found', { companyId: 'company-1' }),
      ).rejects.toBe(error);
    });

    it('construye correctamente la URL con distintos ids', async () => {
      mockPatch.mockResolvedValue(mockOkResponse(MOCK_CLIENT));

      await updateClient('abc-123-xyz', { latitude: -5.0, longitude: -80.0 });

      expect(mockPatch).toHaveBeenCalledWith(
        `${API_VENTAS}/clients/abc-123-xyz`,
        expect.anything(),
      );
    });
  });
});
