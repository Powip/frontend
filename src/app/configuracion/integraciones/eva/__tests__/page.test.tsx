/**
 * Tests: EvaConfigPage (app/configuracion/integraciones/eva/page.tsx)
 *
 * Comportamiento verificado:
 * 1. Estado "no configurado": carga credencial null → muestra formulario con
 *    campos Api-Key, URL base y Tipo de cuenta EVA.
 * 2. Estado "configurado" (activa): muestra "Cuenta conectada", badge
 *    "Integración activa", maskedApiKey, tipo de cuenta, estado del webhook
 *    secret y URL base ("Por defecto" si es null).
 * 3. Estado "configurado" (inactiva): muestra "Credenciales guardadas" y
 *    badge "Integración inactiva".
 * 4. Estado "no configurado" (sin loading): badge "No configurada".
 * 5. Copiar webhook: clipboard.writeText con la URL completa; feedback "¡Copiado!".
 * 6. Guardar: completa el form, submit → llama saveEvaCredentials y
 *    testEvaConnection, luego recarga la credencial.
 * 7. Tras guardar con éxito y testEvaConnection ok=true → muestra "Conexión
 *    verificada con EVA".
 * 8. Tras guardar con éxito y testEvaConnection rechaza (ok=false) → muestra
 *    aviso de fallo de conexión y la credencial queda inactiva.
 * 9. Error de guardado: saveEvaCredentials rechaza → muestra mensaje de error
 *    en el form y NO llama a testEvaConnection.
 * 10. Error de carga: getEvaCredentials rechaza → muestra mensaje de error.
 * 11. "Actualizar credenciales →": click → vuelve a mostrar el formulario.
 * 12. No renderiza nada si no hay companyId en el auth.
 *
 * Mocks aplicados:
 * - @/contexts/AuthContext → useAuth
 * - @/services/evaService → getEvaCredentials, saveEvaCredentials, testEvaConnection
 * - navigator.clipboard.writeText → jest.fn()
 * - next/navigation → mock defensivo (la page no lo usa directamente)
 */

import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ── Mocks ──────────────────────────────────────────────────────────────────────

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: jest.fn(),
}));

jest.mock('@/services/evaService', () => ({
  getEvaCredentials: jest.fn(),
  saveEvaCredentials: jest.fn(),
  testEvaConnection: jest.fn(),
}));

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  usePathname: () => '/configuracion/integraciones/eva',
}));

// ── Imports bajo prueba ────────────────────────────────────────────────────────

import { useAuth } from '@/contexts/AuthContext';
import {
  getEvaCredentials,
  saveEvaCredentials,
  testEvaConnection,
} from '@/services/evaService';
import EvaConfigPage from '../page';

// ── Casts ──────────────────────────────────────────────────────────────────────

const mockUseAuth = jest.mocked(useAuth);
const mockGetCredentials = jest.mocked(getEvaCredentials);
const mockSaveCredentials = jest.mocked(saveEvaCredentials);
const mockTestConnection = jest.mocked(testEvaConnection);

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

const MOCK_CREDENTIAL_ACTIVE = {
  id: 'cred-1',
  companyId: 'company-1',
  baseUrl: null,
  clientType: 'RECOJO' as const,
  maskedApiKey: '****abcd',
  hasWebhookSecret: true,
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const MOCK_CREDENTIAL_INACTIVE = {
  ...MOCK_CREDENTIAL_ACTIVE,
  isActive: false,
};

const EXPECTED_WEBHOOK_URL = 'http://localhost:3004/eva/webhook/company-1';

// ── Setup ──────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  mockUseAuth.mockReturnValue(MOCK_AUTH as unknown as ReturnType<typeof useAuth>);
  // Por defecto: sin credencial guardada
  mockGetCredentials.mockResolvedValue(null);
  mockSaveCredentials.mockResolvedValue(MOCK_CREDENTIAL_ACTIVE);
  mockTestConnection.mockResolvedValue(MOCK_CREDENTIAL_ACTIVE);

  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: jest.fn().mockResolvedValue(undefined) },
    writable: true,
    configurable: true,
  });
});

// ── Helper ─────────────────────────────────────────────────────────────────────

function renderPage() {
  return render(<EvaConfigPage />);
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('EvaConfigPage', () => {

  // ── 1. Estado no configurado ───────────────────────────────────────────────

  describe('estado no configurado (credencial null)', () => {
    it('muestra el formulario de credenciales tras cargar null', async () => {
      renderPage();
      expect(
        await screen.findByRole('heading', { name: /credenciales eva/i }),
      ).toBeInTheDocument();
    });

    it('muestra el campo Api-Key de EVA', async () => {
      renderPage();
      expect(await screen.findByLabelText(/api-key de eva/i)).toBeInTheDocument();
    });

    it('muestra el campo de URL base', async () => {
      renderPage();
      expect(await screen.findByLabelText(/url base de la api/i)).toBeInTheDocument();
    });

    it('muestra el campo Tipo de cuenta EVA con las opciones Recojo/Almacén', async () => {
      renderPage();
      const select = await screen.findByLabelText(/tipo de cuenta eva/i);
      expect(select).toBeInTheDocument();
      expect(screen.getByRole('option', { name: /^recojo$/i })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: /^almacén$/i })).toBeInTheDocument();
    });

    it('el botón "Guardar y verificar conexión" está deshabilitado cuando la Api-Key está vacía', async () => {
      renderPage();
      const btn = await screen.findByRole('button', { name: /guardar y verificar conexión/i });
      expect(btn).toBeDisabled();
    });

    it('el botón se habilita al escribir una Api-Key', async () => {
      renderPage();
      const apiKeyInput = await screen.findByLabelText(/api-key de eva/i);
      const user = userEvent.setup();
      await user.type(apiKeyInput, 'mi-api-key-123');
      const btn = screen.getByRole('button', { name: /guardar y verificar conexión/i });
      expect(btn).not.toBeDisabled();
    });

    it('llama a getEvaCredentials con el token y companyId del auth', async () => {
      renderPage();
      await waitFor(() => {
        expect(mockGetCredentials).toHaveBeenCalledWith('fake-token', 'company-1');
      });
    });

    it('muestra el badge "No configurada"', async () => {
      renderPage();
      expect(await screen.findByText(/no configurada/i)).toBeInTheDocument();
    });
  });

  // ── 2. Estado configurado — activa ────────────────────────────────────────

  describe('estado configurado (credencial activa)', () => {
    beforeEach(() => {
      mockGetCredentials.mockResolvedValue(MOCK_CREDENTIAL_ACTIVE);
    });

    it('muestra "Cuenta conectada"', async () => {
      renderPage();
      expect(await screen.findByText(/cuenta conectada/i)).toBeInTheDocument();
    });

    it('muestra el badge "Integración activa"', async () => {
      renderPage();
      expect(await screen.findByText(/integración activa/i)).toBeInTheDocument();
    });

    it('muestra la maskedApiKey', async () => {
      renderPage();
      expect(await screen.findByText('****abcd')).toBeInTheDocument();
    });

    it('muestra el tipo de cuenta "Recojo"', async () => {
      renderPage();
      await screen.findByText(/cuenta conectada/i);
      expect(screen.getByText('Recojo')).toBeInTheDocument();
    });

    it('muestra "Configurado" para el webhook secret cuando hasWebhookSecret=true', async () => {
      renderPage();
      await screen.findByText(/cuenta conectada/i);
      expect(screen.getByText('Configurado')).toBeInTheDocument();
    });

    it('muestra "Por defecto" para la URL base cuando baseUrl es null', async () => {
      renderPage();
      await screen.findByText(/cuenta conectada/i);
      expect(screen.getByText('Por defecto')).toBeInTheDocument();
    });

    it('no muestra el formulario de credenciales cuando ya hay credencial configurada', async () => {
      renderPage();
      await screen.findByText(/cuenta conectada/i);
      expect(
        screen.queryByRole('heading', { name: /credenciales eva/i }),
      ).not.toBeInTheDocument();
    });
  });

  // ── 3. Estado configurado — inactiva ──────────────────────────────────────

  describe('estado configurado (credencial inactiva)', () => {
    beforeEach(() => {
      mockGetCredentials.mockResolvedValue(MOCK_CREDENTIAL_INACTIVE);
    });

    it('muestra "Credenciales guardadas" en vez de "Cuenta conectada"', async () => {
      renderPage();
      expect(await screen.findByText(/credenciales guardadas/i)).toBeInTheDocument();
      expect(screen.queryByText(/cuenta conectada/i)).not.toBeInTheDocument();
    });

    it('muestra el badge "Integración inactiva"', async () => {
      renderPage();
      expect(await screen.findByText(/integración inactiva/i)).toBeInTheDocument();
    });
  });

  // ── 4. Copiar URL del webhook ──────────────────────────────────────────────

  describe('copiar URL del webhook', () => {
    beforeEach(() => {
      mockGetCredentials.mockResolvedValue(MOCK_CREDENTIAL_ACTIVE);
    });

    it('muestra la URL completa del webhook', async () => {
      renderPage();
      expect(await screen.findByText(EXPECTED_WEBHOOK_URL)).toBeInTheDocument();
    });

    it('llama a navigator.clipboard.writeText con la URL completa del webhook', async () => {
      renderPage();
      const copyBtn = await screen.findByRole('button', { name: /copiar url del webhook/i });
      // fireEvent en vez de userEvent: userEvent.setup() reemplaza
      // navigator.clipboard con su propio stub, rompiendo el spy del test.
      fireEvent.click(copyBtn);

      await waitFor(() => {
        expect(navigator.clipboard.writeText).toHaveBeenCalledWith(EXPECTED_WEBHOOK_URL);
      });
    });

    it('muestra "¡Copiado!" brevemente tras copiar', async () => {
      renderPage();
      const copyBtn = await screen.findByRole('button', { name: /copiar url del webhook/i });
      const user = userEvent.setup();
      await user.click(copyBtn);

      expect(await screen.findByText(/¡copiado!/i)).toBeInTheDocument();
    });
  });

  // ── 5. Flujo de guardado ──────────────────────────────────────────────────

  describe('guardar credenciales', () => {
    it('llama a saveEvaCredentials con la Api-Key ingresada, companyId y clientType', async () => {
      renderPage();
      const apiKeyInput = await screen.findByLabelText(/api-key de eva/i);
      const user = userEvent.setup();
      await user.type(apiKeyInput, 'nueva-api-key');

      const btn = screen.getByRole('button', { name: /guardar y verificar conexión/i });
      await user.click(btn);

      await waitFor(() => {
        expect(mockSaveCredentials).toHaveBeenCalledWith(
          'fake-token',
          expect.objectContaining({
            companyId: 'company-1',
            apiKey: 'nueva-api-key',
            clientType: 'RECOJO',
          }),
        );
      });
    });

    it('incluye el clientType seleccionado (ALMACEN) en el payload', async () => {
      renderPage();
      const apiKeyInput = await screen.findByLabelText(/api-key de eva/i);
      const select = screen.getByLabelText(/tipo de cuenta eva/i);
      const user = userEvent.setup();
      await user.type(apiKeyInput, 'nueva-api-key');
      await user.selectOptions(select, 'ALMACEN');

      await user.click(screen.getByRole('button', { name: /guardar y verificar conexión/i }));

      await waitFor(() => {
        expect(mockSaveCredentials).toHaveBeenCalledWith(
          'fake-token',
          expect.objectContaining({ clientType: 'ALMACEN' }),
        );
      });
    });

    it('incluye baseUrl recortado en el payload cuando se ingresa en el campo', async () => {
      renderPage();
      const apiKeyInput = await screen.findByLabelText(/api-key de eva/i);
      const urlInput = screen.getByLabelText(/url base de la api/i);
      const user = userEvent.setup();
      await user.type(apiKeyInput, 'nueva-api-key');
      await user.type(urlInput, 'https://api.evacourier.pe');
      await user.click(screen.getByRole('button', { name: /guardar y verificar conexión/i }));

      await waitFor(() => {
        expect(mockSaveCredentials).toHaveBeenCalledWith(
          'fake-token',
          expect.objectContaining({ baseUrl: 'https://api.evacourier.pe' }),
        );
      });
    });

    it('llama a testEvaConnection con el token y companyId tras guardar', async () => {
      renderPage();
      const apiKeyInput = await screen.findByLabelText(/api-key de eva/i);
      const user = userEvent.setup();
      await user.type(apiKeyInput, 'nueva-api-key');
      await user.click(screen.getByRole('button', { name: /guardar y verificar conexión/i }));

      await waitFor(() => {
        expect(mockTestConnection).toHaveBeenCalledWith('fake-token', 'company-1');
      });
    });

    it('tras guardar con éxito muestra "Cuenta conectada" e "Integración activa"', async () => {
      mockGetCredentials
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(MOCK_CREDENTIAL_ACTIVE);

      renderPage();
      const apiKeyInput = await screen.findByLabelText(/api-key de eva/i);
      const user = userEvent.setup();
      await user.type(apiKeyInput, 'nueva-api-key');
      await user.click(screen.getByRole('button', { name: /guardar y verificar conexión/i }));

      expect(await screen.findByText(/cuenta conectada/i)).toBeInTheDocument();
      expect(await screen.findByText(/integración activa/i)).toBeInTheDocument();
    });

    it('tras guardar muestra "Conexión verificada con EVA" cuando testEvaConnection resuelve OK', async () => {
      mockTestConnection.mockResolvedValue(MOCK_CREDENTIAL_ACTIVE);
      mockGetCredentials
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(MOCK_CREDENTIAL_ACTIVE);

      renderPage();
      const apiKeyInput = await screen.findByLabelText(/api-key de eva/i);
      const user = userEvent.setup();
      await user.type(apiKeyInput, 'nueva-api-key');
      await user.click(screen.getByRole('button', { name: /guardar y verificar conexión/i }));

      expect(await screen.findByText(/conexión verificada con eva/i)).toBeInTheDocument();
    });

    it('tras guardar muestra aviso de fallo cuando testEvaConnection rechaza (Api-Key inválida)', async () => {
      mockTestConnection.mockRejectedValue({ response: { status: 401 } });
      mockGetCredentials
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(MOCK_CREDENTIAL_INACTIVE);

      renderPage();
      const apiKeyInput = await screen.findByLabelText(/api-key de eva/i);
      const user = userEvent.setup();
      await user.type(apiKeyInput, 'nueva-api-key');
      await user.click(screen.getByRole('button', { name: /guardar y verificar conexión/i }));

      expect(
        await screen.findByText(/la conexión falló: revisá la api-key\. la integración queda inactiva\./i),
      ).toBeInTheDocument();
      expect(await screen.findByText(/integración inactiva/i)).toBeInTheDocument();
    });
  });

  // ── 6. Error de guardado ──────────────────────────────────────────────────

  describe('error al guardar', () => {
    it('muestra el mensaje de error del servidor cuando saveEvaCredentials rechaza', async () => {
      mockSaveCredentials.mockRejectedValue({
        response: { data: { message: 'Api-Key EVA no válida' } },
      });
      renderPage();
      const apiKeyInput = await screen.findByLabelText(/api-key de eva/i);
      const user = userEvent.setup();
      await user.type(apiKeyInput, 'api-key-mala');
      await user.click(screen.getByRole('button', { name: /guardar y verificar conexión/i }));

      expect(await screen.findByText('Api-Key EVA no válida')).toBeInTheDocument();
    });

    it('muestra mensaje genérico cuando el error no tiene response.data.message', async () => {
      mockSaveCredentials.mockRejectedValue(new Error('Network Error'));
      renderPage();
      const apiKeyInput = await screen.findByLabelText(/api-key de eva/i);
      const user = userEvent.setup();
      await user.type(apiKeyInput, 'api-key-mala');
      await user.click(screen.getByRole('button', { name: /guardar y verificar conexión/i }));

      expect(await screen.findByText('Network Error')).toBeInTheDocument();
    });

    it('no llama a testEvaConnection cuando saveEvaCredentials rechaza', async () => {
      mockSaveCredentials.mockRejectedValue(new Error('fail'));
      renderPage();
      const apiKeyInput = await screen.findByLabelText(/api-key de eva/i);
      const user = userEvent.setup();
      await user.type(apiKeyInput, 'api-key-mala');
      await user.click(screen.getByRole('button', { name: /guardar y verificar conexión/i }));

      await waitFor(() => {
        expect(mockSaveCredentials).toHaveBeenCalled();
      });
      expect(mockTestConnection).not.toHaveBeenCalled();
    });
  });

  // ── 7. Error de carga ─────────────────────────────────────────────────────

  describe('error al cargar credencial', () => {
    it('muestra mensaje de error cuando getEvaCredentials rechaza', async () => {
      mockGetCredentials.mockRejectedValue(new Error('Server error'));
      renderPage();
      expect(
        await screen.findByText(/no se pudo cargar la configuración de eva/i),
      ).toBeInTheDocument();
    });

    it('no muestra el formulario cuando hay error de carga', async () => {
      mockGetCredentials.mockRejectedValue(new Error('fail'));
      renderPage();
      await screen.findByText(/no se pudo cargar la configuración de eva/i);
      expect(
        screen.queryByRole('heading', { name: /credenciales eva/i }),
      ).not.toBeInTheDocument();
    });
  });

  // ── 8. "Actualizar credenciales" ──────────────────────────────────────────

  describe('botón "Actualizar credenciales"', () => {
    beforeEach(() => {
      mockGetCredentials.mockResolvedValue(MOCK_CREDENTIAL_ACTIVE);
    });

    it('al hacer click en "Actualizar credenciales →" vuelve a mostrar el formulario', async () => {
      renderPage();
      await screen.findByText(/cuenta conectada/i);

      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: /actualizar credenciales/i }));

      expect(
        await screen.findByRole('heading', { name: /credenciales eva/i }),
      ).toBeInTheDocument();
    });

    it('al reconfigurar no se muestra "Cuenta conectada"', async () => {
      renderPage();
      await screen.findByText(/cuenta conectada/i);

      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: /actualizar credenciales/i }));

      await screen.findByRole('heading', { name: /credenciales eva/i });
      expect(screen.queryByText(/cuenta conectada/i)).not.toBeInTheDocument();
    });
  });

  // ── 9. Sin companyId ──────────────────────────────────────────────────────

  describe('sin companyId en auth', () => {
    it('no renderiza nada cuando auth.company es null', () => {
      mockUseAuth.mockReturnValue({
        ...MOCK_AUTH,
        auth: { ...MOCK_AUTH.auth, company: null },
      } as unknown as ReturnType<typeof useAuth>);
      const { container } = renderPage();
      expect(container).toBeEmptyDOMElement();
    });

    it('no llama a getEvaCredentials cuando no hay companyId', () => {
      mockUseAuth.mockReturnValue({
        ...MOCK_AUTH,
        auth: { ...MOCK_AUTH.auth, company: null },
      } as unknown as ReturnType<typeof useAuth>);
      renderPage();
      expect(mockGetCredentials).not.toHaveBeenCalled();
    });
  });

  // ── 10. Header de la página ───────────────────────────────────────────────

  describe('header de la página', () => {
    it('muestra el título "Integración EVA Courier"', async () => {
      renderPage();
      expect(
        await screen.findByRole('heading', { name: /integración eva courier/i }),
      ).toBeInTheDocument();
    });

    it('muestra la descripción de la integración', async () => {
      renderPage();
      expect(
        await screen.findByText(/conectá tu cuenta de eva courier/i),
      ).toBeInTheDocument();
    });
  });
});
