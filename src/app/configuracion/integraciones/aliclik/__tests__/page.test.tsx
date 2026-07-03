/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Tests: AliclikConfigPage (app/configuracion/integraciones/aliclik/page.tsx)
 *
 * Comportamiento verificado:
 * 1. Estado "no configurado": carga credencial null → muestra formulario con campos token y baseUrl.
 * 2. Estado "configurado": carga credencial con webhookSecret → muestra URL completa del webhook.
 * 3. Copiar webhook: mockeado navigator.clipboard.writeText → se llama con la URL completa.
 * 4. Guardar: completa el form, submit → llama saveAliclikCredentials y testAliclikConnection.
 * 5. Guardar: tras éxito muestra "Cuenta conectada".
 * 6. Guardar: si testAliclikConnection retorna ok=true → muestra "Conexión verificada".
 * 7. Guardar: si testAliclikConnection retorna ok=false → muestra aviso de fallo de conexión.
 * 8. Error de carga: getAliclikCredentials rechaza → muestra mensaje de error.
 * 9. Error de guardado: saveAliclikCredentials rechaza → muestra mensaje de error en el form.
 * 10. "Actualizar token": click → vuelve a mostrar el formulario.
 * 11. No renderiza nada si no hay companyId en el auth.
 *
 * Mocks aplicados:
 * - @/contexts/AuthContext → useAuth
 * - @/services/aliclikService → getAliclikCredentials, saveAliclikCredentials, testAliclikConnection
 * - navigator.clipboard.writeText → jest.fn()
 * - next/navigation → useRouter mock (page usa "use client" pero no router directamente; lo incluimos por si acaso)
 */

import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ── Mocks ──────────────────────────────────────────────────────────────────────

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: jest.fn(),
}));

jest.mock('@/services/aliclikService', () => ({
  getAliclikCredentials: jest.fn(),
  saveAliclikCredentials: jest.fn(),
  testAliclikConnection: jest.fn(),
  updateAliclikStore: jest.fn(),
}));

jest.mock('@/services/companyService', () => ({
  fetchCompanyById: jest.fn(),
}));

// next/navigation puede ser importado por layouts; lo mockeamos para evitar errores
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  usePathname: () => '/configuracion/integraciones/aliclik',
}));

// ── Imports bajo prueba ────────────────────────────────────────────────────────

import { useAuth } from '@/contexts/AuthContext';
import {
  getAliclikCredentials,
  saveAliclikCredentials,
  testAliclikConnection,
  updateAliclikStore,
} from '@/services/aliclikService';
import { fetchCompanyById } from '@/services/companyService';
import AliclikConfigPage from '../page';

// ── Casts ──────────────────────────────────────────────────────────────────────

const mockUseAuth = jest.mocked(useAuth);
const mockGetCredentials = jest.mocked(getAliclikCredentials);
const mockSaveCredentials = jest.mocked(saveAliclikCredentials);
const mockTestConnection = jest.mocked(testAliclikConnection);
const mockUpdateAliclikStore = jest.mocked(updateAliclikStore);
const mockFetchCompanyById = jest.mocked(fetchCompanyById);

// ── Fixtures ───────────────────────────────────────────────────────────────────

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

const MOCK_CREDENTIAL_WITH_WEBHOOK = {
  id: 'cred-1',
  companyId: 'company-1',
  baseUrl: 'https://api.aliclik.app',
  isActive: true,
  webhookSecret: 'webhook-secret-abc',
  importStoreId: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const MOCK_CREDENTIAL_NO_WEBHOOK = {
  ...MOCK_CREDENTIAL_WITH_WEBHOOK,
  webhookSecret: null,
};

const EXPECTED_WEBHOOK_URL =
  'http://localhost:3004/aliclik/webhook/order-status/webhook-secret-abc';

// ── Setup ──────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  mockUseAuth.mockReturnValue(MOCK_AUTH as unknown as ReturnType<typeof useAuth>);
  // Por defecto: sin credencial guardada
  mockGetCredentials.mockResolvedValue(null);
  mockSaveCredentials.mockResolvedValue(MOCK_CREDENTIAL_WITH_WEBHOOK);
  mockTestConnection.mockResolvedValue({ ok: true });
  // Por defecto: company sin stores (los tests de selector sobreescriben esto)
  mockFetchCompanyById.mockResolvedValue({ id: 'company-1', name: 'Powip Test', userId: 'user-1', stores: [] });
  mockUpdateAliclikStore.mockResolvedValue(MOCK_CREDENTIAL_WITH_WEBHOOK);

  // Mock de clipboard
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: jest.fn().mockResolvedValue(undefined) },
    writable: true,
    configurable: true,
  });
});

// ── Helper ─────────────────────────────────────────────────────────────────────

function renderPage() {
  return render(<AliclikConfigPage />);
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('AliclikConfigPage', () => {

  // ── 1. Estado no configurado ───────────────────────────────────────────────

  describe('estado no configurado (credencial null)', () => {
    it('muestra el formulario de credenciales tras cargar null', async () => {
      renderPage();
      expect(
        await screen.findByRole('heading', { name: /credenciales aliclik/i }),
      ).toBeInTheDocument();
    });

    it('muestra el campo de Bearer Token', async () => {
      renderPage();
      expect(
        await screen.findByLabelText(/bearer token de aliclik/i),
      ).toBeInTheDocument();
    });

    it('muestra el campo de URL base', async () => {
      renderPage();
      expect(await screen.findByLabelText(/url base de la api/i)).toBeInTheDocument();
    });

    it('muestra el botón "Guardar y verificar conexión" deshabilitado cuando el token está vacío', async () => {
      renderPage();
      const btn = await screen.findByRole('button', {
        name: /guardar y verificar conexión/i,
      });
      expect(btn).toBeDisabled();
    });

    it('el botón "Guardar y verificar" se habilita al escribir un token', async () => {
      renderPage();
      const tokenInput = await screen.findByLabelText(/bearer token de aliclik/i);
      const user = userEvent.setup();
      await user.type(tokenInput, 'mi-token-123');
      const btn = screen.getByRole('button', { name: /guardar y verificar conexión/i });
      expect(btn).not.toBeDisabled();
    });

    it('llama a getAliclikCredentials con el token y companyId del auth', async () => {
      renderPage();
      await waitFor(() => {
        expect(mockGetCredentials).toHaveBeenCalledWith('fake-token', 'company-1');
      });
    });
  });

  // ── 2. Estado configurado ─────────────────────────────────────────────────

  describe('estado configurado (credencial existente)', () => {
    beforeEach(() => {
      mockGetCredentials.mockResolvedValue(MOCK_CREDENTIAL_WITH_WEBHOOK);
    });

    it('muestra "Cuenta conectada" cuando hay credencial', async () => {
      renderPage();
      expect(await screen.findByText(/cuenta conectada/i)).toBeInTheDocument();
    });

    it('muestra la URL completa del webhook cuando hay webhookSecret', async () => {
      renderPage();
      expect(await screen.findByText(EXPECTED_WEBHOOK_URL)).toBeInTheDocument();
    });

    it('muestra el botón "Copiar"', async () => {
      renderPage();
      expect(
        await screen.findByRole('button', { name: /copiar url del webhook/i }),
      ).toBeInTheDocument();
    });

    it('no muestra el formulario de credenciales cuando ya hay credencial configurada', async () => {
      renderPage();
      await screen.findByText(/cuenta conectada/i);
      expect(
        screen.queryByRole('heading', { name: /credenciales aliclik/i }),
      ).not.toBeInTheDocument();
    });
  });

  // ── 3. Botón copiar webhook ───────────────────────────────────────────────

  describe('copiar URL del webhook', () => {
    beforeEach(() => {
      mockGetCredentials.mockResolvedValue(MOCK_CREDENTIAL_WITH_WEBHOOK);
    });

    it('llama a navigator.clipboard.writeText con la URL completa del webhook', async () => {
      renderPage();
      const copyBtn = await screen.findByRole('button', {
        name: /copiar url del webhook/i,
      });
      // fireEvent en vez de userEvent: userEvent.setup() reemplaza
      // navigator.clipboard con su propio stub, rompiendo el spy del test.
      fireEvent.click(copyBtn);

      await waitFor(() => {
        expect(navigator.clipboard.writeText).toHaveBeenCalledWith(EXPECTED_WEBHOOK_URL);
      });
    });

    it('muestra "¡Copiado!" brevemente tras copiar', async () => {
      renderPage();
      const copyBtn = await screen.findByRole('button', {
        name: /copiar url del webhook/i,
      });
      const user = userEvent.setup();
      await user.click(copyBtn);

      expect(await screen.findByText(/¡Copiado!/i)).toBeInTheDocument();
    });

    it('no muestra sección webhook cuando no hay webhookSecret', async () => {
      mockGetCredentials.mockResolvedValue(MOCK_CREDENTIAL_NO_WEBHOOK);
      renderPage();
      await screen.findByText(/cuenta conectada/i);
      expect(
        screen.queryByRole('button', { name: /copiar url del webhook/i }),
      ).not.toBeInTheDocument();
    });
  });

  // ── 4. Flujo de guardado ──────────────────────────────────────────────────

  describe('guardar credenciales', () => {
    it('llama a saveAliclikCredentials con el token ingresado y companyId', async () => {
      renderPage();
      const tokenInput = await screen.findByLabelText(/bearer token de aliclik/i);
      const user = userEvent.setup();
      await user.type(tokenInput, 'nuevo-token');

      const btn = screen.getByRole('button', { name: /guardar y verificar conexión/i });
      await user.click(btn);

      await waitFor(() => {
        expect(mockSaveCredentials).toHaveBeenCalledWith(
          'fake-token',
          expect.objectContaining({
            companyId: 'company-1',
            token: 'nuevo-token',
          }),
        );
      });
    });

    it('llama a testAliclikConnection con el token y companyId tras guardar', async () => {
      renderPage();
      const tokenInput = await screen.findByLabelText(/bearer token de aliclik/i);
      const user = userEvent.setup();
      await user.type(tokenInput, 'nuevo-token');
      await user.click(screen.getByRole('button', { name: /guardar y verificar conexión/i }));

      await waitFor(() => {
        expect(mockTestConnection).toHaveBeenCalledWith('fake-token', 'company-1');
      });
    });

    it('tras guardar con éxito muestra "Cuenta conectada"', async () => {
      // Primera llamada: carga inicial → sin credencial (formulario visible)
      // Segunda llamada: recarga post-guardado → credencial activa (badge "Integración activa" + texto "Cuenta conectada")
      mockGetCredentials
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(MOCK_CREDENTIAL_WITH_WEBHOOK);

      renderPage();
      const tokenInput = await screen.findByLabelText(/bearer token de aliclik/i);
      const user = userEvent.setup();
      await user.type(tokenInput, 'nuevo-token');
      await user.click(screen.getByRole('button', { name: /guardar y verificar conexión/i }));

      expect(await screen.findByText(/cuenta conectada/i)).toBeInTheDocument();
      expect(await screen.findByText(/integración activa/i)).toBeInTheDocument();
    });

    it('tras guardar muestra "Conexión verificada" cuando testConnection retorna ok=true', async () => {
      // Primera llamada: carga inicial → sin credencial (formulario visible)
      // Segunda llamada: recarga post-guardado → credencial activa
      // Con connectionOk=true se renderiza "Conexión verificada con Aliclik" dentro del bloque configurado
      mockTestConnection.mockResolvedValue({ ok: true });
      mockGetCredentials
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(MOCK_CREDENTIAL_WITH_WEBHOOK);

      renderPage();
      const tokenInput = await screen.findByLabelText(/bearer token de aliclik/i);
      const user = userEvent.setup();
      await user.type(tokenInput, 'nuevo-token');
      await user.click(screen.getByRole('button', { name: /guardar y verificar conexión/i }));

      expect(
        await screen.findByText(/conexión verificada con aliclik/i),
      ).toBeInTheDocument();
    });

    it('tras guardar muestra aviso de fallo cuando testConnection retorna ok=false', async () => {
      // Primera llamada: carga inicial → sin credencial (formulario visible)
      // Segunda llamada: recarga post-guardado → credencial inactiva (isActive: false)
      // Con connectionOk=false se renderiza el aviso: "La conexión falló: revisá el token. La integración queda inactiva."
      mockTestConnection.mockResolvedValue({ ok: false });
      mockGetCredentials
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ ...MOCK_CREDENTIAL_WITH_WEBHOOK, isActive: false });

      renderPage();
      const tokenInput = await screen.findByLabelText(/bearer token de aliclik/i);
      const user = userEvent.setup();
      await user.type(tokenInput, 'nuevo-token');
      await user.click(screen.getByRole('button', { name: /guardar y verificar conexión/i }));

      expect(
        await screen.findByText(/la conexión falló: revisá el token\. la integración queda inactiva\./i),
      ).toBeInTheDocument();
      expect(await screen.findByText(/integración inactiva/i)).toBeInTheDocument();
    });

    it('incluye baseUrl en el payload cuando se ingresa en el campo', async () => {
      renderPage();
      const tokenInput = await screen.findByLabelText(/bearer token de aliclik/i);
      const urlInput = screen.getByLabelText(/url base de la api/i);
      const user = userEvent.setup();
      await user.type(tokenInput, 'nuevo-token');
      await user.type(urlInput, 'https://custom.aliclik.app');
      await user.click(screen.getByRole('button', { name: /guardar y verificar conexión/i }));

      await waitFor(() => {
        expect(mockSaveCredentials).toHaveBeenCalledWith(
          'fake-token',
          expect.objectContaining({ baseUrl: 'https://custom.aliclik.app' }),
        );
      });
    });
  });

  // ── 5. Error de guardado ──────────────────────────────────────────────────

  describe('error al guardar', () => {
    it('muestra el mensaje de error del servidor cuando saveAliclikCredentials rechaza', async () => {
      mockSaveCredentials.mockRejectedValue({
        response: { data: { message: 'Token Aliclik no válido' } },
      });
      renderPage();
      const tokenInput = await screen.findByLabelText(/bearer token de aliclik/i);
      const user = userEvent.setup();
      await user.type(tokenInput, 'token-malo');
      await user.click(screen.getByRole('button', { name: /guardar y verificar conexión/i }));

      expect(await screen.findByText('Token Aliclik no válido')).toBeInTheDocument();
    });

    it('muestra mensaje genérico cuando el error no tiene response.data.message', async () => {
      mockSaveCredentials.mockRejectedValue(new Error('Network Error'));
      renderPage();
      const tokenInput = await screen.findByLabelText(/bearer token de aliclik/i);
      const user = userEvent.setup();
      await user.type(tokenInput, 'token-malo');
      await user.click(screen.getByRole('button', { name: /guardar y verificar conexión/i }));

      expect(await screen.findByText('Network Error')).toBeInTheDocument();
    });

    it('no llama a testAliclikConnection cuando saveAliclikCredentials rechaza', async () => {
      mockSaveCredentials.mockRejectedValue(new Error('fail'));
      renderPage();
      const tokenInput = await screen.findByLabelText(/bearer token de aliclik/i);
      const user = userEvent.setup();
      await user.type(tokenInput, 'token-malo');
      await user.click(screen.getByRole('button', { name: /guardar y verificar conexión/i }));

      await waitFor(() => {
        expect(mockSaveCredentials).toHaveBeenCalled();
      });
      expect(mockTestConnection).not.toHaveBeenCalled();
    });
  });

  // ── 6. Error de carga ─────────────────────────────────────────────────────

  describe('error al cargar credencial', () => {
    it('muestra mensaje de error cuando getAliclikCredentials rechaza', async () => {
      mockGetCredentials.mockRejectedValue(new Error('Server error'));
      renderPage();
      expect(
        await screen.findByText(/no se pudo cargar la configuración de aliclik/i),
      ).toBeInTheDocument();
    });

    it('no muestra el formulario cuando hay error de carga', async () => {
      mockGetCredentials.mockRejectedValue(new Error('fail'));
      renderPage();
      await screen.findByText(/no se pudo cargar la configuración de aliclik/i);
      expect(
        screen.queryByRole('heading', { name: /credenciales aliclik/i }),
      ).not.toBeInTheDocument();
    });
  });

  // ── 7. "Actualizar token" / reconfigurar ──────────────────────────────────

  describe('botón "Actualizar token"', () => {
    beforeEach(() => {
      mockGetCredentials.mockResolvedValue(MOCK_CREDENTIAL_WITH_WEBHOOK);
    });

    it('al hacer click en "Actualizar token →" vuelve a mostrar el formulario', async () => {
      renderPage();
      // Esperar que cargue el estado configurado
      await screen.findByText(/cuenta conectada/i);

      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: /actualizar token/i }));

      expect(
        await screen.findByRole('heading', { name: /credenciales aliclik/i }),
      ).toBeInTheDocument();
    });

    it('al reconfigurar no se muestra "Cuenta conectada"', async () => {
      renderPage();
      await screen.findByText(/cuenta conectada/i);

      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: /actualizar token/i }));

      await screen.findByRole('heading', { name: /credenciales aliclik/i });
      expect(screen.queryByText(/cuenta conectada/i)).not.toBeInTheDocument();
    });
  });

  // ── 8. Sin companyId ──────────────────────────────────────────────────────

  describe('sin companyId en auth', () => {
    it('no renderiza nada cuando auth.company es null', () => {
      mockUseAuth.mockReturnValue({
        ...MOCK_AUTH,
        auth: { ...MOCK_AUTH.auth, company: null },
      } as unknown as ReturnType<typeof useAuth>);
      const { container } = renderPage();
      expect(container).toBeEmptyDOMElement();
    });

    it('no llama a getAliclikCredentials cuando no hay companyId', () => {
      mockUseAuth.mockReturnValue({
        ...MOCK_AUTH,
        auth: { ...MOCK_AUTH.auth, company: null },
      } as unknown as ReturnType<typeof useAuth>);
      renderPage();
      expect(mockGetCredentials).not.toHaveBeenCalled();
    });
  });

  // ── 10. Selector de store destino ────────────────────────────────────────

  describe('selector de store destino', () => {
    const MOCK_STORES = [
      { id: 'store-1', name: 'Tienda Principal' },
      { id: 'store-2', name: 'Tienda Secundaria' },
    ];

    beforeEach(() => {
      mockGetCredentials.mockResolvedValue(MOCK_CREDENTIAL_WITH_WEBHOOK);
      mockFetchCompanyById.mockResolvedValue({
        id: 'company-1',
        name: 'Powip Test',
        userId: 'user-1',
        stores: MOCK_STORES,
      });
    });

    it('renderiza la opción "Sin store destino" y las opciones de stores de la empresa', async () => {
      renderPage();
      await screen.findByText(/cuenta conectada/i);

      const select = await screen.findByLabelText(/store destino/i);
      expect(select).toBeInTheDocument();

      expect(screen.getByRole('option', { name: /sin store destino/i })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: /tienda principal/i })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: /tienda secundaria/i })).toBeInTheDocument();
    });

    it('el select refleja credential.importStoreId como valor inicial cuando es null (opción vacía)', async () => {
      // MOCK_CREDENTIAL_WITH_WEBHOOK tiene importStoreId: null → valor inicial ""
      renderPage();
      await screen.findByText(/cuenta conectada/i);

      const select = await screen.findByLabelText(/store destino/i) as HTMLSelectElement;
      expect(select.value).toBe('');
    });

    it('el select refleja credential.importStoreId como valor inicial cuando tiene un store asignado', async () => {
      mockGetCredentials.mockResolvedValue({
        ...MOCK_CREDENTIAL_WITH_WEBHOOK,
        importStoreId: 'store-1',
      });
      renderPage();
      await screen.findByText(/cuenta conectada/i);

      const select = await screen.findByLabelText(/store destino/i) as HTMLSelectElement;
      await waitFor(() => expect(select.value).toBe('store-1'));
    });

    it('al cambiar el select y clickear "Guardar" llama updateAliclikStore con el storeId seleccionado', async () => {
      renderPage();
      await screen.findByText(/cuenta conectada/i);

      const select = await screen.findByLabelText(/store destino/i);
      const user = userEvent.setup();
      await user.selectOptions(select, 'store-1');

      const saveBtn = screen.getByRole('button', { name: /^guardar$/i });
      await user.click(saveBtn);

      await waitFor(() => {
        expect(mockUpdateAliclikStore).toHaveBeenCalledWith(
          'fake-token',
          'company-1',
          'store-1',
        );
      });
    });

    it('al cambiar el select a "Sin store destino" y guardar, llama updateAliclikStore con null', async () => {
      // Credencial con store asignado → cambiar a vacío
      mockGetCredentials.mockResolvedValue({
        ...MOCK_CREDENTIAL_WITH_WEBHOOK,
        importStoreId: 'store-1',
      });
      renderPage();
      await screen.findByText(/cuenta conectada/i);

      const select = await screen.findByLabelText(/store destino/i);
      // Esperar que el valor inicial se establezca
      await waitFor(() => expect((select as HTMLSelectElement).value).toBe('store-1'));

      const user = userEvent.setup();
      await user.selectOptions(select, '');

      const saveBtn = screen.getByRole('button', { name: /^guardar$/i });
      await user.click(saveBtn);

      await waitFor(() => {
        expect(mockUpdateAliclikStore).toHaveBeenCalledWith(
          'fake-token',
          'company-1',
          null,
        );
      });
    });

    it('el botón "Guardar" está deshabilitado cuando el valor no cambió respecto a credential.importStoreId', async () => {
      // importStoreId: null → valor inicial "" → botón deshabilitado sin cambios
      renderPage();
      await screen.findByText(/cuenta conectada/i);
      await screen.findByLabelText(/store destino/i);

      const saveBtn = screen.getByRole('button', { name: /^guardar$/i });
      expect(saveBtn).toBeDisabled();
    });

    it('el botón "Guardar" se habilita al cambiar el valor del select', async () => {
      renderPage();
      await screen.findByText(/cuenta conectada/i);

      const select = await screen.findByLabelText(/store destino/i);
      const user = userEvent.setup();
      await user.selectOptions(select, 'store-2');

      const saveBtn = screen.getByRole('button', { name: /^guardar$/i });
      expect(saveBtn).not.toBeDisabled();
    });

    it('tras guardar exitosamente, la credencial se refresca (setCredential con la respuesta)', async () => {
      const updatedCredential = {
        ...MOCK_CREDENTIAL_WITH_WEBHOOK,
        importStoreId: 'store-2',
      };
      mockUpdateAliclikStore.mockResolvedValue(updatedCredential);

      renderPage();
      await screen.findByText(/cuenta conectada/i);

      const select = await screen.findByLabelText(/store destino/i);
      const user = userEvent.setup();
      await user.selectOptions(select, 'store-2');
      await user.click(screen.getByRole('button', { name: /^guardar$/i }));

      await waitFor(() => {
        expect(mockUpdateAliclikStore).toHaveBeenCalledTimes(1);
      });
      // El botón vuelve a estar deshabilitado porque el estado fue refrescado con importStoreId: 'store-2'
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /^guardar$/i })).toBeDisabled();
      });
    });
  });

  // ── 11. Header de la página ───────────────────────────────────────────────

  describe('header de la página', () => {
    it('muestra el título "Integración Aliclik"', async () => {
      renderPage();
      expect(
        await screen.findByRole('heading', { name: /integración aliclik/i }),
      ).toBeInTheDocument();
    });

    it('muestra la descripción de la integración', async () => {
      renderPage();
      expect(
        await screen.findByText(/conectá tu cuenta aliclik/i),
      ).toBeInTheDocument();
    });
  });
});
