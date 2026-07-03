/**
 * Tests: clients.service
 *
 * Comportamiento verificado:
 * 1. createClient hace POST a /clients con body JSON que incluye los campos del payload.
 * 2. createClient incluye latitude y longitude en el body cuando se pasan.
 * 3. createClient NO rompe (funciona correctamente) cuando no se pasan lat/lng.
 * 4. updateClient hace PATCH a /clients/:id con el body JSON del payload.
 * 5. updateClient incluye latitude y longitude en el body cuando se pasan.
 * 6. updateClient NO rompe cuando no se pasan lat/lng.
 * 7. updateClient lanza error cuando la respuesta no es ok.
 * 8. createClient lanza error cuando la respuesta no es ok.
 *
 * fetch global está mockeado para evitar llamadas reales a la red.
 * NEXT_PUBLIC_API_VENTAS se fija antes de importar el módulo vía jest.isolateModules.
 */

// ── Configuración de entorno — DEBE ir antes del import del módulo ────────────
const FAKE_API_VENTAS = 'http://localhost:3002';

// ── Mock de fetch global ──────────────────────────────────────────────────────
const mockFetch = jest.fn();

// ── Tipos de las funciones bajo prueba (sin importar el módulo todavía) ───────
type CreateClientFn = typeof import('@/services/clients.service').createClient;
type UpdateClientFn = typeof import('@/services/clients.service').updateClient;

// Variables que se asignarán dentro de isolateModules
let createClient: CreateClientFn;
let updateClient: UpdateClientFn;

// ── Setup: cargar el módulo con la env var correcta ───────────────────────────

beforeAll(() => {
  process.env.NEXT_PUBLIC_API_VENTAS = FAKE_API_VENTAS;
  global.fetch = mockFetch;

  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('@/services/clients.service') as {
      createClient: CreateClientFn;
      updateClient: UpdateClientFn;
    };
    createClient = mod.createClient;
    updateClient = mod.updateClient;
  });
});

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

// Helper para crear una respuesta fetch simulada
function mockOkResponse(data: unknown) {
  return {
    ok: true,
    status: 200,
    json: jest.fn().mockResolvedValue(data),
  };
}

function mockErrorResponse(status = 500) {
  return {
    ok: false,
    status,
    json: jest.fn().mockResolvedValue({ message: 'Error' }),
  };
}

// ── Setup por test ────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('clients.service', () => {

  // ── createClient ─────────────────────────────────────────────────────────

  describe('createClient', () => {
    it('hace POST a /clients con el método correcto', async () => {
      mockFetch.mockResolvedValue(mockOkResponse(MOCK_CLIENT));

      await createClient(BASE_CREATE_PAYLOAD);

      expect(mockFetch).toHaveBeenCalledWith(
        `${FAKE_API_VENTAS}/clients`,
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('incluye Content-Type application/json en los headers', async () => {
      mockFetch.mockResolvedValue(mockOkResponse(MOCK_CLIENT));

      await createClient(BASE_CREATE_PAYLOAD);

      const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect((options.headers as Record<string, string>)['Content-Type']).toBe('application/json');
    });

    it('incluye latitude y longitude en el body cuando se pasan', async () => {
      mockFetch.mockResolvedValue(mockOkResponse(MOCK_CLIENT));

      await createClient({
        ...BASE_CREATE_PAYLOAD,
        latitude: -12.046374,
        longitude: -77.042793,
      });

      const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(options.body as string);
      expect(body.latitude).toBe(-12.046374);
      expect(body.longitude).toBe(-77.042793);
    });

    it('NO incluye latitude/longitude en el body cuando no se pasan', async () => {
      mockFetch.mockResolvedValue(mockOkResponse(MOCK_CLIENT));

      await createClient(BASE_CREATE_PAYLOAD);

      const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(options.body as string);
      // latitude/longitude deben ser undefined (no presentes en el JSON serializado)
      expect(body).not.toHaveProperty('latitude');
      expect(body).not.toHaveProperty('longitude');
    });

    it('retorna el cliente creado en la respuesta', async () => {
      mockFetch.mockResolvedValue(mockOkResponse(MOCK_CLIENT));

      const result = await createClient(BASE_CREATE_PAYLOAD);

      expect(result).toEqual(MOCK_CLIENT);
    });

    it('lanza un error cuando la respuesta no es ok', async () => {
      mockFetch.mockResolvedValue(mockErrorResponse(400));

      await expect(createClient(BASE_CREATE_PAYLOAD)).rejects.toThrow('Error creating client');
    });
  });

  // ── updateClient ─────────────────────────────────────────────────────────

  describe('updateClient', () => {
    it('hace PATCH a /clients/:id con el id correcto', async () => {
      mockFetch.mockResolvedValue(mockOkResponse(MOCK_CLIENT));

      await updateClient('client-42', { companyId: 'company-1' });

      expect(mockFetch).toHaveBeenCalledWith(
        `${FAKE_API_VENTAS}/clients/client-42`,
        expect.objectContaining({ method: 'PATCH' }),
      );
    });

    it('incluye Content-Type application/json en los headers', async () => {
      mockFetch.mockResolvedValue(mockOkResponse(MOCK_CLIENT));

      await updateClient('client-1', { companyId: 'company-1' });

      const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect((options.headers as Record<string, string>)['Content-Type']).toBe('application/json');
    });

    it('incluye latitude y longitude en el body cuando se pasan', async () => {
      mockFetch.mockResolvedValue(mockOkResponse(MOCK_CLIENT));

      await updateClient('client-1', {
        companyId: 'company-1',
        latitude: -12.046374,
        longitude: -77.042793,
      });

      const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(options.body as string);
      expect(body.latitude).toBe(-12.046374);
      expect(body.longitude).toBe(-77.042793);
    });

    it('incluye companyId en el body del payload', async () => {
      mockFetch.mockResolvedValue(mockOkResponse(MOCK_CLIENT));

      await updateClient('client-1', {
        companyId: 'company-99',
        latitude: -11.0,
        longitude: -76.0,
      });

      const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(options.body as string);
      expect(body.companyId).toBe('company-99');
    });

    it('NO rompe cuando no se pasan lat/lng (payload parcial)', async () => {
      mockFetch.mockResolvedValue(mockOkResponse(MOCK_CLIENT));

      const result = await updateClient('client-1', {
        fullName: 'Nuevo Nombre',
      });

      expect(result).toEqual(MOCK_CLIENT);
      const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(options.body as string);
      expect(body.fullName).toBe('Nuevo Nombre');
    });

    it('retorna el cliente actualizado en la respuesta', async () => {
      mockFetch.mockResolvedValue(mockOkResponse(MOCK_CLIENT));

      const result = await updateClient('client-1', { companyId: 'company-1' });

      expect(result).toEqual(MOCK_CLIENT);
    });

    it('lanza un error cuando la respuesta no es ok', async () => {
      mockFetch.mockResolvedValue(mockErrorResponse(404));

      await expect(
        updateClient('client-not-found', { companyId: 'company-1' }),
      ).rejects.toThrow('Error updating client');
    });

    it('construye correctamente la URL con distintos ids', async () => {
      mockFetch.mockResolvedValue(mockOkResponse(MOCK_CLIENT));

      await updateClient('abc-123-xyz', { latitude: -5.0, longitude: -80.0 });

      expect(mockFetch).toHaveBeenCalledWith(
        `${FAKE_API_VENTAS}/clients/abc-123-xyz`,
        expect.anything(),
      );
    });
  });
});
