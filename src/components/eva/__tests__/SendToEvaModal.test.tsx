/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Tests: SendToEvaModal
 *
 * Comportamiento verificado:
 * 1. Al abrir, muestra spinner mientras verifica la credencial EVA.
 * 2. Credencial activa → llama a getEvaCredentials(token, companyId) y muestra
 *    el formulario auto-completado con los datos del pedido (nombre, teléfono,
 *    distrito, dirección, monto).
 * 3. Credencial null o inactiva → muestra mensaje de error en vez del formulario,
 *    con un botón "Cerrar" que dispara onClose.
 * 4. Error al verificar la credencial (getEvaCredentials rechaza) → muestra
 *    mensaje de error genérico.
 * 5. Campos condicionales: clientType=RECOJO muestra Producto/Bultos (no SKU);
 *    clientType=ALMACEN muestra SKU (no Producto/Bultos).
 * 6. Validación: nombre/distrito/dirección vacíos o teléfono inválido bloquean
 *    el submit; con datos válidos + campo condicional completo se habilita.
 * 7. Submit exitoso (RECOJO): arma el payload con product/packages, llama a
 *    createEvaOrder, muestra el trackingId y dispara onSuccess + toast.success.
 * 8. Submit exitoso (ALMACEN): arma el payload con sku (sin product/packages).
 * 9. Submit con error: createEvaOrder rechaza → toast.error con el mensaje del
 *    servidor (o uno genérico); no se muestra la pantalla de éxito.
 * 10. Maestro de distritos EVA (Combobox, hallazgo #14 auditoría):
 *     - al abrir se llama getEvaDistricts y se muestra su propio estado de carga;
 *     - match tolerante (case-insensitive + espacios) entre el distrito del
 *       pedido y el maestro → se preselecciona el valor CANÓNICO de la lista;
 *     - sin match → sin preselección + aviso de "no coincide con la cobertura";
 *     - el submit queda bloqueado sin un distrito válido del maestro y se
 *       habilita al seleccionar uno;
 *     - error al cargar el maestro → estado de error (no un selector vacío);
 *     - el payload enviado usa el valor canónico exacto de la lista;
 *     - filtrar/tipear dentro del combobox es 100% en cliente — no dispara
 *       requests adicionales de getEvaDistricts.
 *
 * Work-arounds jsdom aplicados (siguiendo el patrón de SendToAliclikModal):
 * - @/components/ui/select → mock de <select> nativo.
 * - @/components/ui/dialog → mock que renderiza children directamente cuando open=true.
 * - @/components/ui/combobox → mock simplificado: trigger con role="combobox",
 *   input de búsqueda con el searchPlaceholder real y filtrado 100% en cliente
 *   (sin abrir/cerrar popover — replica el filtrado en memoria del componente
 *   real, sin onSearchChange, ver combobox.tsx).
 * - @/components/ui/card, input, label, button, textarea → mocks mínimos.
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ── Mocks de infraestructura ─────────────────────────────────────────────────

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

jest.mock('@/services/evaService', () => ({
  getEvaCredentials: jest.fn(),
  getEvaDistricts: jest.fn(),
  createEvaOrder: jest.fn(),
}));

/**
 * Mock del Combobox de distrito → trigger con role="combobox" (texto =
 * opción seleccionada o placeholder) + input de búsqueda (searchPlaceholder
 * real) + lista de opciones como botones. Filtrado 100% en cliente sobre
 * `options`, sin invocar ninguna función externa — replica el comportamiento
 * del componente real cuando no se le pasa `onSearchChange` (ver combobox.tsx).
 */
jest.mock('@/components/ui/combobox', () => {
  const React = require('react');

  interface MockComboboxOption {
    value: string;
    label: string;
  }

  const Combobox = ({
    value,
    onValueChange,
    options,
    placeholder,
    searchPlaceholder,
    emptyMessage,
    className,
  }: {
    value?: string;
    onValueChange?: (value: string) => void;
    options?: MockComboboxOption[];
    placeholder?: string;
    searchPlaceholder?: string;
    emptyMessage?: string;
    className?: string;
  }) => {
    const [query, setQuery] = React.useState('');
    const opts: MockComboboxOption[] = options ?? [];
    const filtered = opts.filter((opt) =>
      opt.label.toLowerCase().includes(query.toLowerCase()),
    );
    const selected = opts.find((opt) => opt.value === value);

    return (
      <div className={className}>
        <div role="combobox" aria-expanded="true">
          {selected ? selected.label : placeholder}
        </div>
        <input
          placeholder={searchPlaceholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <ul>
          {filtered.length === 0 && <li>{emptyMessage}</li>}
          {filtered.map((opt) => (
            <li key={opt.value}>
              <button type="button" onClick={() => onValueChange?.(opt.value)}>
                {opt.label}
              </button>
            </li>
          ))}
        </ul>
      </div>
    );
  };

  return { Combobox };
});

/**
 * Mock de Radix Select → <select> nativo.
 */
jest.mock('@/components/ui/select', () => {
  const React = require('react');

  function extractText(node: unknown): string {
    if (node === null || node === undefined) return '';
    if (typeof node === 'string' || typeof node === 'number') return String(node);
    if (typeof node === 'boolean') return '';
    if (Array.isArray(node)) return node.map(extractText).join('');
    if (typeof node === 'object' && node !== null && 'props' in node) {
      const el = node as { props: { children?: unknown } };
      return extractText(el.props.children);
    }
    return '';
  }

  const Select = ({
    value,
    onValueChange,
    children,
  }: {
    value?: string;
    onValueChange?: (v: string) => void;
    children?: React.ReactNode;
  }) => {
    const options: { value: string; label: string }[] = [];
    React.Children.forEach(children, (child: React.ReactElement<{ children?: React.ReactNode }>) => {
      if (!child || !child.props) return;
      if (child.props.children) {
        React.Children.forEach(child.props.children, (item: React.ReactElement<{ value?: string; children?: React.ReactNode }>) => {
          if (item && item.props && item.props.value !== undefined) {
            options.push({ value: item.props.value, label: extractText(item.props.children) });
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
  const SelectItem = ({ value, children }: { value: string; children?: React.ReactNode }) => (
    <option value={value}>{children}</option>
  );
  const SelectTrigger = ({ children }: { children?: React.ReactNode }) => <>{children}</>;
  const SelectValue = ({ placeholder }: { placeholder?: string }) => <span>{placeholder}</span>;

  return { Select, SelectContent, SelectItem, SelectTrigger, SelectValue };
});

jest.mock('@/components/ui/dialog', () => {
  const React = require('react');
  const Dialog = ({ open, children }: { open?: boolean; children?: React.ReactNode }) =>
    open ? <div data-testid="dialog">{children}</div> : null;
  const DialogContent = ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="dialog-content">{children}</div>
  );
  const DialogHeader = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  const DialogTitle = ({ children }: { children?: React.ReactNode }) => <h2>{children}</h2>;
  return { Dialog, DialogContent, DialogHeader, DialogTitle };
});

jest.mock('@/components/ui/button', () => {
  const React = require('react');
  const Button = ({
    children,
    onClick,
    disabled,
    className,
    variant,
    size,
  }: {
    children?: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    className?: string;
    variant?: string;
    size?: string;
  }) => (
    <button onClick={onClick} disabled={disabled} className={className} data-variant={variant} data-size={size}>
      {children}
    </button>
  );
  const buttonVariants = () => '';
  return { Button, buttonVariants };
});

jest.mock('@/components/ui/input', () => {
  const React = require('react');
  const Input = (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />;
  return { Input };
});

jest.mock('@/components/ui/label', () => {
  const React = require('react');
  const Label = ({
    children,
    className,
    htmlFor,
  }: {
    children?: React.ReactNode;
    className?: string;
    htmlFor?: string;
  }) => (
    <label className={className} htmlFor={htmlFor}>{children}</label>
  );
  return { Label };
});

jest.mock('@/components/ui/textarea', () => {
  const React = require('react');
  const Textarea = (props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...props} />;
  return { Textarea };
});

jest.mock('lucide-react', () => ({
  Loader2: ({ className }: { className?: string }) => <span data-testid="loader" className={className} />,
  CheckCircle2: () => null,
  AlertCircle: () => null,
  Package: () => null,
}));

// ── Imports bajo prueba (después de los mocks) ────────────────────────────────

import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { getEvaCredentials, getEvaDistricts, createEvaOrder } from '@/services/evaService';
import SendToEvaModal from '../SendToEvaModal';

// ── Casts ────────────────────────────────────────────────────────────────────

const mockUseAuth = jest.mocked(useAuth);
const mockGetCredentials = jest.mocked(getEvaCredentials);
const mockGetDistricts = jest.mocked(getEvaDistricts);
const mockCreateOrder = jest.mocked(createEvaOrder);
const mockToast = toast as jest.Mocked<typeof toast>;

// ── Fixtures ─────────────────────────────────────────────────────────────────

const MOCK_AUTH = {
  auth: {
    user: { id: 'user-1', email: 'test@powip.com', role: 'ADMIN', permissions: [] },
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

const MOCK_CREDENTIAL_RECOJO = {
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

const MOCK_CREDENTIAL_ALMACEN = {
  ...MOCK_CREDENTIAL_RECOJO,
  clientType: 'ALMACEN' as const,
};

const MOCK_CREDENTIAL_INACTIVE = {
  ...MOCK_CREDENTIAL_RECOJO,
  isActive: false,
};

const MOCK_CREATE_RESULT = {
  trackingId: 'EVA-TRK-123',
  externalOrderId: 'EVA-EXT-456',
};

/**
 * Maestro de distritos EVA por defecto — incluye la forma canónica exacta
 * ("MIRAFLORES") que matchea (tolerante) contra `BASE_PROPS.district`
 * ("Miraflores"), para que el resto de los tests (submit, validación, etc.)
 * que no ejercitan directamente el Combobox sigan teniendo un distrito
 * válido preseleccionado sin pasos adicionales.
 */
const DEFAULT_DISTRICTS = ['MIRAFLORES', 'SAN ISIDRO', 'SURCO'];

const BASE_PROPS = {
  open: true,
  onClose: jest.fn(),
  orderId: 'order-1',
  companyId: 'company-1',
  recipientName: 'Juan Pérez',
  recipientPhone: '987654321',
  district: 'Miraflores',
  address: 'Av. Test 123',
  amount: 50,
  onSuccess: jest.fn(),
};

// ── Helper ───────────────────────────────────────────────────────────────────

function renderModal(propOverrides: Partial<typeof BASE_PROPS> = {}) {
  return render(<SendToEvaModal {...BASE_PROPS} {...propOverrides} />);
}

// ── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  mockUseAuth.mockReturnValue(MOCK_AUTH as unknown as ReturnType<typeof useAuth>);
  mockGetCredentials.mockResolvedValue(MOCK_CREDENTIAL_RECOJO);
  mockGetDistricts.mockResolvedValue(DEFAULT_DISTRICTS);
  mockCreateOrder.mockResolvedValue(MOCK_CREATE_RESULT);
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe('SendToEvaModal', () => {

  // ── 1. Verificación de credencial y render de contenido ──────────────────

  describe('verificación de credencial', () => {
    it('muestra spinner mientras verifica la credencial EVA', () => {
      mockGetCredentials.mockReturnValue(new Promise(() => {}));
      renderModal();
      expect(screen.getByTestId('loader')).toBeInTheDocument();
      expect(screen.getByText(/verificando configuración de eva/i)).toBeInTheDocument();
    });

    it('llama a getEvaCredentials con token y companyId al abrir', async () => {
      renderModal();
      await waitFor(() => {
        expect(mockGetCredentials).toHaveBeenCalledWith('fake-token', 'company-1');
      });
    });

    it('no llama a getEvaCredentials cuando open=false', () => {
      renderModal({ open: false });
      expect(mockGetCredentials).not.toHaveBeenCalled();
    });
  });

  // ── 2. Credencial activa — formulario auto-completado ─────────────────────

  describe('credencial activa — formulario auto-completado', () => {
    it('pre-completa el nombre del destinatario desde las props del pedido', async () => {
      renderModal();
      expect(await screen.findByLabelText(/nombre/i)).toHaveValue('Juan Pérez');
    });

    it('pre-completa el teléfono desde las props del pedido', async () => {
      renderModal();
      await screen.findByLabelText(/nombre/i);
      expect(screen.getByLabelText(/teléfono/i)).toHaveValue('987654321');
    });

    it('pre-completa la dirección desde las props del pedido', async () => {
      renderModal();
      await screen.findByLabelText(/nombre/i);
      expect(screen.getByLabelText(/dirección/i)).toHaveValue('Av. Test 123');
    });

    it('pre-completa el monto desde las props del pedido', async () => {
      renderModal();
      await screen.findByLabelText(/nombre/i);
      expect(screen.getByLabelText(/monto a cobrar/i)).toHaveValue(50);
    });

    it('desaparece el spinner al completar la verificación', async () => {
      renderModal();
      await screen.findByLabelText(/nombre/i);
      expect(screen.queryByText(/verificando configuración de eva/i)).not.toBeInTheDocument();
    });
  });

  // ── 3. Sin credencial activa — error en vez de formulario ─────────────────

  describe('sin credencial activa', () => {
    it('muestra mensaje de error cuando no existe credencial (null)', async () => {
      mockGetCredentials.mockResolvedValue(null);
      renderModal();
      expect(
        await screen.findByText(/la integración con eva no está configurada o activa/i),
      ).toBeInTheDocument();
    });

    it('muestra mensaje de error cuando la credencial existe pero está inactiva', async () => {
      mockGetCredentials.mockResolvedValue(MOCK_CREDENTIAL_INACTIVE);
      renderModal();
      expect(
        await screen.findByText(/la integración con eva no está configurada o activa/i),
      ).toBeInTheDocument();
    });

    it('no muestra el formulario cuando no hay credencial activa', async () => {
      mockGetCredentials.mockResolvedValue(null);
      renderModal();
      await screen.findByText(/la integración con eva no está configurada o activa/i);
      expect(screen.queryByLabelText(/nombre/i)).not.toBeInTheDocument();
    });

    it('muestra un botón "Cerrar" que dispara onClose', async () => {
      mockGetCredentials.mockResolvedValue(null);
      const onClose = jest.fn();
      renderModal({ onClose });
      const closeBtn = await screen.findByRole('button', { name: /cerrar/i });
      const user = userEvent.setup();
      await user.click(closeBtn);
      expect(onClose).toHaveBeenCalled();
    });
  });

  // ── 4. Error al verificar la credencial ────────────────────────────────────

  describe('error al verificar la credencial', () => {
    it('muestra mensaje de error genérico cuando getEvaCredentials rechaza', async () => {
      mockGetCredentials.mockRejectedValue(new Error('Network Error'));
      renderModal();
      expect(
        await screen.findByText(/error al verificar la configuración de eva/i),
      ).toBeInTheDocument();
    });
  });

  // ── 5. Campos condicionales según clientType ──────────────────────────────

  describe('campos condicionales según clientType', () => {
    it('clientType=RECOJO muestra Producto y Bultos', async () => {
      mockGetCredentials.mockResolvedValue(MOCK_CREDENTIAL_RECOJO);
      renderModal();
      expect(await screen.findByLabelText(/producto/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/bultos/i)).toBeInTheDocument();
    });

    it('clientType=RECOJO NO muestra el campo SKU', async () => {
      mockGetCredentials.mockResolvedValue(MOCK_CREDENTIAL_RECOJO);
      renderModal();
      await screen.findByLabelText(/producto/i);
      expect(screen.queryByLabelText(/sku/i)).not.toBeInTheDocument();
    });

    it('clientType=ALMACEN muestra el campo SKU', async () => {
      mockGetCredentials.mockResolvedValue(MOCK_CREDENTIAL_ALMACEN);
      renderModal();
      expect(await screen.findByLabelText(/sku/i)).toBeInTheDocument();
    });

    it('clientType=ALMACEN NO muestra Producto ni Bultos', async () => {
      mockGetCredentials.mockResolvedValue(MOCK_CREDENTIAL_ALMACEN);
      renderModal();
      await screen.findByLabelText(/sku/i);
      expect(screen.queryByLabelText(/producto/i)).not.toBeInTheDocument();
      expect(screen.queryByLabelText(/bultos/i)).not.toBeInTheDocument();
    });
  });

  // ── 6. Validación del formulario ──────────────────────────────────────────

  describe('validación del formulario', () => {
    it('el botón "Crear pedido en EVA" está deshabilitado mientras falta el campo condicional (RECOJO: producto)', async () => {
      renderModal();
      const btn = await screen.findByRole('button', { name: /crear pedido en eva/i });
      expect(btn).toBeDisabled();
    });

    it('el botón se habilita al completar producto (RECOJO) con el resto de datos válidos', async () => {
      renderModal();
      const productInput = await screen.findByLabelText(/producto/i);
      const user = userEvent.setup();
      await user.type(productInput, 'Caja mediana');

      const btn = screen.getByRole('button', { name: /crear pedido en eva/i });
      await waitFor(() => expect(btn).not.toBeDisabled());
    });

    it('el botón se habilita al completar sku (ALMACEN) con el resto de datos válidos', async () => {
      mockGetCredentials.mockResolvedValue(MOCK_CREDENTIAL_ALMACEN);
      renderModal();
      const skuInput = await screen.findByLabelText(/sku/i);
      const user = userEvent.setup();
      await user.type(skuInput, 'SKU-001(2)');

      const btn = screen.getByRole('button', { name: /crear pedido en eva/i });
      await waitFor(() => expect(btn).not.toBeDisabled());
    });

    it('el botón se deshabilita si se vacía el nombre del destinatario', async () => {
      renderModal();
      const productInput = await screen.findByLabelText(/producto/i);
      const user = userEvent.setup();
      await user.type(productInput, 'Caja mediana');

      const nameInput = screen.getByLabelText(/nombre/i);
      await user.clear(nameInput);

      const btn = screen.getByRole('button', { name: /crear pedido en eva/i });
      expect(btn).toBeDisabled();
    });

    it('muestra mensaje de teléfono inválido y deshabilita el botón con un teléfono incompleto', async () => {
      renderModal();
      const productInput = await screen.findByLabelText(/producto/i);
      const user = userEvent.setup();
      await user.type(productInput, 'Caja mediana');

      const phoneInput = screen.getByLabelText(/teléfono/i);
      await user.clear(phoneInput);
      await user.type(phoneInput, '12345');

      expect(
        await screen.findByText(/teléfono inválido — debe ser un número peruano de 9 dígitos/i),
      ).toBeInTheDocument();
      const btn = screen.getByRole('button', { name: /crear pedido en eva/i });
      expect(btn).toBeDisabled();
    });
  });

  // ── 7. Submit exitoso — RECOJO ────────────────────────────────────────────

  describe('submit exitoso — clientType RECOJO', () => {
    async function fillAndSubmitRecojo() {
      const productInput = await screen.findByLabelText(/producto/i);
      const user = userEvent.setup();
      await user.type(productInput, 'Caja mediana');

      const btn = screen.getByRole('button', { name: /crear pedido en eva/i });
      await waitFor(() => expect(btn).not.toBeDisabled());
      await user.click(btn);
      return { user, btn };
    }

    it('llama a createEvaOrder con el payload correcto (incluye product y packages)', async () => {
      renderModal();
      await fillAndSubmitRecojo();

      await waitFor(() => {
        expect(mockCreateOrder).toHaveBeenCalledWith(
          'fake-token',
          expect.objectContaining({
            companyId: 'company-1',
            orderId: 'order-1',
            recipientName: 'Juan Pérez',
            recipientPhone: '+51987654321',
            district: 'MIRAFLORES',
            address: 'Av. Test 123',
            amount: 50,
            product: 'Caja mediana',
            packages: 1,
          }),
        );
      });
    });

    it('el payload NO incluye "sku" para clientType RECOJO', async () => {
      renderModal();
      await fillAndSubmitRecojo();

      await waitFor(() => {
        const [, payload] = mockCreateOrder.mock.calls[0];
        expect(payload).not.toHaveProperty('sku');
      });
    });

    it('muestra el trackingId tras el éxito', async () => {
      renderModal();
      await fillAndSubmitRecojo();
      expect(await screen.findByText('EVA-TRK-123')).toBeInTheDocument();
    });

    it('muestra el texto "¡Pedido creado!" tras el éxito', async () => {
      renderModal();
      await fillAndSubmitRecojo();
      expect(await screen.findByText(/¡pedido creado!/i)).toBeInTheDocument();
    });

    it('llama a toast.success tras crear correctamente', async () => {
      renderModal();
      await fillAndSubmitRecojo();
      await waitFor(() => {
        expect(mockToast.success).toHaveBeenCalledWith(
          expect.stringContaining('EVA'),
        );
      });
    });

    it('llama a onSuccess tras crear correctamente', async () => {
      const onSuccess = jest.fn();
      renderModal({ onSuccess });
      await fillAndSubmitRecojo();
      await waitFor(() => {
        expect(onSuccess).toHaveBeenCalled();
      });
    });
  });

  // ── 8. Submit exitoso — ALMACEN ───────────────────────────────────────────

  describe('submit exitoso — clientType ALMACEN', () => {
    it('llama a createEvaOrder con el payload correcto (incluye sku, sin product/packages)', async () => {
      mockGetCredentials.mockResolvedValue(MOCK_CREDENTIAL_ALMACEN);
      renderModal();

      const skuInput = await screen.findByLabelText(/sku/i);
      const user = userEvent.setup();
      await user.type(skuInput, 'SKU-001(2)');

      const btn = screen.getByRole('button', { name: /crear pedido en eva/i });
      await waitFor(() => expect(btn).not.toBeDisabled());
      await user.click(btn);

      await waitFor(() => {
        expect(mockCreateOrder).toHaveBeenCalledWith(
          'fake-token',
          expect.objectContaining({ sku: 'SKU-001(2)' }),
        );
        const [, payload] = mockCreateOrder.mock.calls[0];
        expect(payload).not.toHaveProperty('product');
        expect(payload).not.toHaveProperty('packages');
      });
    });
  });

  // ── 9. Errores al crear el pedido ─────────────────────────────────────────

  describe('error al crear pedido', () => {
    it('llama a toast.error con el mensaje del servidor cuando createEvaOrder rechaza', async () => {
      mockCreateOrder.mockRejectedValue({
        response: { data: { message: 'Distrito no habilitado por EVA' } },
      });
      renderModal();

      const productInput = await screen.findByLabelText(/producto/i);
      const user = userEvent.setup();
      await user.type(productInput, 'Caja mediana');
      const btn = screen.getByRole('button', { name: /crear pedido en eva/i });
      await waitFor(() => expect(btn).not.toBeDisabled());
      await user.click(btn);

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith('Distrito no habilitado por EVA');
      });
    });

    it('usa mensaje genérico si el error no tiene response.data.message', async () => {
      mockCreateOrder.mockRejectedValue(new Error('boom'));
      renderModal();

      const productInput = await screen.findByLabelText(/producto/i);
      const user = userEvent.setup();
      await user.type(productInput, 'Caja mediana');
      const btn = screen.getByRole('button', { name: /crear pedido en eva/i });
      await waitFor(() => expect(btn).not.toBeDisabled());
      await user.click(btn);

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith('Error al crear el pedido en EVA');
      });
    });

    it('NO muestra la pantalla de éxito cuando createEvaOrder rechaza', async () => {
      mockCreateOrder.mockRejectedValue(new Error('fail'));
      renderModal();

      const productInput = await screen.findByLabelText(/producto/i);
      const user = userEvent.setup();
      await user.type(productInput, 'Caja mediana');
      const btn = screen.getByRole('button', { name: /crear pedido en eva/i });
      await waitFor(() => expect(btn).not.toBeDisabled());
      await user.click(btn);

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalled();
      });
      expect(screen.queryByText(/¡pedido creado!/i)).not.toBeInTheDocument();
    });

    it('NO llama a onSuccess cuando createEvaOrder rechaza', async () => {
      mockCreateOrder.mockRejectedValue(new Error('fail'));
      const onSuccess = jest.fn();
      renderModal({ onSuccess });

      const productInput = await screen.findByLabelText(/producto/i);
      const user = userEvent.setup();
      await user.type(productInput, 'Caja mediana');
      const btn = screen.getByRole('button', { name: /crear pedido en eva/i });
      await waitFor(() => expect(btn).not.toBeDisabled());
      await user.click(btn);

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalled();
      });
      expect(onSuccess).not.toHaveBeenCalled();
    });

    it('el botón vuelve a estar habilitado tras el error (sale del estado "enviando")', async () => {
      mockCreateOrder.mockRejectedValue(new Error('fail'));
      renderModal();

      const productInput = await screen.findByLabelText(/producto/i);
      const user = userEvent.setup();
      await user.type(productInput, 'Caja mediana');
      const btn = screen.getByRole('button', { name: /crear pedido en eva/i });
      await waitFor(() => expect(btn).not.toBeDisabled());
      await user.click(btn);

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalled();
      });
      expect(screen.queryByText(/creando pedido\.\.\./i)).not.toBeInTheDocument();
      expect(btn).not.toBeDisabled();
    });
  });

  // ── 10. Maestro de distritos EVA (Combobox — hallazgo #14 auditoría) ──────

  describe('maestro de distritos EVA (Combobox)', () => {
    /**
     * Los <select> nativos mockeados de "Tipo de servicio" / "Método de
     * cobro" (sin `multiple` ni `size`) también resuelven a role="combobox"
     * en jsdom (mapeo implícito de aria-query/HTML-AAM para <select>), y
     * conviven en el DOM con el Combobox (mock) de distrito apenas la
     * credencial resuelve — independientemente del estado del maestro de
     * distritos. `findByRole('combobox')`/`queryByRole('combobox')` sin
     * filtrar entonces encuentran 2-3 elementos y explotan con "found
     * multiple elements". Se desambigua igual que en
     * SendToAliclikModal.test.tsx (getAllByRole + filter): el Combobox de
     * distrito es el único `<div role="combobox">` (los Select son <select>).
     */
    async function findDistrictCombobox(): Promise<HTMLElement> {
      return waitFor(() => {
        const match = screen
          .getAllByRole('combobox')
          .find((el) => el.tagName === 'DIV');
        if (!match) throw new Error('Combobox de distrito aún no renderizado');
        return match;
      });
    }

    function queryDistrictCombobox(): HTMLElement | undefined {
      return screen.queryAllByRole('combobox').find((el) => el.tagName === 'DIV');
    }

    it('llama a getEvaDistricts al abrir y muestra el estado de carga del selector mientras está pendiente', async () => {
      mockGetDistricts.mockReturnValue(new Promise(() => {}));
      renderModal();

      // El formulario recién aparece cuando la credencial (independiente) resuelve.
      await screen.findByLabelText(/nombre/i);

      expect(
        screen.getByText(/cargando distritos habilitados por eva/i),
      ).toBeInTheDocument();
      expect(queryDistrictCombobox()).toBeUndefined();
      expect(mockGetDistricts).toHaveBeenCalledWith('fake-token');
    });

    it('preselecciona el valor CANÓNICO exacto de la lista cuando el distrito del pedido matchea', async () => {
      mockGetDistricts.mockResolvedValue(['MIRAFLORES', 'SURCO']);
      renderModal({ district: 'Miraflores' });

      const combobox = await findDistrictCombobox();
      await waitFor(() => expect(combobox).toHaveTextContent('MIRAFLORES'));
      expect(
        screen.queryByText(/no coincide con la cobertura de eva/i),
      ).not.toBeInTheDocument();
    });

    it('el match es tolerante a mayúsculas/minúsculas y espacios extra', async () => {
      mockGetDistricts.mockResolvedValue(['MIRAFLORES', 'SURCO']);
      renderModal({ district: '  miraflores  ' });

      const combobox = await findDistrictCombobox();
      await waitFor(() => expect(combobox).toHaveTextContent('MIRAFLORES'));
    });

    it('sin match contra el maestro, el selector queda sin selección y muestra el aviso de no-cobertura', async () => {
      mockGetDistricts.mockResolvedValue(['MIRAFLORES', 'SURCO']);
      renderModal({ district: 'Chorrillos' });

      const combobox = await findDistrictCombobox();
      await waitFor(() =>
        expect(
          screen.getByText(/no coincide con la cobertura de eva/i),
        ).toBeInTheDocument(),
      );
      expect(combobox).toHaveTextContent(/seleccionar distrito/i);
      expect(combobox).not.toHaveTextContent('CHORRILLOS');
    });

    it('el submit está deshabilitado sin distrito válido y se habilita al seleccionar uno de la lista', async () => {
      mockGetDistricts.mockResolvedValue(['MIRAFLORES', 'SURCO']);
      renderModal({ district: 'Chorrillos' });

      const productInput = await screen.findByLabelText(/producto/i);
      const user = userEvent.setup();
      await user.type(productInput, 'Caja mediana');

      const btn = screen.getByRole('button', { name: /crear pedido en eva/i });
      // Resto de campos válidos, pero sin distrito seleccionado → sigue deshabilitado.
      expect(btn).toBeDisabled();

      const surcoOption = await screen.findByRole('button', { name: 'SURCO' });
      await user.click(surcoOption);

      await waitFor(() => expect(btn).not.toBeDisabled());
      expect(
        screen.queryByText(/no coincide con la cobertura de eva/i),
      ).not.toBeInTheDocument();
    });

    it('muestra el estado de error de distritos (no un selector vacío) cuando getEvaDistricts falla', async () => {
      mockGetDistricts.mockRejectedValue(new Error('Network Error'));
      renderModal();

      await screen.findByLabelText(/nombre/i);

      expect(
        await screen.findByText(
          /error al cargar el listado de distritos habilitados por eva/i,
        ),
      ).toBeInTheDocument();
      expect(queryDistrictCombobox()).toBeUndefined();
      expect(
        screen.queryByText(/cargando distritos habilitados por eva/i),
      ).not.toBeInTheDocument();
    });

    it('el payload de createEvaOrder incluye el valor canónico exacto seleccionado (no el texto crudo tipeado)', async () => {
      mockGetDistricts.mockResolvedValue(['MIRAFLORES', 'SURCO']);
      renderModal({ district: 'Chorrillos' });

      const productInput = await screen.findByLabelText(/producto/i);
      const user = userEvent.setup();
      await user.type(productInput, 'Caja mediana');
      const surcoOption = await screen.findByRole('button', { name: 'SURCO' });
      await user.click(surcoOption);

      const btn = screen.getByRole('button', { name: /crear pedido en eva/i });
      await waitFor(() => expect(btn).not.toBeDisabled());
      await user.click(btn);

      await waitFor(() => {
        expect(mockCreateOrder).toHaveBeenCalledWith(
          'fake-token',
          expect.objectContaining({ district: 'SURCO' }),
        );
      });
    });

    it('filtrar/tipear dentro del combobox NO dispara requests adicionales de getEvaDistricts', async () => {
      mockGetDistricts.mockResolvedValue(['MIRAFLORES', 'SAN ISIDRO', 'SURCO']);
      renderModal({ district: 'Miraflores' });

      const combobox = await findDistrictCombobox();
      await waitFor(() => expect(combobox).toHaveTextContent('MIRAFLORES'));
      expect(mockGetDistricts).toHaveBeenCalledTimes(1);
      expect(mockGetCredentials).toHaveBeenCalledTimes(1);

      const user = userEvent.setup();
      const searchInput = screen.getByPlaceholderText(/buscar distrito/i);
      await user.type(searchInput, 'san');

      // El filtrado deja solo "SAN ISIDRO" visible en la lista de opciones — en
      // cliente, sin volver a llamar a ningún service.
      expect(screen.getByRole('button', { name: 'SAN ISIDRO' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'SURCO' })).not.toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'SAN ISIDRO' }));
      await waitFor(() => expect(combobox).toHaveTextContent('SAN ISIDRO'));

      expect(mockGetDistricts).toHaveBeenCalledTimes(1);
      expect(mockGetCredentials).toHaveBeenCalledTimes(1);
      expect(mockCreateOrder).not.toHaveBeenCalled();
    });
  });
});
