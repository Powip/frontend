/**
 * Tests: ShalomConfigPage (app/configuracion/integraciones/shalom/page.tsx)
 *
 * Comportamiento verificado (fix del flujo de conexion Shalom):
 * - `handleConnect` ya NO llama `createShalomInstance` en cada click.
 *
 * 1. Si `saveShalomConfig` devuelve `instanceId` no-nulo -> NO se crea instancia,
 *    se va directo a `loginShalom`.
 * 2. Si `saveShalomConfig` NO devuelve `instanceId` pero la config ya cargada en
 *    el estado tenia uno (fallback `savedConfig?.instanceId || config?.instanceId`)
 *    -> tampoco se crea instancia, y NO se consulta `getShalomStatus` como fallback.
 * 3. Sin `instanceId` en ningun lado y `getShalomStatus.hasInstance === false`
 *    -> SI se crea instancia, y luego login.
 * 4. Sin `instanceId` pero `getShalomStatus.hasInstance === true`
 *    -> NO se crea instancia, se va a login.
 * 5. En todos los casos el flujo termina llamando `loginShalom(token, companyId)`.
 * 6. Login exitoso -> se muestra el estado "Cuenta conectada".
 * 7. Login con `success: false` -> se muestra el mensaje de error, sin conectar.
 * 8. Sin companyId en el auth -> no renderiza nada.
 * 9. Si YA habia instancia y el primer `loginShalom` falla -> se recrea la
 *    instancia y se reintenta el login UNA vez (instancia muerta de la API vieja).
 *    Recien si el segundo login falla se muestra el error.
 *
 * Mocks:
 * - @/contexts/AuthContext -> useAuth
 * - @/services/shalomService -> getShalomConfig, saveShalomConfig, getShalomStatus,
 *   createShalomInstance, loginShalom
 * - next/navigation -> defensivo (la page no lo usa directamente)
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ── Mocks ─────────────────────────────────────────────────────────────────────

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: jest.fn(),
}));

jest.mock('@/services/shalomService', () => ({
  getShalomConfig: jest.fn(),
  saveShalomConfig: jest.fn(),
  getShalomStatus: jest.fn(),
  createShalomInstance: jest.fn(),
  loginShalom: jest.fn(),
}));

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  usePathname: () => '/configuracion/integraciones/shalom',
}));

// ── Imports bajo prueba ───────────────────────────────────────────────────────

import { useAuth } from '@/contexts/AuthContext';
import {
  getShalomConfig,
  saveShalomConfig,
  getShalomStatus,
  createShalomInstance,
  loginShalom,
} from '@/services/shalomService';
import ShalomConfigPage from '../page';

// ── Casts ─────────────────────────────────────────────────────────────────────

const mockUseAuth = jest.mocked(useAuth);
const mockGetConfig = jest.mocked(getShalomConfig);
const mockSaveConfig = jest.mocked(saveShalomConfig);
const mockGetStatus = jest.mocked(getShalomStatus);
const mockCreateInstance = jest.mocked(createShalomInstance);
const mockLogin = jest.mocked(loginShalom);

// ── Fixtures ──────────────────────────────────────────────────────────────────

const MOCK_AUTH = {
  auth: {
    user: { id: 'user-1', email: 'admin@powip.com', role: 'ADMIN', permissions: [] },
    company: { id: 'company-1', name: 'Powip Test', stores: [] },
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

const BASE_CONFIG = {
  id: 'cfg-1',
  companyId: 'company-1',
  instanceId: null as string | null,
  instanceKey: null as string | null,
  username: 'shalom-user@empresa.com',
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  mockUseAuth.mockReturnValue(MOCK_AUTH as unknown as ReturnType<typeof useAuth>);
  // Defaults: sin instancia en ningun lado, login OK.
  mockGetConfig.mockResolvedValue({ ...BASE_CONFIG, instanceId: null });
  mockGetStatus.mockResolvedValue({ isLoggedIn: false, username: null, hasInstance: false });
  mockSaveConfig.mockResolvedValue({ ...BASE_CONFIG, instanceId: null });
  mockCreateInstance.mockResolvedValue({ instanceId: 'new-instance' });
  mockLogin.mockResolvedValue({ success: true, message: 'ok' });
});

// ── Helper: completa el form y hace submit ────────────────────────────────────

async function fillAndSubmit() {
  const user = userEvent.setup();
  const userInput = await screen.findByPlaceholderText(/usuario@empresa\.com/i);
  const passInput = screen.getByPlaceholderText(/contraseña de shalom pro/i);
  await user.clear(userInput);
  await user.type(userInput, 'shalom-user@empresa.com');
  await user.type(passInput, 'secret-pass');
  await user.click(screen.getByRole('button', { name: /conectar con shalom pro/i }));
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ShalomConfigPage - handleConnect', () => {
  // ── 1. Instancia ya presente en la config guardada ─────────────────────────

  describe('instancia ya existente', () => {
    it('no crea instancia y va directo a login cuando saveShalomConfig devuelve instanceId', async () => {
      mockGetConfig.mockResolvedValue({ ...BASE_CONFIG, instanceId: null });
      mockSaveConfig.mockResolvedValue({ ...BASE_CONFIG, instanceId: 'inst-existing' });

      render(<ShalomConfigPage />);
      await fillAndSubmit();

      await waitFor(() =>
        expect(mockLogin).toHaveBeenCalledWith('fake-token', 'company-1'),
      );
      expect(mockCreateInstance).not.toHaveBeenCalled();
      // No hizo falta consultar el estado como fallback.
      expect(mockGetStatus).not.toHaveBeenCalled();
      // El flujo termina conectando.
      expect(await screen.findByText(/cuenta conectada/i)).toBeInTheDocument();
    });

    it('no crea instancia cuando el instanceId viene del estado previo (config ya cargada con instancia)', async () => {
      // Config inicial CON instancia -> getShalomStatus se consulta 1 vez al montar.
      mockGetConfig.mockResolvedValue({ ...BASE_CONFIG, instanceId: 'inst-from-load' });
      mockGetStatus.mockResolvedValue({
        isLoggedIn: false,
        username: 'shalom-user@empresa.com',
        hasInstance: true,
      });
      // El save NO echa de vuelta el instanceId.
      mockSaveConfig.mockResolvedValue({ ...BASE_CONFIG, instanceId: null });

      render(<ShalomConfigPage />);
      await fillAndSubmit();

      await waitFor(() =>
        expect(mockLogin).toHaveBeenCalledWith('fake-token', 'company-1'),
      );
      expect(mockCreateInstance).not.toHaveBeenCalled();
      // getShalomStatus solo se llamo al montar, NO como fallback dentro de handleConnect.
      expect(mockGetStatus).toHaveBeenCalledTimes(1);
      expect(await screen.findByText(/cuenta conectada/i)).toBeInTheDocument();
    });
  });

  // ── 2. Sin instancia en ningun lado ───────────────────────────────────────

  describe('sin instancia en ningun lado', () => {
    it('crea la instancia y luego hace login cuando no hay instanceId ni status.hasInstance', async () => {
      mockGetConfig.mockResolvedValue({ ...BASE_CONFIG, instanceId: null });
      mockSaveConfig.mockResolvedValue({ ...BASE_CONFIG, instanceId: null });
      mockGetStatus.mockResolvedValue({ isLoggedIn: false, username: null, hasInstance: false });

      render(<ShalomConfigPage />);
      await fillAndSubmit();

      await waitFor(() =>
        expect(mockCreateInstance).toHaveBeenCalledWith('fake-token', 'company-1'),
      );
      await waitFor(() =>
        expect(mockLogin).toHaveBeenCalledWith('fake-token', 'company-1'),
      );
      // El fallback de estado se consulto antes de decidir crear.
      expect(mockGetStatus).toHaveBeenCalledWith('fake-token', 'company-1');
      expect(await screen.findByText(/cuenta conectada/i)).toBeInTheDocument();
    });
  });

  // ── 3. Sin instanceId pero el proveedor ya tiene instancia ────────────────

  describe('instancia detectada via getShalomStatus', () => {
    it('no crea instancia si getShalomStatus.hasInstance es true, va directo a login', async () => {
      mockGetConfig.mockResolvedValue({ ...BASE_CONFIG, instanceId: null });
      mockSaveConfig.mockResolvedValue({ ...BASE_CONFIG, instanceId: null });
      mockGetStatus.mockResolvedValue({ isLoggedIn: false, username: null, hasInstance: true });

      render(<ShalomConfigPage />);
      await fillAndSubmit();

      await waitFor(() =>
        expect(mockLogin).toHaveBeenCalledWith('fake-token', 'company-1'),
      );
      expect(mockCreateInstance).not.toHaveBeenCalled();
      expect(mockGetStatus).toHaveBeenCalledWith('fake-token', 'company-1');
      expect(await screen.findByText(/cuenta conectada/i)).toBeInTheDocument();
    });
  });

  // ── 4. Resultado del login ────────────────────────────────────────────────

  describe('resultado del login', () => {
    it('tras un login exitoso muestra el estado "Cuenta conectada"', async () => {
      mockGetConfig.mockResolvedValue({ ...BASE_CONFIG, instanceId: 'inst-1' });
      mockGetStatus.mockResolvedValue({
        isLoggedIn: false,
        username: 'shalom-user@empresa.com',
        hasInstance: true,
      });
      mockSaveConfig.mockResolvedValue({ ...BASE_CONFIG, instanceId: 'inst-1' });
      mockLogin.mockResolvedValue({ success: true, message: 'ok' });

      render(<ShalomConfigPage />);
      await fillAndSubmit();

      expect(await screen.findByText(/cuenta conectada/i)).toBeInTheDocument();
    });

    it('si loginShalom devuelve success:false (los dos intentos) muestra el mensaje de error y NO conecta', async () => {
      mockGetConfig.mockResolvedValue({ ...BASE_CONFIG, instanceId: 'inst-1' });
      mockGetStatus.mockResolvedValue({
        isLoggedIn: false,
        username: 'shalom-user@empresa.com',
        hasInstance: true,
      });
      mockSaveConfig.mockResolvedValue({ ...BASE_CONFIG, instanceId: 'inst-1' });
      mockLogin.mockResolvedValue({ success: false, message: 'Credenciales incorrectas' });

      render(<ShalomConfigPage />);
      await fillAndSubmit();

      expect(await screen.findByText('Credenciales incorrectas')).toBeInTheDocument();
      expect(screen.queryByText(/cuenta conectada/i)).not.toBeInTheDocument();
      // Habia instancia -> se reintento una vez (recrear + re-login).
      expect(mockLogin).toHaveBeenCalledTimes(2);
      expect(mockCreateInstance).toHaveBeenCalledTimes(1);
    });
  });

  // ── 6. Reintento cuando la instancia esta muerta ──────────────────────────

  describe('reintento de instancia muerta (API vieja)', () => {
    it('si habia instanceId y el primer loginShalom falla, recrea la instancia y reintenta el login', async () => {
      // Empresa que arrastra un instanceId de la API vieja (posiblemente muerto).
      mockGetConfig.mockResolvedValue({ ...BASE_CONFIG, instanceId: 'inst-old' });
      mockGetStatus.mockResolvedValue({
        isLoggedIn: false,
        username: 'shalom-user@empresa.com',
        hasInstance: true,
      });
      mockSaveConfig.mockResolvedValue({ ...BASE_CONFIG, instanceId: 'inst-old' });
      mockLogin
        .mockResolvedValueOnce({ success: false, message: 'instancia no encontrada' })
        .mockResolvedValueOnce({ success: true, message: 'ok' });

      render(<ShalomConfigPage />);
      await fillAndSubmit();

      // Entre los dos intentos de login se recreo la instancia.
      await waitFor(() =>
        expect(mockCreateInstance).toHaveBeenCalledWith('fake-token', 'company-1'),
      );
      expect(mockLogin).toHaveBeenCalledTimes(2);
      // El reintento destraba la conexion.
      expect(await screen.findByText(/cuenta conectada/i)).toBeInTheDocument();
    });

    it('NO reintenta (ni recrea) si la instancia se acababa de crear en este mismo flujo', async () => {
      // Sin instancia en ningun lado -> se crea 1 vez; si el login falla es por
      // credenciales, no por instancia muerta: no tiene sentido recrear.
      mockGetConfig.mockResolvedValue({ ...BASE_CONFIG, instanceId: null });
      mockSaveConfig.mockResolvedValue({ ...BASE_CONFIG, instanceId: null });
      mockGetStatus.mockResolvedValue({ isLoggedIn: false, username: null, hasInstance: false });
      mockLogin.mockResolvedValue({ success: false, message: 'Usuario o contraseña inválidos' });

      render(<ShalomConfigPage />);
      await fillAndSubmit();

      expect(await screen.findByText('Usuario o contraseña inválidos')).toBeInTheDocument();
      expect(mockCreateInstance).toHaveBeenCalledTimes(1);
      expect(mockLogin).toHaveBeenCalledTimes(1);
    });
  });

  // ── 5. Guardas ────────────────────────────────────────────────────────────

  describe('guardas de render', () => {
    it('no renderiza nada si no hay companyId en el auth', () => {
      mockUseAuth.mockReturnValue({
        ...MOCK_AUTH,
        auth: { ...MOCK_AUTH.auth, company: null },
      } as unknown as ReturnType<typeof useAuth>);

      const { container } = render(<ShalomConfigPage />);
      expect(container).toBeEmptyDOMElement();
      expect(mockGetConfig).not.toHaveBeenCalled();
    });
  });
});
