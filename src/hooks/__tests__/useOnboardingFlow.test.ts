import { renderHook, act } from '@testing-library/react';
import axios from 'axios';
import axiosAuth from '@/lib/axiosAuth';
import { useOnboardingFlow, APP_METADATA_PROPAGATION_DELAY_MS } from '../useOnboardingFlow';

// ── Mocks de dependencias externas — nunca llamadas reales ────────────────────

jest.mock('axios', () => ({
  __esModule: true,
  default: {
    post: jest.fn(),
    isAxiosError: jest.fn(() => false),
  },
}));

jest.mock('@/lib/axiosAuth', () => ({
  __esModule: true,
  default: {
    post: jest.fn().mockResolvedValue({ data: {} }),
    get: jest.fn().mockResolvedValue({ data: {} }),
  },
}));

jest.mock('sonner', () => ({
  toast: {
    error: jest.fn(),
    success: jest.fn(),
  },
}));

jest.mock('@/lib/onboardingStorage', () => ({
  saveOnboardingState: jest.fn(),
  clearOnboardingState: jest.fn(),
  getStoredOnboardingState: jest.fn(),
}));

const mockedAxios = jest.mocked(axios);
const mockedAxiosAuth = jest.mocked(axiosAuth);

// ── Fixtures ──────────────────────────────────────────────────────────────────

const INITIAL_PARAMS = {
  planId: 'plan-1',
  planName: 'Plan Pro',
  price: 100,
  isAnnual: false,
};

const REGISTER_DATA = {
  name: 'Juan',
  surname: 'Perez',
  email: 'juan.perez@test.com',
  password: 'SecretPass123',
  phone: '999999999',
};

const ACCESS_TOKEN = 'access-token-abc';

/**
 * Deja avanzar la cola de microtasks real (promesas nativas de axios.post)
 * sin tocar los timers falsos — necesario porque jest.useFakeTimers() solo
 * intercepta setTimeout/setInterval, no la resolución de Promises.
 */
async function flushMicrotasks(times = 5): Promise<void> {
  for (let i = 0; i < times; i++) {
    await Promise.resolve();
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useOnboardingFlow — delay de propagación de app_metadata en register', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();

    mockedAxios.post.mockImplementation((url: string) => {
      if (url.includes('/auth/register')) {
        return Promise.resolve({ data: { userId: 'user-123' } });
      }
      if (url.includes('/auth/login')) {
        return Promise.resolve({
          data: { accessToken: ACCESS_TOKEN, expiresIn: 3600 },
        });
      }
      return Promise.reject(new Error(`URL inesperada en el mock: ${url}`));
    });

    mockedAxiosAuth.post.mockResolvedValue({ data: {} });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('NO llama a loginFn inmediatamente después de obtener el accessToken', async () => {
    const loginFn = jest.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useOnboardingFlow(INITIAL_PARAMS, loginFn));

    act(() => {
      result.current.register(REGISTER_DATA);
    });

    // Deja que se resuelvan las promesas nativas de axios.post (register + login)
    // sin avanzar los timers falsos — el sleep(5500ms) recién se agenda después.
    await act(async () => {
      await flushMicrotasks();
    });

    expect(loginFn).not.toHaveBeenCalled();
  });

  it('sigue sin llamar a loginFn justo antes de completarse el delay (5499ms)', async () => {
    const loginFn = jest.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useOnboardingFlow(INITIAL_PARAMS, loginFn));

    act(() => {
      result.current.register(REGISTER_DATA);
    });

    await act(async () => {
      await flushMicrotasks();
    });

    await act(async () => {
      await jest.advanceTimersByTimeAsync(APP_METADATA_PROPAGATION_DELAY_MS - 1);
    });

    expect(loginFn).not.toHaveBeenCalled();
  });

  it('llama a loginFn con el accessToken correcto luego de transcurridos >= 5500ms', async () => {
    const loginFn = jest.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useOnboardingFlow(INITIAL_PARAMS, loginFn));

    let registerPromise!: Promise<void>;
    act(() => {
      registerPromise = result.current.register(REGISTER_DATA);
    });

    await act(async () => {
      await flushMicrotasks();
    });

    expect(loginFn).not.toHaveBeenCalled();

    await act(async () => {
      await jest.advanceTimersByTimeAsync(APP_METADATA_PROPAGATION_DELAY_MS);
    });

    expect(loginFn).toHaveBeenCalledTimes(1);
    expect(loginFn).toHaveBeenCalledWith({ accessToken: ACCESS_TOKEN });

    await act(async () => {
      await registerPromise;
    });
  });

  it('NO llama a loginFn si el componente se desmontó antes de que se cumpla el delay', async () => {
    const loginFn = jest.fn().mockResolvedValue(undefined);
    const { result, unmount } = renderHook(() =>
      useOnboardingFlow(INITIAL_PARAMS, loginFn),
    );

    act(() => {
      result.current.register(REGISTER_DATA);
    });

    // Deja que se resuelvan register + login (promesas nativas) antes de
    // desmontar — el sleep(5500ms) ya quedó agendado en ese punto.
    await act(async () => {
      await flushMicrotasks();
    });

    unmount();

    await act(async () => {
      await jest.advanceTimersByTimeAsync(APP_METADATA_PROPAGATION_DELAY_MS);
    });

    expect(loginFn).not.toHaveBeenCalled();
  });
});
