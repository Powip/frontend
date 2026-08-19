/**
 * Tests: YavendioConfigPage (app/configuracion/integraciones/yavendio/page.tsx)
 *
 * Comportamiento verificado:
 * 1. Estado "no configurado" (config null, incluye el caso 404 mapeado a null
 *    por el service): muestra el formulario con Api-Key y selector de tienda
 *    destino (poblado vía GET ${NEXT_PUBLIC_API_COMPANY}/company/:companyId).
 * 2. Estado "configurado" (activa): badge "Integración activa", "Cuenta
 *    conectada", apiKey enmascarado, nombre de tienda resuelto y botón
 *    "Sincronizar catálogo de productos" visible.
 * 3. Estado "configurado" (inactiva): badge "Integración inactiva",
 *    "Credenciales guardadas", SIN botón de sincronizar catálogo.
 * 4. Guardar con conexión exitosa: 2 pasos (saveYavendioConfig +
 *    testYavendioConnection) → recarga config → queda activa.
 * 5. Guardar con conexión fallida: testYavendioConnection rechaza → config
 *    queda guardada pero inactiva, con aviso de fallo de conexión visible,
 *    sin romper el flujo.
 * 6. Sincronizar catálogo (éxito): muestra el resumen numérico
 *    creados/actualizados/omitidos/fallidos.
 * 7. Sincronizar catálogo con errores: muestra el detalle por item
 *    (productId/sku/message).
 * 8. Sincronizar catálogo que rechaza (error de red/5xx): muestra mensaje de
 *    error sin romper el resto de la página.
 * 9. Fallback del nombre de tienda cuando importStoreId no matchea ninguna
 *    tienda cargada: muestra el uuid crudo.
 * 10. Error de carga (no 404): mensaje de error genérico.
 * 11. Sin companyId en el auth: no renderiza nada.
 * 12. handleReconfigure limpia el estado de sync (syncResult/syncError):
 *     tras una sincronización exitosa, al clickear "Actualizar credenciales →"
 *     el resumen numérico ya no debe quedar visible.
 * 13. El refresh final de handleSave (GET post-guardado para reflejar
 *     isActive) vive en su propio try/catch: si ese GET falla pero el
 *     guardado y el test de conexión tuvieron éxito, NO debe aparecer
 *     "Error al guardar la configuración".
 *
 * 14. Botón "Elegir productos a sincronizar →": visible junto al botón
 *     "Sincronizar catálogo de productos" cuando `credential.isActive ===
 *     true` (FEAT-13 Fase 3b).
 * 15. Al hacer click en ese botón se abre `YavendioProductPickerModal`
 *     (mockeado, no se re-testea su lógica interna acá — eso vive en
 *     YavendioProductPickerModal.test.tsx); su `onComplete` actualiza el
 *     resumen visible en la página con el mismo criterio que
 *     `handleSyncCatalog` ya usa para el sync masivo.
 *
 * 16. Webhook de pedidos (FEAT-13 Fase 5, sección "Webhook de pedidos",
 *     visible solo con `credential.isActive === true`):
 *     - Sin webhook nuestro (lista vacía o solo con URLs ajenas, matcheo
 *       exclusivamente por `url === webhookUrl`) → botón "Registrar webhook
 *       de pedidos".
 *     - Registrar exitoso → `createYavendioWebhook` con
 *       `url`/`events: ['order.created','order.status_changed']`/
 *       `description` fijos, siempre recarga la lista al terminar (éxito o
 *       error, nunca asume el resultado de la creación).
 *     - Webhook nuestro activo → badge "Activo" + botón "Eliminar webhook"
 *       (con `window.confirm` antes de ejecutar).
 *     - Webhook nuestro inactivo → badge "Inactivo" + botón "Reactivar".
 *     - Reactivar/Eliminar exitosos → recargan la lista al terminar.
 *     - Error en list/create/patch/delete → mensaje de error dentro de la
 *       sección, sin romper el resto de la página (catálogo, config).
 *
 * Mocks aplicados:
 * - @/contexts/AuthContext → useAuth
 * - sonner → toast (success/error) — el componente llama `toast.success` al
 *   registrar/eliminar/reactivar el webhook.
 * - @/services/yavendioService → getYavendioConfig, saveYavendioConfig,
 *   testYavendioConnection, syncYavendioCatalog, listYavendioWebhooks,
 *   createYavendioWebhook, setYavendioWebhookActive, deleteYavendioWebhook
 *   (nunca llamadas HTTP reales) + `API_INTEGRATIONS` fijo (el componente lo
 *   reexporta desde este mismo service para armar la URL del webhook).
 * - axios → la page llama a `axios.get` directamente (inline, sin service
 *   dedicado) para poblar el selector de tiendas contra
 *   ${NEXT_PUBLIC_API_COMPANY}/company/:companyId.
 * - ../_components/YavendioProductPickerModal → mock simple con 2 botones
 *   ("mock-complete"/"mock-close") para poder disparar `onComplete`/
 *   `onClose` manualmente sin ejercitar el modal real (su comportamiento
 *   propio se cubre en su propio archivo de test).
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ── Mocks ──────────────────────────────────────────────────────────────────────

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

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: jest.fn(),
}));

jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('@/services/yavendioService', () => ({
  // El componente importa `API_INTEGRATIONS` directo del service (no hay env
  // var en el entorno de test) — se fija un valor predecible para poder
  // armar la URL esperada del webhook en las aserciones.
  API_INTEGRATIONS: 'http://localhost:3004',
  getYavendioConfig: jest.fn(),
  saveYavendioConfig: jest.fn(),
  testYavendioConnection: jest.fn(),
  syncYavendioCatalog: jest.fn(),
  listYavendioWebhooks: jest.fn(),
  createYavendioWebhook: jest.fn(),
  setYavendioWebhookActive: jest.fn(),
  deleteYavendioWebhook: jest.fn(),
}));

/**
 * Mock del modal de selección manual (Fase 3b) — solo se necesita poder
 * abrirlo/cerrarlo y disparar `onComplete` a mano; su lógica interna
 * (loop en serie, manejo de errores por producto) se testea aparte en
 * YavendioProductPickerModal.test.tsx.
 */
jest.mock('../_components/YavendioProductPickerModal', () => {
  const React = require('react');
  return {
    __esModule: true,
    default: ({
      open,
      onComplete,
      onClose,
    }: {
      open: boolean;
      onComplete: (summary: unknown) => void;
      onClose: () => void;
    }) => {
      if (!open) return null;
      return (
        <div data-testid="mock-picker-modal">
          <button
            type="button"
            onClick={() =>
              onComplete({
                companyId: 'company-1',
                totalProducts: 1,
                created: 1,
                updated: 0,
                skipped: 0,
                failed: 0,
                errors: [],
              })
            }
          >
            mock-complete
          </button>
          <button type="button" onClick={onClose}>
            mock-close
          </button>
        </div>
      );
    },
  };
});

// ── Imports bajo prueba ────────────────────────────────────────────────────────

import axios from 'axios';
import { useAuth } from '@/contexts/AuthContext';
import {
  getYavendioConfig,
  saveYavendioConfig,
  testYavendioConnection,
  syncYavendioCatalog,
  listYavendioWebhooks,
  createYavendioWebhook,
  setYavendioWebhookActive,
  deleteYavendioWebhook,
} from '@/services/yavendioService';
import type {
  YavendioSafeConfig,
  CatalogSyncSummary,
  YavendioWebhook,
} from '@/services/yavendioService';
import YavendioConfigPage from '../page';

// ── Casts ──────────────────────────────────────────────────────────────────────

const mockUseAuth = jest.mocked(useAuth);
const mockGetConfig = jest.mocked(getYavendioConfig);
const mockSaveConfig = jest.mocked(saveYavendioConfig);
const mockTestConnection = jest.mocked(testYavendioConnection);
const mockSyncCatalog = jest.mocked(syncYavendioCatalog);
const mockListWebhooks = jest.mocked(listYavendioWebhooks);
const mockCreateWebhook = jest.mocked(createYavendioWebhook);
const mockSetWebhookActive = jest.mocked(setYavendioWebhookActive);
const mockDeleteWebhook = jest.mocked(deleteYavendioWebhook);
const mockAxiosGet = axios.get as jest.Mock;

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

const MOCK_STORES = [
  { id: 'store-1', name: 'Tienda Principal' },
  { id: 'store-2', name: 'Tienda Secundaria' },
];

const MOCK_CONFIG_ACTIVE: YavendioSafeConfig = {
  id: 'yv-1',
  companyId: 'company-1',
  apiKey: '****abcd',
  importStoreId: 'store-1',
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const MOCK_CONFIG_INACTIVE: YavendioSafeConfig = {
  ...MOCK_CONFIG_ACTIVE,
  isActive: false,
};

const MOCK_SYNC_SUMMARY_OK: CatalogSyncSummary = {
  companyId: 'company-1',
  totalProducts: 10,
  created: 4,
  updated: 5,
  skipped: 1,
  failed: 0,
  errors: [],
};

const MOCK_SYNC_SUMMARY_WITH_ERRORS: CatalogSyncSummary = {
  companyId: 'company-1',
  totalProducts: 5,
  created: 2,
  updated: 1,
  skipped: 0,
  failed: 2,
  errors: [
    { productId: 'prod-1', sku: 'SKU-1', message: 'Precio inválido' },
    { productId: 'prod-2', message: 'Falta descripción' },
  ],
};

// URL que arma la página para el webhook RECEPTOR (singular "webhook"),
// distinta de la ruta de administración (plural) — ver comentario en page.tsx.
const WEBHOOK_URL = 'http://localhost:3004/yavendio/webhook/company-1';

const MOCK_WEBHOOK_ACTIVE: YavendioWebhook = {
  id: 'wh-1',
  url: WEBHOOK_URL,
  events: ['order.created', 'order.status_changed'],
  isActive: true,
  description: 'Powip — recepción de pedidos',
  createdAt: '2026-01-01T00:00:00.000Z',
};

const MOCK_WEBHOOK_INACTIVE: YavendioWebhook = {
  ...MOCK_WEBHOOK_ACTIVE,
  isActive: false,
};

/** Webhook creado a mano desde el dashboard de YaVendió — URL distinta a la nuestra. */
const MOCK_WEBHOOK_FOREIGN: YavendioWebhook = {
  id: 'wh-foreign',
  url: 'https://otra-app.example.com/webhooks/yavendio',
  events: ['order.created'],
  isActive: true,
  description: 'Configurado a mano',
  createdAt: '2026-01-01T00:00:00.000Z',
};

// ── Setup ──────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  mockUseAuth.mockReturnValue(MOCK_AUTH as unknown as ReturnType<typeof useAuth>);

  // Por defecto: sin configuración guardada
  mockGetConfig.mockResolvedValue(null);
  mockSaveConfig.mockResolvedValue(MOCK_CONFIG_ACTIVE);
  mockTestConnection.mockResolvedValue(MOCK_CONFIG_ACTIVE);
  mockSyncCatalog.mockResolvedValue(MOCK_SYNC_SUMMARY_OK);

  // Webhook de pedidos: por defecto sin ninguno registrado. Se dispara solo
  // cuando `credential.isActive === true` (mismo criterio que el catálogo),
  // pero se fija igual para no dejar la promesa sin mockear en los tests que
  // no son de esta sección.
  mockListWebhooks.mockResolvedValue([]);
  mockCreateWebhook.mockResolvedValue(MOCK_WEBHOOK_ACTIVE);
  mockSetWebhookActive.mockResolvedValue(MOCK_WEBHOOK_ACTIVE);
  mockDeleteWebhook.mockResolvedValue(undefined);

  // Selector de tiendas: axios.get inline de la page (sin service dedicado)
  mockAxiosGet.mockResolvedValue({ data: { stores: MOCK_STORES } });
});

// ── Helper ─────────────────────────────────────────────────────────────────────

function renderPage() {
  return render(<YavendioConfigPage />);
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('YavendioConfigPage', () => {
  // ── 1. Estado no configurado ─────────────────────────────────────────────

  describe('estado no configurado (config null)', () => {
    it('muestra el formulario de credenciales', async () => {
      renderPage();
      expect(
        await screen.findByRole('heading', { name: /credenciales yavendio/i }),
      ).toBeInTheDocument();
    });

    it('muestra el campo Api-Key de Yavendio', async () => {
      renderPage();
      expect(await screen.findByLabelText(/api-key de yavendio/i)).toBeInTheDocument();
    });

    it('muestra el selector de tienda destino, poblado desde GET /company/:companyId', async () => {
      renderPage();
      const select = await screen.findByLabelText(/tienda destino/i);
      expect(select).toBeInTheDocument();
      expect(await screen.findByRole('option', { name: 'Tienda Principal' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Tienda Secundaria' })).toBeInTheDocument();
    });

    it('llama a axios.get contra ${NEXT_PUBLIC_API_COMPANY}/company/:companyId', async () => {
      renderPage();
      await waitFor(() => {
        expect(mockAxiosGet).toHaveBeenCalledWith(
          expect.stringContaining('/company/company-1'),
        );
      });
    });

    it('el botón "Guardar y verificar conexión" está deshabilitado sin apiKey ni tienda', async () => {
      renderPage();
      const btn = await screen.findByRole('button', { name: /guardar y verificar conexión/i });
      expect(btn).toBeDisabled();
    });

    it('muestra el badge "No configurada"', async () => {
      renderPage();
      expect(await screen.findByText(/no configurada/i)).toBeInTheDocument();
    });

    it('NO muestra el botón de sincronizar catálogo', async () => {
      renderPage();
      await screen.findByRole('heading', { name: /credenciales yavendio/i });
      expect(
        screen.queryByRole('button', { name: /sincronizar catálogo de productos/i }),
      ).not.toBeInTheDocument();
    });
  });

  // ── 8. 404 mapeado a null por el service ─────────────────────────────────

  describe('config no encontrada (404 mapeado a null por el service)', () => {
    it('se trata como no configurado y no rompe la página', async () => {
      mockGetConfig.mockResolvedValue(null);
      renderPage();
      expect(
        await screen.findByRole('heading', { name: /credenciales yavendio/i }),
      ).toBeInTheDocument();
      expect(screen.queryByText(/no se pudo cargar/i)).not.toBeInTheDocument();
    });
  });

  // ── 2. Estado configurado — activa ────────────────────────────────────────

  describe('estado configurado (config activa)', () => {
    beforeEach(() => {
      mockGetConfig.mockResolvedValue(MOCK_CONFIG_ACTIVE);
    });

    it('muestra el badge "Integración activa" y "Cuenta conectada"', async () => {
      renderPage();
      expect(await screen.findByText(/integración activa/i)).toBeInTheDocument();
      expect(screen.getByText(/cuenta conectada/i)).toBeInTheDocument();
    });

    it('muestra el apiKey enmascarado', async () => {
      renderPage();
      expect(await screen.findByText('****abcd')).toBeInTheDocument();
    });

    it('muestra el nombre de la tienda asignada (resuelto contra la lista de tiendas)', async () => {
      renderPage();
      await screen.findByText(/cuenta conectada/i);
      expect(await screen.findByText('Tienda Principal')).toBeInTheDocument();
    });

    it('muestra el botón "Sincronizar catálogo de productos"', async () => {
      renderPage();
      expect(
        await screen.findByRole('button', { name: /sincronizar catálogo de productos/i }),
      ).toBeInTheDocument();
    });

    it('muestra el botón "Elegir productos a sincronizar →" junto al de sincronizar catálogo', async () => {
      renderPage();
      expect(
        await screen.findByRole('button', { name: /sincronizar catálogo de productos/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /elegir productos a sincronizar/i }),
      ).toBeInTheDocument();
    });

    it('no muestra el formulario de credenciales', async () => {
      renderPage();
      await screen.findByText(/cuenta conectada/i);
      expect(
        screen.queryByRole('heading', { name: /credenciales yavendio/i }),
      ).not.toBeInTheDocument();
    });

    it('si importStoreId no matchea ninguna tienda cargada, muestra el uuid crudo como fallback', async () => {
      mockGetConfig.mockResolvedValue({ ...MOCK_CONFIG_ACTIVE, importStoreId: 'store-desconocida' });
      renderPage();
      await screen.findByText(/cuenta conectada/i);
      expect(await screen.findByText('store-desconocida')).toBeInTheDocument();
    });
  });

  // ── 3. Estado configurado — inactiva ──────────────────────────────────────

  describe('estado configurado (config inactiva)', () => {
    beforeEach(() => {
      mockGetConfig.mockResolvedValue(MOCK_CONFIG_INACTIVE);
    });

    it('muestra el badge "Integración inactiva" y "Credenciales guardadas"', async () => {
      renderPage();
      expect(await screen.findByText(/integración inactiva/i)).toBeInTheDocument();
      expect(screen.getByText(/credenciales guardadas/i)).toBeInTheDocument();
      expect(screen.queryByText(/cuenta conectada/i)).not.toBeInTheDocument();
    });

    it('NO muestra el botón de sincronizar catálogo', async () => {
      renderPage();
      await screen.findByText(/credenciales guardadas/i);
      expect(
        screen.queryByRole('button', { name: /sincronizar catálogo de productos/i }),
      ).not.toBeInTheDocument();
    });

    it('NO muestra el botón "Elegir productos a sincronizar →"', async () => {
      renderPage();
      await screen.findByText(/credenciales guardadas/i);
      expect(
        screen.queryByRole('button', { name: /elegir productos a sincronizar/i }),
      ).not.toBeInTheDocument();
    });
  });

  // ── 4/5. Flujo de guardado ─────────────────────────────────────────────────

  describe('guardar configuración', () => {
    it('guarda con conexión exitosa: llama a saveYavendioConfig y testYavendioConnection, y pasa a estado configurado activo', async () => {
      mockGetConfig
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(MOCK_CONFIG_ACTIVE);
      mockSaveConfig.mockResolvedValue(MOCK_CONFIG_ACTIVE);
      mockTestConnection.mockResolvedValue(MOCK_CONFIG_ACTIVE);

      renderPage();
      const apiKeyInput = await screen.findByLabelText(/api-key de yavendio/i);
      const select = screen.getByLabelText(/tienda destino/i);
      await waitFor(() =>
        expect(screen.getByRole('option', { name: 'Tienda Principal' })).toBeInTheDocument(),
      );

      const user = userEvent.setup();
      await user.type(apiKeyInput, 'yv-api-key-123');
      await user.selectOptions(select, 'store-1');
      await user.click(screen.getByRole('button', { name: /guardar y verificar conexión/i }));

      await waitFor(() => {
        expect(mockSaveConfig).toHaveBeenCalledWith('fake-token', {
          companyId: 'company-1',
          apiKey: 'yv-api-key-123',
          importStoreId: 'store-1',
        });
      });
      await waitFor(() => {
        expect(mockTestConnection).toHaveBeenCalledWith('fake-token', 'company-1');
      });

      expect(await screen.findByText(/cuenta conectada/i)).toBeInTheDocument();
      expect(await screen.findByText(/integración activa/i)).toBeInTheDocument();
      expect(screen.getByText(/conexión verificada con yavendio/i)).toBeInTheDocument();
    });

    it('guarda con conexión fallida: la config queda guardada pero inactiva, con mensaje de error de conexión visible', async () => {
      mockGetConfig
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(MOCK_CONFIG_INACTIVE);
      mockSaveConfig.mockResolvedValue(MOCK_CONFIG_INACTIVE);
      mockTestConnection.mockRejectedValue({ response: { status: 401 } });

      renderPage();
      const apiKeyInput = await screen.findByLabelText(/api-key de yavendio/i);
      const select = screen.getByLabelText(/tienda destino/i);
      await waitFor(() =>
        expect(screen.getByRole('option', { name: 'Tienda Principal' })).toBeInTheDocument(),
      );

      const user = userEvent.setup();
      await user.type(apiKeyInput, 'yv-api-key-mala');
      await user.selectOptions(select, 'store-1');
      await user.click(screen.getByRole('button', { name: /guardar y verificar conexión/i }));

      expect(
        await screen.findByText(
          /la conexión falló: revisá la api-key\. la integración queda inactiva\./i,
        ),
      ).toBeInTheDocument();
      expect(await screen.findByText(/integración inactiva/i)).toBeInTheDocument();
      expect(screen.getByText(/credenciales guardadas/i)).toBeInTheDocument();
    });

    it('muestra el mensaje de error del servidor cuando saveYavendioConfig rechaza', async () => {
      mockSaveConfig.mockRejectedValue({
        response: { data: { message: 'Api-Key Yavendio no válida' } },
      });
      renderPage();
      const apiKeyInput = await screen.findByLabelText(/api-key de yavendio/i);
      const select = screen.getByLabelText(/tienda destino/i);
      await waitFor(() =>
        expect(screen.getByRole('option', { name: 'Tienda Principal' })).toBeInTheDocument(),
      );
      const user = userEvent.setup();
      await user.type(apiKeyInput, 'api-key-mala');
      await user.selectOptions(select, 'store-1');
      await user.click(screen.getByRole('button', { name: /guardar y verificar conexión/i }));

      expect(await screen.findByText('Api-Key Yavendio no válida')).toBeInTheDocument();
      expect(mockTestConnection).not.toHaveBeenCalled();
    });

    it('si el refresh final de la config falla tras guardar y testear con éxito, NO muestra un error de guardado falso', async () => {
      mockGetConfig
        .mockResolvedValueOnce(null)
        .mockRejectedValueOnce(new Error('fail al refrescar'));
      mockSaveConfig.mockResolvedValue(MOCK_CONFIG_ACTIVE);
      mockTestConnection.mockResolvedValue(MOCK_CONFIG_ACTIVE);

      renderPage();
      const apiKeyInput = await screen.findByLabelText(/api-key de yavendio/i);
      const select = screen.getByLabelText(/tienda destino/i);
      await waitFor(() =>
        expect(screen.getByRole('option', { name: 'Tienda Principal' })).toBeInTheDocument(),
      );

      const user = userEvent.setup();
      await user.type(apiKeyInput, 'yv-api-key-123');
      await user.selectOptions(select, 'store-1');
      await user.click(screen.getByRole('button', { name: /guardar y verificar conexión/i }));

      await waitFor(() => {
        expect(mockTestConnection).toHaveBeenCalledWith('fake-token', 'company-1');
      });
      await waitFor(() => {
        expect(mockGetConfig).toHaveBeenCalledTimes(2);
      });

      expect(screen.queryByText(/error al guardar la configuración/i)).not.toBeInTheDocument();
    });
  });

  // ── 6/7/8. Sincronización de catálogo ─────────────────────────────────────

  describe('sincronización de catálogo', () => {
    beforeEach(() => {
      mockGetConfig.mockResolvedValue(MOCK_CONFIG_ACTIVE);
    });

    it('sync exitoso muestra el resumen numérico (creados/actualizados/omitidos/fallidos)', async () => {
      mockSyncCatalog.mockResolvedValue(MOCK_SYNC_SUMMARY_OK);
      renderPage();
      const syncBtn = await screen.findByRole('button', {
        name: /sincronizar catálogo de productos/i,
      });
      const user = userEvent.setup();
      await user.click(syncBtn);

      await waitFor(() => {
        expect(mockSyncCatalog).toHaveBeenCalledWith('fake-token', 'company-1');
      });

      const createdLabel = await screen.findByText(/^creados$/i);
      expect(createdLabel.previousElementSibling).toHaveTextContent('4');
      const updatedLabel = screen.getByText(/^actualizados$/i);
      expect(updatedLabel.previousElementSibling).toHaveTextContent('5');
      const skippedLabel = screen.getByText(/^omitidos$/i);
      expect(skippedLabel.previousElementSibling).toHaveTextContent('1');
      const failedLabel = screen.getByText(/^fallidos$/i);
      expect(failedLabel.previousElementSibling).toHaveTextContent('0');
    });

    it('sync con errors.length > 0 muestra el detalle de cada error (productId/sku/message)', async () => {
      mockSyncCatalog.mockResolvedValue(MOCK_SYNC_SUMMARY_WITH_ERRORS);
      const { container } = renderPage();
      const syncBtn = await screen.findByRole('button', {
        name: /sincronizar catálogo de productos/i,
      });
      const user = userEvent.setup();
      await user.click(syncBtn);

      await waitFor(() => expect(container.textContent).toContain('Precio inválido'));

      expect(container.textContent).toContain('prod-1');
      expect(container.textContent).toContain('SKU-1');
      expect(container.textContent).toContain('prod-2');
      expect(container.textContent).toContain('Falta descripción');
    });

    it('sync que rechaza (error de red) muestra mensaje de error sin romper la página', async () => {
      mockSyncCatalog.mockRejectedValue(new Error('Network Error'));
      renderPage();
      const syncBtn = await screen.findByRole('button', {
        name: /sincronizar catálogo de productos/i,
      });
      const user = userEvent.setup();
      await user.click(syncBtn);

      expect(await screen.findByText('Network Error')).toBeInTheDocument();
      // La página sigue funcional: el botón de sync sigue presente
      expect(
        screen.getByRole('button', { name: /sincronizar catálogo de productos/i }),
      ).toBeInTheDocument();
    });

    it('al hacer click en "Actualizar credenciales →" después de una sincronización, limpia el resumen numérico', async () => {
      mockSyncCatalog.mockResolvedValue(MOCK_SYNC_SUMMARY_OK);
      renderPage();
      const syncBtn = await screen.findByRole('button', {
        name: /sincronizar catálogo de productos/i,
      });
      const user = userEvent.setup();
      await user.click(syncBtn);

      const createdLabel = await screen.findByText(/^creados$/i);
      expect(createdLabel.previousElementSibling).toHaveTextContent('4');

      await user.click(screen.getByRole('button', { name: /actualizar credenciales/i }));

      expect(screen.queryByText(/^creados$/i)).not.toBeInTheDocument();
    });
  });

  // ── 14/15. Picker de selección manual de productos (Fase 3b) ──────────────

  describe('picker de selección manual de productos', () => {
    beforeEach(() => {
      mockGetConfig.mockResolvedValue(MOCK_CONFIG_ACTIVE);
    });

    it('el modal no está montado en el DOM hasta que se hace click en "Elegir productos a sincronizar →"', async () => {
      renderPage();
      await screen.findByRole('button', { name: /elegir productos a sincronizar/i });
      expect(screen.queryByTestId('mock-picker-modal')).not.toBeInTheDocument();
    });

    it('al hacer click en "Elegir productos a sincronizar →" se abre el modal', async () => {
      renderPage();
      const openBtn = await screen.findByRole('button', {
        name: /elegir productos a sincronizar/i,
      });
      const user = userEvent.setup();
      await user.click(openBtn);

      expect(await screen.findByTestId('mock-picker-modal')).toBeInTheDocument();
    });

    it('el onComplete del modal actualiza el resumen visible en la página, igual que el sync masivo', async () => {
      renderPage();
      const openBtn = await screen.findByRole('button', {
        name: /elegir productos a sincronizar/i,
      });
      const user = userEvent.setup();
      await user.click(openBtn);

      await screen.findByTestId('mock-picker-modal');
      await user.click(screen.getByText('mock-complete'));

      const createdLabel = await screen.findByText(/^creados$/i);
      expect(createdLabel.previousElementSibling).toHaveTextContent('1');
      const updatedLabel = screen.getByText(/^actualizados$/i);
      expect(updatedLabel.previousElementSibling).toHaveTextContent('0');
    });
  });

  // ── Webhook de pedidos (Fase 5) ────────────────────────────────────────────

  describe('webhook de pedidos', () => {
    beforeEach(() => {
      mockGetConfig.mockResolvedValue(MOCK_CONFIG_ACTIVE);
    });

    it('sin webhook nuestro registrado (lista vacía) muestra el botón "Registrar webhook de pedidos"', async () => {
      mockListWebhooks.mockResolvedValue([]);
      renderPage();

      expect(
        await screen.findByRole('button', { name: /registrar webhook de pedidos/i }),
      ).toBeInTheDocument();
    });

    it('con webhooks de otras URLs en la lista, se sigue tratando como "sin webhook nuestro" (no confunde uno ajeno con el propio)', async () => {
      mockListWebhooks.mockResolvedValue([MOCK_WEBHOOK_FOREIGN]);
      renderPage();

      expect(
        await screen.findByRole('button', { name: /registrar webhook de pedidos/i }),
      ).toBeInTheDocument();
      expect(screen.queryByText(/^activo$/i)).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: /eliminar webhook/i }),
      ).not.toBeInTheDocument();
    });

    it('registrar exitoso llama a createYavendioWebhook con url/events/description correctos, recarga la lista y refleja el estado activo', async () => {
      mockListWebhooks
        .mockResolvedValueOnce([]) // carga inicial al montar
        .mockResolvedValueOnce([MOCK_WEBHOOK_ACTIVE]); // recarga post-registro
      mockCreateWebhook.mockResolvedValue(MOCK_WEBHOOK_ACTIVE);

      renderPage();
      const registerBtn = await screen.findByRole('button', {
        name: /registrar webhook de pedidos/i,
      });
      const user = userEvent.setup();
      await user.click(registerBtn);

      await waitFor(() => {
        expect(mockCreateWebhook).toHaveBeenCalledWith('fake-token', 'company-1', {
          url: WEBHOOK_URL,
          events: ['order.created', 'order.status_changed'],
          description: 'Powip — recepción de pedidos',
        });
      });
      await waitFor(() => expect(mockListWebhooks).toHaveBeenCalledTimes(2));

      expect(await screen.findByText(/^activo$/i)).toBeInTheDocument();
    });

    it('webhook nuestro con isActive true muestra el badge "Activo" y el botón "Eliminar webhook"', async () => {
      mockListWebhooks.mockResolvedValue([MOCK_WEBHOOK_ACTIVE]);
      renderPage();

      expect(await screen.findByText(/^activo$/i)).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /eliminar webhook/i }),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: /^reactivar$/i }),
      ).not.toBeInTheDocument();
    });

    it('webhook nuestro con isActive false muestra el badge de alerta "Inactivo" y el botón "Reactivar"', async () => {
      mockListWebhooks.mockResolvedValue([MOCK_WEBHOOK_INACTIVE]);
      renderPage();

      expect(await screen.findByText(/^inactivo$/i)).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /^reactivar$/i }),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: /eliminar webhook/i }),
      ).not.toBeInTheDocument();
    });

    it('reactivar exitoso llama a setYavendioWebhookActive(token, companyId, webhookId, true), recarga y refleja isActive true', async () => {
      mockListWebhooks
        .mockResolvedValueOnce([MOCK_WEBHOOK_INACTIVE]) // carga inicial
        .mockResolvedValueOnce([MOCK_WEBHOOK_ACTIVE]); // recarga post-reactivación
      mockSetWebhookActive.mockResolvedValue(MOCK_WEBHOOK_ACTIVE);

      renderPage();
      const reactivateBtn = await screen.findByRole('button', { name: /^reactivar$/i });
      const user = userEvent.setup();
      await user.click(reactivateBtn);

      await waitFor(() => {
        expect(mockSetWebhookActive).toHaveBeenCalledWith(
          'fake-token',
          'company-1',
          'wh-1',
          true,
        );
      });
      await waitFor(() => expect(mockListWebhooks).toHaveBeenCalledTimes(2));

      expect(await screen.findByText(/^activo$/i)).toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: /^reactivar$/i }),
      ).not.toBeInTheDocument();
    });

    it('eliminar exitoso confirma con window.confirm, llama a deleteYavendioWebhook con el id correcto, recarga y vuelve al estado "sin webhook"', async () => {
      jest.spyOn(window, 'confirm').mockReturnValue(true);
      mockListWebhooks
        .mockResolvedValueOnce([MOCK_WEBHOOK_ACTIVE]) // carga inicial
        .mockResolvedValueOnce([]); // recarga post-eliminación
      mockDeleteWebhook.mockResolvedValue(undefined);

      renderPage();
      const deleteBtn = await screen.findByRole('button', { name: /eliminar webhook/i });
      const user = userEvent.setup();
      await user.click(deleteBtn);

      expect(window.confirm).toHaveBeenCalled();
      await waitFor(() => {
        expect(mockDeleteWebhook).toHaveBeenCalledWith('fake-token', 'company-1', 'wh-1');
      });
      await waitFor(() => expect(mockListWebhooks).toHaveBeenCalledTimes(2));

      expect(
        await screen.findByRole('button', { name: /registrar webhook de pedidos/i }),
      ).toBeInTheDocument();
    });

    it('no elimina el webhook si el usuario cancela la confirmación de window.confirm', async () => {
      jest.spyOn(window, 'confirm').mockReturnValue(false);
      mockListWebhooks.mockResolvedValue([MOCK_WEBHOOK_ACTIVE]);

      renderPage();
      const deleteBtn = await screen.findByRole('button', { name: /eliminar webhook/i });
      const user = userEvent.setup();
      await user.click(deleteBtn);

      expect(window.confirm).toHaveBeenCalled();
      expect(mockDeleteWebhook).not.toHaveBeenCalled();
      expect(screen.getByText(/^activo$/i)).toBeInTheDocument();
    });

    it('error al listar los webhooks muestra un mensaje de error en la sección sin romper el resto de la página', async () => {
      // `extractErrorMessage` prioriza `err.message` sobre el fallback fijo —
      // con un `Error` real, el texto mostrado es el del error, no el
      // fallback ("No se pudo cargar el estado del webhook de pedidos.").
      mockListWebhooks.mockRejectedValue(new Error('Network Error'));
      renderPage();

      expect(await screen.findByText('Network Error')).toBeInTheDocument();
      // El resto de la página (catálogo, config) sigue funcional
      expect(
        screen.getByRole('button', { name: /sincronizar catálogo de productos/i }),
      ).toBeInTheDocument();
      expect(screen.getByText(/cuenta conectada/i)).toBeInTheDocument();
    });

    it('error al listar los webhooks usa el mensaje fijo cuando el error no trae `message` propio', async () => {
      // Objeto plano sin `.message` ni `.response.data.message` → cae al
      // fallback explícito que arma la página.
      mockListWebhooks.mockRejectedValue({});
      renderPage();

      expect(
        await screen.findByText(/no se pudo cargar el estado del webhook de pedidos/i),
      ).toBeInTheDocument();
    });

    it('error al registrar el webhook muestra un mensaje de error sin romper el resto de la página', async () => {
      mockListWebhooks.mockResolvedValue([]);
      mockCreateWebhook.mockRejectedValue({
        response: { data: { message: 'YaVendió rechazó el registro del webhook' } },
      });

      renderPage();
      const registerBtn = await screen.findByRole('button', {
        name: /registrar webhook de pedidos/i,
      });
      const user = userEvent.setup();
      await user.click(registerBtn);

      expect(
        await screen.findByText('YaVendió rechazó el registro del webhook'),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /sincronizar catálogo de productos/i }),
      ).toBeInTheDocument();
    });

    it('error al reactivar el webhook muestra un mensaje de error sin romper el resto de la página', async () => {
      mockListWebhooks.mockResolvedValue([MOCK_WEBHOOK_INACTIVE]);
      mockSetWebhookActive.mockRejectedValue(new Error('fail al reactivar'));

      renderPage();
      const reactivateBtn = await screen.findByRole('button', { name: /^reactivar$/i });
      const user = userEvent.setup();
      await user.click(reactivateBtn);

      expect(await screen.findByText('fail al reactivar')).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /sincronizar catálogo de productos/i }),
      ).toBeInTheDocument();
    });

    it('error al eliminar el webhook muestra un mensaje de error sin romper el resto de la página', async () => {
      jest.spyOn(window, 'confirm').mockReturnValue(true);
      mockListWebhooks.mockResolvedValue([MOCK_WEBHOOK_ACTIVE]);
      mockDeleteWebhook.mockRejectedValue(new Error('fail al eliminar'));

      renderPage();
      const deleteBtn = await screen.findByRole('button', { name: /eliminar webhook/i });
      const user = userEvent.setup();
      await user.click(deleteBtn);

      expect(await screen.findByText('fail al eliminar')).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /sincronizar catálogo de productos/i }),
      ).toBeInTheDocument();
    });
  });

  // ── Error de carga ─────────────────────────────────────────────────────────

  describe('error al cargar la configuración', () => {
    it('muestra un mensaje de error genérico cuando el service rechaza (no 404)', async () => {
      mockGetConfig.mockRejectedValue(new Error('fail'));
      renderPage();
      expect(
        await screen.findByText(/no se pudo cargar la configuración de yavendio/i),
      ).toBeInTheDocument();
    });
  });

  // ── Sin companyId ────────────────────────────────────────────────────────

  describe('sin companyId en auth', () => {
    it('no renderiza nada cuando auth.company es null', () => {
      mockUseAuth.mockReturnValue({
        ...MOCK_AUTH,
        auth: { ...MOCK_AUTH.auth, company: null },
      } as unknown as ReturnType<typeof useAuth>);
      const { container } = renderPage();
      expect(container).toBeEmptyDOMElement();
    });

    it('no llama a getYavendioConfig cuando no hay companyId', () => {
      mockUseAuth.mockReturnValue({
        ...MOCK_AUTH,
        auth: { ...MOCK_AUTH.auth, company: null },
      } as unknown as ReturnType<typeof useAuth>);
      renderPage();
      expect(mockGetConfig).not.toHaveBeenCalled();
    });
  });

  // ── Header de la página ──────────────────────────────────────────────────

  describe('header de la página', () => {
    it('muestra el título "Integración Yavendio"', async () => {
      renderPage();
      expect(
        await screen.findByRole('heading', { name: /integración yavendio/i }),
      ).toBeInTheDocument();
    });

    it('muestra la descripción de la integración', async () => {
      renderPage();
      expect(await screen.findByText(/conectá tu cuenta de yavendio/i)).toBeInTheDocument();
    });
  });
});
