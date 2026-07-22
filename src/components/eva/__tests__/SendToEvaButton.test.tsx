/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Tests: SendToEvaButton
 *
 * Comportamiento verificado:
 * 1. Renderiza un botón con label "Enviar a EVA" por default.
 * 2. Renderiza un botón con label personalizado cuando se pasa prop "label".
 * 3. El modal queda cerrado inicialmente (no renderiza su contenido).
 * 4. Al hacer click en el botón, abre el modal (muestra el título del modal).
 * 5. El modal recibe companyId y llama a getEvaCredentials con los datos correctos.
 * 6. El modal recibe los datos del pedido (recipientName, etc.) y los usa para
 *    pre-completar el formulario tras cargar la credencial.
 * 7. Al completar el submit con éxito, se dispara onSuccess pasado al botón.
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

jest.mock('@/components/ui/button', () => {
  const React = require('react');
  const Button = ({
    children,
    onClick,
    disabled,
    className,
    variant,
    size,
    'aria-label': ariaLabel,
  }: {
    children?: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    className?: string;
    variant?: string;
    size?: string;
    'aria-label'?: string;
  }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      className={className}
      data-variant={variant}
      data-size={size}
      aria-label={ariaLabel}
    >
      {children}
    </button>
  );
  const buttonVariants = () => '';
  return { Button, buttonVariants };
});

jest.mock('@/components/ui/select', () => {
  const React = require('react');
  const Select = ({ value, onValueChange, children }: { value?: string; onValueChange?: (v: string) => void; children?: React.ReactNode }) => {
    const options: { value: string; label: string }[] = [];
    React.Children.forEach(children, (child: React.ReactElement<{ children?: React.ReactNode }>) => {
      if (!child || !child.props) return;
      if (child.props.children) {
        React.Children.forEach(child.props.children, (item: React.ReactElement<{ value?: string; children?: React.ReactNode }>) => {
          if (item && item.props && item.props.value !== undefined) {
            options.push({ value: item.props.value, label: String(item.props.children) });
          }
        });
      }
    });
    return (
      <select value={value} onChange={(e) => onValueChange?.(e.target.value)}>
        {options.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
      </select>
    );
  };
  const SelectContent = ({ children }: { children?: React.ReactNode }) => <>{children}</>;
  const SelectItem = ({ value, children }: { value: string; children?: React.ReactNode }) => <option value={value}>{children}</option>;
  const SelectTrigger = ({ children }: { children?: React.ReactNode }) => <>{children}</>;
  const SelectValue = ({ placeholder }: { placeholder?: string }) => <span>{placeholder}</span>;
  return { Select, SelectContent, SelectItem, SelectTrigger, SelectValue };
});

/**
 * Mock del Combobox de distrito (mismo patrón que SendToEvaModal.test.tsx):
 * trigger con role="combobox" (texto = opción seleccionada o placeholder) +
 * lista de opciones como botones, filtrado 100% en cliente.
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

jest.mock('@/components/ui/dialog', () => {
  const React = require('react');
  const Dialog = ({ open, children }: { open?: boolean; children?: React.ReactNode }) =>
    open ? <div data-testid="dialog">{children}</div> : null;
  const DialogContent = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  const DialogHeader = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  const DialogTitle = ({ children }: { children?: React.ReactNode }) => <h2>{children}</h2>;
  return { Dialog, DialogContent, DialogHeader, DialogTitle };
});

jest.mock('@/components/ui/input', () => {
  const React = require('react');
  const Input = (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />;
  return { Input };
});

jest.mock('@/components/ui/label', () => {
  const React = require('react');
  const Label = ({ children, className, htmlFor }: { children?: React.ReactNode; className?: string; htmlFor?: string }) => (
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
  Loader2: () => null,
  CheckCircle2: () => null,
  AlertCircle: () => null,
  Package: () => null,
  Truck: () => null,
}));

jest.mock('@/lib/utils', () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
}));

// ── Imports bajo prueba ──────────────────────────────────────────────────────

import { useAuth } from '@/contexts/AuthContext';
import { getEvaCredentials, createEvaOrder, getEvaDistricts } from '@/services/evaService';
import SendToEvaButton from '../SendToEvaButton';

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

const MOCK_CREATE_RESULT = {
  trackingId: 'EVA-TRK-777',
  externalOrderId: 'EVA-EXT-777',
};

const BASE_ORDER_DATA = {
  recipientName: 'Juan Pérez',
  recipientPhone: '987654321',
  district: 'Miraflores',
  address: 'Av. Test 123',
  amount: 50,
};

/**
 * Maestro de distritos EVA por defecto — incluye la forma canónica exacta
 * ("MIRAFLORES") que matchea (tolerante) contra `BASE_ORDER_DATA.district`
 * ("Miraflores"), para que el resto de los tests que no ejercitan
 * directamente el Combobox sigan teniendo un distrito válido preseleccionado.
 */
const DEFAULT_DISTRICTS = ['MIRAFLORES', 'SAN ISIDRO', 'SURCO'];

/** Desambigua el Combobox de distrito de los `<select>` (RECOJO service_type / payment_method), que también resuelven a role="combobox" en jsdom. */
function findDistrictCombobox(): Promise<HTMLElement> {
  return waitFor(() => {
    const match = screen
      .getAllByRole('combobox')
      .find((el) => el.tagName === 'DIV');
    if (!match) throw new Error('Combobox de distrito aún no renderizado');
    return match;
  });
}

// ── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(useAuth).mockReturnValue(MOCK_AUTH as unknown as ReturnType<typeof useAuth>);
  // getEvaCredentials nunca resuelve por defecto (modal se queda en loading)
  jest.mocked(getEvaCredentials).mockReturnValue(new Promise(() => {}));
  // getEvaDistricts sí resuelve por defecto (se pide en paralelo a la credencial,
  // sin importar si esta resuelve o no) con un maestro que incluye la forma
  // canónica del distrito por defecto del pedido de prueba.
  jest.mocked(getEvaDistricts).mockResolvedValue(DEFAULT_DISTRICTS);
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe('SendToEvaButton', () => {

  describe('render inicial', () => {
    it('renderiza el botón con label por defecto "Enviar a EVA"', () => {
      render(<SendToEvaButton orderId="order-1" {...BASE_ORDER_DATA} />);
      expect(screen.getByRole('button', { name: /enviar a eva/i })).toBeInTheDocument();
    });

    it('renderiza el botón con label personalizado', () => {
      render(<SendToEvaButton orderId="order-1" {...BASE_ORDER_DATA} label="Despachar con EVA" />);
      expect(screen.getByRole('button', { name: /despachar con eva/i })).toBeInTheDocument();
    });

    it('el modal no está visible inicialmente', () => {
      render(<SendToEvaButton orderId="order-1" {...BASE_ORDER_DATA} />);
      expect(screen.queryByTestId('dialog')).not.toBeInTheDocument();
    });
  });

  describe('apertura del modal', () => {
    it('al hacer click en el botón aparece el título del modal', async () => {
      const user = userEvent.setup();
      render(<SendToEvaButton orderId="order-1" {...BASE_ORDER_DATA} />);
      await user.click(screen.getByRole('button', { name: /enviar a eva/i }));

      expect(await screen.findByTestId('dialog')).toBeInTheDocument();
      const dialog = screen.getByTestId('dialog');
      const title = dialog.querySelector('h2');
      expect(title).not.toBeNull();
      expect(title?.textContent).toMatch(/enviar a eva/i);
    });

    it('llama a getEvaCredentials con el companyId y token correctos al abrir', async () => {
      const user = userEvent.setup();
      render(<SendToEvaButton orderId="order-xyz" companyId="company-1" {...BASE_ORDER_DATA} />);
      await user.click(screen.getByRole('button', { name: /enviar a eva/i }));
      await waitFor(() => {
        expect(getEvaCredentials).toHaveBeenCalledWith('fake-token', 'company-1');
      });
    });

    it('pre-completa el formulario del modal con los datos del pedido pasados al botón', async () => {
      jest.mocked(getEvaCredentials).mockResolvedValue(MOCK_CREDENTIAL_RECOJO);

      const user = userEvent.setup();
      render(<SendToEvaButton orderId="order-xyz" companyId="company-1" {...BASE_ORDER_DATA} />);
      await user.click(screen.getByRole('button', { name: /enviar a eva/i }));

      expect(await screen.findByLabelText(/nombre/i)).toHaveValue('Juan Pérez');

      // El distrito ahora se resuelve con un Combobox contra el maestro de EVA
      // (hallazgo #14 auditoría): se preselecciona el valor CANÓNICO exacto de
      // la lista ("MIRAFLORES") que matchea (tolerante) contra el distrito
      // pasado al botón ("Miraflores").
      const districtCombobox = await findDistrictCombobox();
      await waitFor(() => expect(districtCombobox).toHaveTextContent('MIRAFLORES'));
    });

    it('pasa onSuccess al modal y lo dispara tras crear el pedido exitosamente', async () => {
      jest.mocked(getEvaCredentials).mockResolvedValue(MOCK_CREDENTIAL_RECOJO);
      const mockCreateOrder = jest.mocked(createEvaOrder);
      mockCreateOrder.mockResolvedValue(MOCK_CREATE_RESULT);

      const onSuccess = jest.fn();
      const user = userEvent.setup();
      render(
        <SendToEvaButton
          orderId="order-1"
          companyId="company-1"
          {...BASE_ORDER_DATA}
          onSuccess={onSuccess}
        />,
      );
      await user.click(screen.getByRole('button', { name: /enviar a eva/i }));

      // clientType RECOJO requiere completar "Producto" para habilitar el submit
      const productInput = await screen.findByLabelText(/producto/i);
      await user.type(productInput, 'Caja mediana');

      const createBtn = screen.getByRole('button', { name: /crear pedido en eva/i });
      await waitFor(() => expect(createBtn).not.toBeDisabled());
      await user.click(createBtn);

      await waitFor(() => {
        expect(onSuccess).toHaveBeenCalled();
      });
    });
  });
});
