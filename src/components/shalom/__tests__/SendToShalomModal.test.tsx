/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Tests: SendToShalomModal
 *
 * Comportamiento verificado:
 * 1. El dropdown de "Declaración jurada" se renderiza con el sentinel "__ninguna__"
 *    (label "Ninguna") como valor seleccionado por default.
 * 2. Las opciones del dropdown corresponden exactamente al enum del OpenAPI de Shalom:
 *    "__ninguna__" (Ninguna), "Artículos de uso personal", "Documentos", "Ropa",
 *    "Electrodomésticos". NO existen "Calzado", "Mercadería general" ni otros.
 * 3. Cada orden muestra el selector de modalidad (Terrestre activo por default).
 * 4. Al confirmar el envío con el default, axios.post recibe `declaracionJurada: ""`
 *    (el sentinel se mapea a vacío antes de enviar). Al seleccionar "Documentos",
 *    el payload lleva `declaracionJurada: "Documentos"`.
 * 5. Si la respuesta trae `shalomChangedToAereo: true`, se muestra el aviso de
 *    discrepancia en pantalla y se llama toast.warning con el texto correspondiente.
 *
 * Work-arounds jsdom aplicados:
 * - @/components/ui/select → mock de <select> nativo para evitar problemas de
 *   ResizeObserver / pointer-events de Radix UI en jsdom.
 * - @/components/ui/dialog → mock que renderiza children directamente cuando open=true.
 * - window.open → mock para evitar errores del flujo de impresión.
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ── Mocks de infraestructura ──────────────────────────────────────────────────

jest.mock('axios', () => ({
  default: {
    get: jest.fn(),
    post: jest.fn(),
    defaults: { withCredentials: false },
  },
  get: jest.fn(),
  post: jest.fn(),
  defaults: { withCredentials: false },
}));

jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
    warning: jest.fn(),
  },
}));

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: jest.fn(),
}));

jest.mock('@/services/userService', () => ({
  getUserProfile: jest.fn(),
}));

// Mock de @/lib/api para que las URLs sean strings predecibles
jest.mock('@/lib/api', () => ({
  API: {
    integrations: 'http://integrations',
    courier: 'http://courier',
    productos: 'http://productos',
    companies: 'http://companies',
    ventas: 'http://ventas',
    clientes: 'http://clientes',
    inventory: 'http://inventory',
  },
}));

/**
 * Mock de Radix Select → <select> nativo.
 * Permite testear el valor inicial y los cambios con userEvent.selectOptions.
 */
jest.mock('@/components/ui/select', () => {
  const React = require('react');

  const Select = ({
    value,
    onValueChange,
    children,
  }: {
    value?: string;
    onValueChange?: (v: string) => void;
    children?: React.ReactNode;
  }) => {
    // Recoge los items hijos para renderizar <option>s
    const options: { value: string; label: string }[] = [];
    React.Children.forEach(children, (child: React.ReactElement<{ children?: React.ReactNode }>) => {
      if (!child || !child.props) return;
      // SelectContent wraps SelectItems
      if (child.props.children) {
        React.Children.forEach(child.props.children, (item: React.ReactElement<{ value?: string; children?: React.ReactNode }>) => {
          if (item && item.props && item.props.value !== undefined) {
            options.push({ value: item.props.value, label: item.props.children as string });
          }
        });
      }
    });
    return (
      <select
        value={value}
        onChange={(e) => onValueChange?.(e.target.value)}
        data-testid="select-mock"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    );
  };

  const SelectContent = ({ children }: { children?: React.ReactNode }) => <>{children}</>;
  const SelectItem = ({
    value,
    children,
  }: {
    value: string;
    children?: React.ReactNode;
  }) => <option value={value}>{children}</option>;
  const SelectTrigger = ({ children }: { children?: React.ReactNode }) => <>{children}</>;
  const SelectValue = ({ placeholder }: { placeholder?: string }) => (
    <span>{placeholder}</span>
  );

  return { Select, SelectContent, SelectItem, SelectTrigger, SelectValue };
});

/**
 * Mock de Radix Dialog → div simple.
 * Renderiza children directamente cuando open=true, ignorando portales/animaciones.
 */
jest.mock('@/components/ui/dialog', () => {
  const React = require('react');
  const Dialog = ({
    open,
    children,
  }: {
    open?: boolean;
    children?: React.ReactNode;
  }) => (open ? <div data-testid="dialog">{children}</div> : null);

  const DialogContent = ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="dialog-content">{children}</div>
  );
  const DialogHeader = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  const DialogTitle = ({ children }: { children?: React.ReactNode }) => <h2>{children}</h2>;

  return { Dialog, DialogContent, DialogHeader, DialogTitle };
});

// Mock mínimo de lucide-react para no compilar SVGs en tests
jest.mock('lucide-react', () => ({
  Loader2: () => null,
  Truck: () => null,
  AlertCircle: () => null,
  Package: () => null,
  CheckCircle2: () => null,
  Plus: () => null,
  Printer: () => null,
}));

// ── Imports bajo prueba (después de los mocks) ────────────────────────────────

import axios from 'axios';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { getUserProfile } from '@/services/userService';
import SendToShalomModal from '../SendToShalomModal';

// ── Casts ─────────────────────────────────────────────────────────────────────

const mockAxiosPost = jest.mocked(axios.post);
const mockUseAuth = jest.mocked(useAuth);
const mockGetUserProfile = jest.mocked(getUserProfile);
const mockToast = toast as jest.Mocked<typeof toast>;

// ── Fixtures ──────────────────────────────────────────────────────────────────

const MOCK_AUTH = {
  auth: {
    user: { id: 'user-1' },
    company: { id: 'company-1', name: 'Powip Test', stores: [] },
    accessToken: 'fake-token',
  },
};

const MOCK_ORDER = {
  id: 'order-abc',
  orderNumber: 'ORD-001',
  customer: {
    fullName: 'Juan Pérez',
    dni: '12345678',
    phoneNumber: '987654321',
    address: 'Av. Test 123',
    district: 'Miraflores',
    city: 'Lima',
    province: 'Lima',
  },
};

/** Props mínimas para abrir el modal con una sola orden */
const BASE_PROPS = {
  open: true,
  onClose: jest.fn(),
  orders: [MOCK_ORDER],
  onSuccess: jest.fn(),
  guideId: 'guide-1',
  companyId: 'company-1',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function renderModal(propOverrides: Partial<typeof BASE_PROPS> = {}) {
  return render(<SendToShalomModal {...BASE_PROPS} {...propOverrides} />);
}

/**
 * Agencia de prueba que retorna axios.get.
 * lugar_over se mapea a api_name en fetchAgencies, así que el <select>
 * tendrá <option value="LIMA">.
 */
const MOCK_AGENCY = {
  ter_id: 'ag-1',
  nombre: 'Agencia Lima',
  lugar_over: 'LIMA',
  lugar: 'Av. Lima 123',
  ter_aereo: 1,
};

/**
 * Completa todos los campos obligatorios para que allDestinationsSet=true
 * y el botón "Confirmar y enviar a Shalom" quede habilitado.
 *
 * Flujo:
 * 1. axios.get devuelve MOCK_AGENCY para cualquier búsqueda.
 * 2. El useEffect dispara fetchAgencies para origen (distrito del perfil)
 *    y para destino (distrito del cliente de la orden).
 * 3. Esperamos a que las opciones 'LIMA' aparezcan en los <select>.
 * 4. Seleccionamos origen y destino.
 * 5. El código de seguridad global '1357' es válido y se propaga a cada orden.
 * 6. recipientDoc='12345678' (8 dígitos) y recipientPhone='987654321' (9 dígitos)
 *    ya están prellenados por los fixtures del MOCK_ORDER.
 * 7. Esperamos a que el botón se habilite.
 */
async function setupValidForm() {
  (axios.get as jest.Mock).mockResolvedValue({
    data: { success: true, data: [MOCK_AGENCY] },
  });

  const user = userEvent.setup();
  renderModal();

  // Esperar a que las opciones 'LIMA' aparezcan en al menos un <select> (origen)
  await waitFor(() => {
    const selects = screen.getAllByRole('combobox') as HTMLSelectElement[];
    const withLima = selects.filter((s) =>
      Array.from(s.options).some((o) => o.value === 'LIMA'),
    );
    expect(withLima.length).toBeGreaterThan(0);
  });

  // Identificar el select de origen (primer select con opción LIMA)
  const allSelects = screen.getAllByRole('combobox') as HTMLSelectElement[];
  const originSelect = allSelects.find((s) =>
    Array.from(s.options).some((o) => o.value === 'LIMA'),
  )!;

  await user.selectOptions(originSelect, 'LIMA');

  // Ingresar código de seguridad global válido
  // Hay dos inputs con placeholder "Ej: 1357": el global y el por-orden.
  // El global es el primero en el DOM (aparece antes de la tarjeta de orden).
  const securityInputs = screen.getAllByPlaceholderText('Ej: 1357') as HTMLInputElement[];
  const globalSecurityInput = securityInputs[0];
  await user.clear(globalSecurityInput);
  await user.type(globalSecurityInput, '1357');

  // Esperar a que aparezca el select de destino con opción LIMA
  await waitFor(() => {
    const selectsNow = screen.getAllByRole('combobox') as HTMLSelectElement[];
    const destOptions = selectsNow.filter(
      (s) =>
        s !== originSelect &&
        Array.from(s.options).some((o) => o.value === 'LIMA'),
    );
    expect(destOptions.length).toBeGreaterThan(0);
  });

  const allSelectsNow = screen.getAllByRole('combobox') as HTMLSelectElement[];
  const destSelect = allSelectsNow.find(
    (s) =>
      s !== originSelect &&
      Array.from(s.options).some((o) => o.value === 'LIMA'),
  )!;

  await user.selectOptions(destSelect!, 'LIMA');

  // Esperar a que el botón se habilite (allDestinationsSet = true)
  const sendBtn = screen.getByRole('button', { name: /confirmar y enviar a shalom/i });
  await waitFor(() => {
    expect(sendBtn).not.toBeDisabled();
  });

  return { user, originSelect, destSelect };
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  mockUseAuth.mockReturnValue(MOCK_AUTH as unknown as ReturnType<typeof useAuth>);
  mockGetUserProfile.mockResolvedValue({
    id: 'user-1',
    name: 'Juan',
    surname: 'Test',
    email: 'juan@test.com',
    district: 'Miraflores',
    status: true,
  });
  // axios.get: respuesta vacía por defecto para búsquedas de agencias
  (axios.get as jest.Mock).mockResolvedValue({
    data: { success: true, data: [] },
  });
  // window.open: mock para el flujo de impresión
  Object.defineProperty(window, 'open', {
    value: jest.fn().mockReturnValue({
      document: { write: jest.fn(), close: jest.fn() },
      focus: jest.fn(),
      print: jest.fn(),
    }),
    writable: true,
  });
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('SendToShalomModal', () => {
  // ── 1. Render inicial ───────────────────────────────────────────────────────

  describe('render inicial', () => {
    it('muestra el título "Enviar a Shalom Pro"', () => {
      renderModal();
      expect(screen.getByText('Enviar a Shalom Pro')).toBeInTheDocument();
    });

    it('muestra el label "Declaración jurada"', () => {
      renderModal();
      expect(screen.getByText(/declaración jurada/i)).toBeInTheDocument();
    });

    it('el dropdown de declaración jurada tiene el sentinel "__ninguna__" (Ninguna) como valor seleccionado por default', () => {
      renderModal();
      // El <select> mockeado tiene value=estado; buscamos el <select> que tenga la opción __ninguna__
      const selects = screen.getAllByRole('combobox') as HTMLSelectElement[];
      const djSelect = selects.find((s) =>
        Array.from(s.options).some((o) => o.value === '__ninguna__'),
      );
      expect(djSelect).toBeDefined();
      expect(djSelect!.value).toBe('__ninguna__');
    });

    it('renderiza exactamente las opciones del enum de Shalom y no las opciones antiguas', () => {
      renderModal();
      const options = screen.getAllByRole('option');
      const optionValues = options.map((o) => (o as HTMLOptionElement).value);
      // Opciones nuevas que deben estar presentes
      expect(optionValues).toContain('__ninguna__');
      expect(optionValues).toContain('Artículos de uso personal');
      expect(optionValues).toContain('Documentos');
      expect(optionValues).toContain('Ropa');
      expect(optionValues).toContain('Electrodomésticos');
      // Opciones antiguas que NO deben existir
      expect(optionValues).not.toContain('Calzado');
      expect(optionValues).not.toContain('Mercadería general');
    });

    it('no muestra el mensaje "No hay pedidos seleccionados" cuando hay órdenes', () => {
      renderModal();
      expect(
        screen.queryByText('No hay pedidos seleccionados'),
      ).not.toBeInTheDocument();
    });

    it('muestra el mensaje vacío cuando orders=[]', () => {
      renderModal({ orders: [] });
      expect(screen.getByText('No hay pedidos seleccionados')).toBeInTheDocument();
    });
  });

  // ── 2. Selector de modalidad por orden ─────────────────────────────────────

  describe('selector de modalidad de envío', () => {
    it('muestra el botón "Terrestre" por cada orden', () => {
      renderModal();
      expect(screen.getByRole('button', { name: /terrestre/i })).toBeInTheDocument();
    });

    it('muestra el botón "Aéreo" por cada orden', () => {
      renderModal();
      expect(screen.getByRole('button', { name: /aéreo/i })).toBeInTheDocument();
    });

    it('el botón "Terrestre" está activo por default (tiene clase de fondo activo)', () => {
      renderModal();
      const terrestreBtn = screen.getByRole('button', { name: /terrestre/i });
      // El componente usa bg-slate-700 cuando !data.aereo (default false)
      expect(terrestreBtn.className).toMatch(/bg-slate-700/);
    });

    it('el botón "Aéreo" no está activo por default', () => {
      renderModal();
      const aereoBtn = screen.getByRole('button', { name: /aéreo/i });
      // bg-sky-600 solo se aplica cuando aereo=true
      expect(aereoBtn.className).not.toMatch(/bg-sky-600/);
    });

    it('al hacer click en "Aéreo" cambia su estilo al estado activo', async () => {
      const user = userEvent.setup();
      renderModal();
      const aereoBtn = screen.getByRole('button', { name: /aéreo/i });
      await user.click(aereoBtn);
      expect(aereoBtn.className).toMatch(/bg-sky-600/);
    });

    it('al hacer click en "Terrestre" después de "Aéreo" vuelve a ser activo', async () => {
      const user = userEvent.setup();
      renderModal();
      const terrestreBtn = screen.getByRole('button', { name: /terrestre/i });
      const aereoBtn = screen.getByRole('button', { name: /aéreo/i });
      await user.click(aereoBtn);
      await user.click(terrestreBtn);
      expect(terrestreBtn.className).toMatch(/bg-slate-700/);
    });

    it('renderiza un selector de modalidad por cada orden en la lista', () => {
      const orders = [
        { ...MOCK_ORDER, id: 'order-1', orderNumber: 'ORD-001' },
        { ...MOCK_ORDER, id: 'order-2', orderNumber: 'ORD-002' },
      ];
      renderModal({ orders });
      expect(screen.getAllByRole('button', { name: /terrestre/i })).toHaveLength(2);
      expect(screen.getAllByRole('button', { name: /aéreo/i })).toHaveLength(2);
    });
  });

  // ── 3. Payload de handleSend ────────────────────────────────────────────────

  describe('handleSend — payload de axios.post', () => {
    it('llama a axios.post con el endpoint correcto al confirmar el envío', async () => {
      mockAxiosPost.mockResolvedValue({
        data: {
          success: true,
          summary: { total: 1, successful: 1, failed: 0 },
          data: [],
          errors: [],
        },
      });

      const { user } = await setupValidForm();

      const sendBtn = screen.getByRole('button', { name: /confirmar y enviar a shalom/i });
      expect(sendBtn).not.toBeDisabled();

      await user.click(sendBtn);

      await waitFor(() => {
        expect(mockAxiosPost).toHaveBeenCalledWith(
          expect.stringContaining('send-to-shalom'),
          expect.any(Object),
        );
      });
    });

    it('el payload lleva declaracionJurada="" cuando no se modifica el default (sentinel __ninguna__ se mapea a vacío)', async () => {
      mockAxiosPost.mockResolvedValue({
        data: {
          success: true,
          summary: { total: 1, successful: 1, failed: 0 },
          data: [],
          errors: [],
        },
      });

      const { user } = await setupValidForm();

      const sendBtn = screen.getByRole('button', { name: /confirmar y enviar a shalom/i });
      expect(sendBtn).not.toBeDisabled();

      await user.click(sendBtn);

      await waitFor(() => {
        const [, payload] = mockAxiosPost.mock.calls[0] as [unknown, { declaracionJurada?: string; packageDetails?: Record<string, { aereo?: boolean }> }];
        expect(payload).toHaveProperty('declaracionJurada', '');
      });
    });

    it('el payload lleva declaracionJurada="Documentos" cuando el usuario selecciona esa opción', async () => {
      mockAxiosPost.mockResolvedValue({
        data: {
          success: true,
          summary: { total: 1, successful: 1, failed: 0 },
          data: [],
          errors: [],
        },
      });

      const { user } = await setupValidForm();

      // Buscar el <select> del dropdown de declaración jurada
      const allSelects = screen.getAllByRole('combobox') as HTMLSelectElement[];
      const djSelect = allSelects.find((s) =>
        Array.from(s.options).some((o) => o.value === '__ninguna__'),
      )!;
      await user.selectOptions(djSelect, 'Documentos');

      const sendBtn = screen.getByRole('button', { name: /confirmar y enviar a shalom/i });
      expect(sendBtn).not.toBeDisabled();

      await user.click(sendBtn);

      await waitFor(() => {
        const [, payload] = mockAxiosPost.mock.calls[0] as [unknown, { declaracionJurada?: string; packageDetails?: Record<string, { aereo?: boolean }> }];
        expect(payload).toHaveProperty('declaracionJurada', 'Documentos');
      });
    });

    it('el payload incluye packageDetails[orderId].aereo=false por default', async () => {
      mockAxiosPost.mockResolvedValue({
        data: {
          success: true,
          summary: { total: 1, successful: 1, failed: 0 },
          data: [],
          errors: [],
        },
      });

      const { user } = await setupValidForm();

      const sendBtn = screen.getByRole('button', { name: /confirmar y enviar a shalom/i });
      expect(sendBtn).not.toBeDisabled();

      await user.click(sendBtn);

      await waitFor(() => {
        const [, payload] = mockAxiosPost.mock.calls[0] as [unknown, { declaracionJurada?: string; packageDetails?: Record<string, { aereo?: boolean }> }];
        expect(payload.packageDetails![MOCK_ORDER.id].aereo).toBe(false);
      });
    });

    it('el payload incluye packageDetails[orderId].aereo=true cuando se selecciona Aéreo', async () => {
      mockAxiosPost.mockResolvedValue({
        data: {
          success: true,
          summary: { total: 1, successful: 1, failed: 0 },
          data: [],
          errors: [],
        },
      });

      const { user } = await setupValidForm();

      // Cambiar a modalidad aérea
      const aereoBtn = screen.getByRole('button', { name: /aéreo/i });
      await user.click(aereoBtn);

      const sendBtn = screen.getByRole('button', { name: /confirmar y enviar a shalom/i });
      expect(sendBtn).not.toBeDisabled();

      await user.click(sendBtn);

      await waitFor(() => {
        const [, payload] = mockAxiosPost.mock.calls[0] as [unknown, { declaracionJurada?: string; packageDetails?: Record<string, { aereo?: boolean }> }];
        expect(payload.packageDetails![MOCK_ORDER.id].aereo).toBe(true);
      });
    });
  });

  // ── 4. Aviso de discrepancia aéreo ─────────────────────────────────────────

  describe('aviso de discrepancia shalomChangedToAereo', () => {
    it('llama a toast.warning cuando la respuesta incluye shalomChangedToAereo=true', async () => {
      mockAxiosPost.mockResolvedValue({
        data: {
          success: true,
          summary: { total: 1, successful: 1, failed: 0 },
          data: [
            {
              trackingNumber: 'TRACK-001',
              recipientName: 'Juan Pérez',
              shalomChangedToAereo: true,
            },
          ],
          errors: [],
        },
      });

      const { user } = await setupValidForm();

      const sendBtn = screen.getByRole('button', { name: /confirmar y enviar a shalom/i });
      expect(sendBtn).not.toBeDisabled();

      await user.click(sendBtn);

      await waitFor(() => {
        expect(mockToast.warning).toHaveBeenCalledWith(
          expect.stringContaining('cambiados a aéreo por Shalom'),
        );
      });
    });

    it('muestra el bloque de aviso de discrepancia en la pantalla de éxito', async () => {
      mockAxiosPost.mockResolvedValue({
        data: {
          success: true,
          summary: { total: 1, successful: 1, failed: 0 },
          data: [
            {
              trackingNumber: 'TRACK-001',
              recipientName: 'Juan Pérez',
              shalomChangedToAereo: true,
            },
          ],
          errors: [],
        },
      });

      const { user } = await setupValidForm();

      const sendBtn = screen.getByRole('button', { name: /confirmar y enviar a shalom/i });
      expect(sendBtn).not.toBeDisabled();

      await user.click(sendBtn);

      await waitFor(() => {
        expect(
          screen.getByText(/cambiado a aéreo por Shalom, no por Powip/i),
        ).toBeInTheDocument();
      });
    });

    it('muestra el título del bloque de aviso "Aviso: modalidad cambiada por Shalom"', async () => {
      mockAxiosPost.mockResolvedValue({
        data: {
          success: true,
          summary: { total: 1, successful: 1, failed: 0 },
          data: [
            {
              trackingNumber: 'TRACK-002',
              recipientName: 'Juan Pérez',
              shalomChangedToAereo: true,
            },
          ],
          errors: [],
        },
      });

      const { user } = await setupValidForm();

      const sendBtn = screen.getByRole('button', { name: /confirmar y enviar a shalom/i });
      expect(sendBtn).not.toBeDisabled();

      await user.click(sendBtn);

      await waitFor(() => {
        expect(
          screen.getByText(/aviso: modalidad cambiada por shalom/i),
        ).toBeInTheDocument();
      });
    });

    it('NO llama a toast.warning si ningún envío tiene shalomChangedToAereo=true', async () => {
      mockAxiosPost.mockResolvedValue({
        data: {
          success: true,
          summary: { total: 1, successful: 1, failed: 0 },
          data: [
            {
              trackingNumber: 'TRACK-003',
              recipientName: 'Juan Pérez',
              shalomChangedToAereo: false,
            },
          ],
          errors: [],
        },
      });

      const { user } = await setupValidForm();

      const sendBtn = screen.getByRole('button', { name: /confirmar y enviar a shalom/i });
      expect(sendBtn).not.toBeDisabled();

      await user.click(sendBtn);

      await waitFor(() => {
        expect(mockAxiosPost).toHaveBeenCalled();
      });

      expect(mockToast.warning).not.toHaveBeenCalledWith(
        expect.stringContaining('cambiados a aéreo por Shalom'),
      );
    });
  });

  // ── 5. Comportamiento de cierre y props ────────────────────────────────────

  describe('props y comportamiento del modal', () => {
    it('no renderiza el contenido cuando open=false', () => {
      renderModal({ open: false });
      expect(screen.queryByText('Enviar a Shalom Pro')).not.toBeInTheDocument();
    });

    it('muestra el número de orden del pedido', () => {
      renderModal();
      expect(screen.getByText(`#${MOCK_ORDER.orderNumber}`)).toBeInTheDocument();
    });

    it('muestra el nombre del cliente del pedido', () => {
      renderModal();
      expect(screen.getByText(MOCK_ORDER.customer.fullName)).toBeInTheDocument();
    });

    it('el botón de envío está deshabilitado inicialmente', () => {
      renderModal();
      const sendBtn = screen.getByRole('button', { name: /confirmar y enviar a shalom/i });
      expect(sendBtn).toBeDisabled();
    });

    it('llama a toast.error cuando axios.post falla', async () => {
      mockAxiosPost.mockRejectedValue({
        response: { data: { message: 'Error del servidor Shalom' } },
      });

      const { user } = await setupValidForm();

      const sendBtn = screen.getByRole('button', { name: /confirmar y enviar a shalom/i });
      expect(sendBtn).not.toBeDisabled();

      await user.click(sendBtn);

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith('Error del servidor Shalom');
      });
    });
  });

  // ── 6. Código de seguridad inválido ────────────────────────────────────────

  describe('validación del código de seguridad', () => {
    it('muestra el label "FALTANTE" cuando el código de seguridad está vacío', () => {
      renderModal();
      // Hay múltiples "FALTANTE" por los campos pendientes — verificamos que existe alguno
      expect(screen.getAllByText('FALTANTE').length).toBeGreaterThan(0);
    });

    it('llama a toast.error al ingresar un código de seguridad secuencial (ej: 1234)', async () => {
      const user = userEvent.setup();
      renderModal();
      // Hay dos inputs con placeholder "Ej: 1357": el global (primero en DOM)
      // y el por-orden (segundo). Apuntamos al global, que es el que dispara
      // toast.error con el mensaje "Código inválido: no uses..."
      const securityInputs = screen.getAllByPlaceholderText('Ej: 1357') as HTMLInputElement[];
      const globalInput = securityInputs[0];
      await user.clear(globalInput);
      await user.type(globalInput, '1234');
      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith(
          expect.stringContaining('Código inválido'),
        );
      });
    });

    it('llama a toast.error al ingresar un código de seguridad repetido (ej: 1111)', async () => {
      const user = userEvent.setup();
      renderModal();
      // Apuntamos al input global (primero en DOM)
      const securityInputs = screen.getAllByPlaceholderText('Ej: 1357') as HTMLInputElement[];
      const globalInput = securityInputs[0];
      await user.clear(globalInput);
      await user.type(globalInput, '1111');
      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith(
          expect.stringContaining('Código inválido'),
        );
      });
    });
  });
});
