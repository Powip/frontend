/**
 * Tests de axiosAuth — interceptors de request y response.
 *
 * Estrategia de mock:
 * - `axios` se mockea completo. `axios.create()` retorna una instancia falsa
 *   cuyo `interceptors` captura los handlers registrados por el módulo.
 * - `axios.post` se mockea para controlar la llamada de refresh en `doRefresh()`.
 * - `tokenStore` se mockea para aislar el store real.
 * - `GATEWAY` se mockea con una URL fija de test.
 *
 * Los interceptors se invocan directamente accediendo a los handlers
 * capturados durante la carga del módulo.
 */

import type { InternalAxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';

// ── Mocks de dependencias — deben ir antes del import de axiosAuth ────────────

jest.mock('@/lib/tokenStore', () => ({
  tokenStore: {
    get: jest.fn(),
    set: jest.fn(),
  },
}));

jest.mock('@/lib/gateway', () => ({
  GATEWAY: { auth: 'http://test-gateway' },
}));

// Captura los handlers de interceptors registrados por el módulo
type RequestFulfilled = (config: InternalAxiosRequestConfig) => InternalAxiosRequestConfig;
type ResponseFulfilled = (res: AxiosResponse) => AxiosResponse;
type ResponseRejected = (error: unknown) => Promise<unknown>;

let capturedRequestFulfilled: RequestFulfilled;
let capturedResponseFulfilled: ResponseFulfilled;
let capturedResponseRejected: ResponseRejected;

const mockRetryCall = jest.fn();

function buildMockInstance() {
  const instance = function (config: unknown) {
    return mockRetryCall(config);
  } as unknown as {
    interceptors: {
      request: { use: jest.Mock };
      response: { use: jest.Mock };
    };
  };

  (instance as unknown as { interceptors: unknown }).interceptors = {
    request: {
      use: jest.fn((fulfilled: RequestFulfilled) => {
        capturedRequestFulfilled = fulfilled;
      }),
    },
    response: {
      use: jest.fn((fulfilled: ResponseFulfilled, rejected: ResponseRejected) => {
        capturedResponseFulfilled = fulfilled;
        capturedResponseRejected = rejected;
      }),
    },
  };

  return instance;
}

const mockAxiosInstance = buildMockInstance();

jest.mock('axios', () => {
  const mockPost = jest.fn();
  const create = jest.fn(() => mockAxiosInstance);
  const isAxiosError = jest.fn(
    (error: unknown) =>
      !!(
        error &&
        typeof error === 'object' &&
        'isAxiosError' in error &&
        (error as { isAxiosError?: boolean }).isAxiosError === true
      ),
  );

  const axiosMock = Object.assign(jest.fn(), { create, post: mockPost, isAxiosError });
  return { __esModule: true, default: axiosMock, ...axiosMock };
});

// ── Imports después de los mocks ──────────────────────────────────────────────

import axios from 'axios';
import { tokenStore } from '@/lib/tokenStore';

// eslint-disable-next-line @typescript-eslint/no-require-imports
require('@/lib/axiosAuth');

const mockTokenStore = tokenStore as jest.Mocked<typeof tokenStore>;
const mockAxiosPost = axios.post as jest.Mock;

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeConfig(
  overrides: Partial<InternalAxiosRequestConfig & { _retry?: boolean }> = {},
): InternalAxiosRequestConfig & { _retry?: boolean } {
  return {
    headers: {} as InternalAxiosRequestConfig['headers'],
    ...overrides,
  } as InternalAxiosRequestConfig & { _retry?: boolean };
}

function makeAxiosError(status: number, config: InternalAxiosRequestConfig): AxiosError {
  const err = new Error('Request failed') as AxiosError;
  err.isAxiosError = true;
  err.response = { status, data: null, headers: {}, config, statusText: '' } as AxiosResponse;
  err.config = config;
  return err;
}

function makeNetworkError(): AxiosError {
  const err = new Error('Network Error') as AxiosError;
  err.isAxiosError = true;
  // sin .response — simula corte de red o timeout
  return err;
}

// ── Setup / teardown ──────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('axiosAuth — request interceptor', () => {
  it('agrega Authorization header cuando hay token en tokenStore', () => {
    mockTokenStore.get.mockReturnValue('test-token');

    const config = makeConfig();
    const result = capturedRequestFulfilled(config);

    expect(result.headers.Authorization).toBe('Bearer test-token');
  });

  it('NO agrega Authorization header cuando tokenStore.get() retorna null', () => {
    mockTokenStore.get.mockReturnValue(null);

    const config = makeConfig();
    const result = capturedRequestFulfilled(config);

    expect(result.headers.Authorization).toBeUndefined();
  });
});

describe('axiosAuth — response interceptor (fulfilled)', () => {
  it('devuelve la response sin modificarla en el caso exitoso', () => {
    const mockResponse = { status: 200, data: { ok: true } } as AxiosResponse;
    const result = capturedResponseFulfilled(mockResponse);
    expect(result).toBe(mockResponse);
  });
});

describe('axiosAuth — response interceptor (rejected)', () => {
  it('llama a POST /refresh sin body y actualiza tokenStore al recibir 401', async () => {
    mockAxiosPost.mockResolvedValue({
      data: { accessToken: 'new-token' },
    });
    mockRetryCall.mockResolvedValue({ status: 200, data: {} });

    const config = makeConfig();
    const error = makeAxiosError(401, config);

    await capturedResponseRejected(error);

    expect(mockAxiosPost).toHaveBeenCalledWith(
      'http://test-gateway/api/v1/auth/refresh',
      {},
      { withCredentials: true },
    );
    expect(mockTokenStore.set).toHaveBeenCalledWith('new-token');
  });

  it('despacha auth:refreshed con el nuevo token tras un refresh exitoso', async () => {
    mockAxiosPost.mockResolvedValue({
      data: { accessToken: 'new-token' },
    });
    mockRetryCall.mockResolvedValue({ status: 200, data: {} });

    const listener = jest.fn();
    window.addEventListener('auth:refreshed', listener);

    const config = makeConfig();
    const error = makeAxiosError(401, config);

    await capturedResponseRejected(error);

    expect(listener).toHaveBeenCalledTimes(1);
    const event = listener.mock.calls[0][0] as CustomEvent;
    expect(event.detail).toBe('new-token');

    window.removeEventListener('auth:refreshed', listener);
  });

  it('limpia tokenStore y despacha auth:logout cuando el refresh falla con error de autenticación', async () => {
    mockAxiosPost.mockRejectedValue(makeAxiosError(401, makeConfig()));

    const listener = jest.fn();
    window.addEventListener('auth:logout', listener);

    const config = makeConfig();
    const error = makeAxiosError(401, config);

    await expect(capturedResponseRejected(error)).rejects.toThrow();

    expect(mockTokenStore.set).toHaveBeenCalledWith(null);
    expect(listener).toHaveBeenCalledTimes(1);

    window.removeEventListener('auth:logout', listener);
  });

  it('NO despacha auth:logout cuando el refresh falla por error de red (sin response)', async () => {
    mockAxiosPost.mockRejectedValue(makeNetworkError());

    const listener = jest.fn();
    window.addEventListener('auth:logout', listener);

    const config = makeConfig();
    const error = makeAxiosError(401, config);

    await expect(capturedResponseRejected(error)).rejects.toThrow();

    expect(mockTokenStore.set).not.toHaveBeenCalledWith(null);
    expect(listener).not.toHaveBeenCalled();

    window.removeEventListener('auth:logout', listener);
  });

  it('NO llama a axios.post cuando el error no es 401', async () => {
    const config = makeConfig();
    const error = makeAxiosError(403, config);

    await expect(capturedResponseRejected(error)).rejects.toThrow();

    expect(mockAxiosPost).not.toHaveBeenCalled();
  });

  it('NO reintenta la request cuando _retry ya es true (evita bucle infinito)', async () => {
    const config = makeConfig({ _retry: true });
    const error = makeAxiosError(401, config);

    await expect(capturedResponseRejected(error)).rejects.toThrow();

    expect(mockAxiosPost).not.toHaveBeenCalled();
  });
});
