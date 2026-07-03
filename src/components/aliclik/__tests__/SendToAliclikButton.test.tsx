/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Tests: SendToAliclikButton
 *
 * Comportamiento verificado:
 * 1. Renderiza un botón con label "Enviar a Aliclik" por default.
 * 2. Renderiza un botón con label personalizado cuando se pasa prop "label".
 * 3. Al hacer click en el botón, abre el modal (muestra el título del modal).
 * 4. El modal recibe las props orderId y onSuccess correctas.
 * 5. El modal queda cerrado inicialmente (no renderiza su contenido).
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

jest.mock('@/services/aliclikService', () => ({
  quoteAliclikOrder: jest.fn(),
  createAliclikOrder: jest.fn(),
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

jest.mock('@/components/ui/dialog', () => {
  const React = require('react');
  const Dialog = ({ open, children }: { open?: boolean; children?: React.ReactNode }) =>
    open ? <div data-testid="dialog">{children}</div> : null;
  const DialogContent = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  const DialogHeader = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  const DialogTitle = ({ children }: { children?: React.ReactNode }) => <h2>{children}</h2>;
  return { Dialog, DialogContent, DialogHeader, DialogTitle };
});

jest.mock('@/components/ui/card', () => {
  const React = require('react');
  const Card = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  const CardContent = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  return { Card, CardContent };
});

jest.mock('@/components/ui/input', () => {
  const React = require('react');
  const Input = (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />;
  return { Input };
});

jest.mock('@/components/ui/label', () => {
  const React = require('react');
  const Label = ({ children }: { children?: React.ReactNode }) => <label>{children}</label>;
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
import { quoteAliclikOrder } from '@/services/aliclikService';
import SendToAliclikButton from '../SendToAliclikButton';

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

/**
 * MOCK_QUOTE incluye un almacén con un courier para que canSubmit=true
 * (el componente requiere al menos un almacén CON cobertura y courier seleccionado).
 */
const MOCK_COURIER_BTN = {
  id: 10,
  transportId: 100,
  transportName: 'Courier Express',
  transportUrlImage: '',
  addDays: 2,
  deliveryCost: 15.5,
  returnCost: 8.0,
  flagDeliveryExpress: false,
  schedule: null,
  scheduleExpressStart: null,
  scheduleExpressEnd: null,
};

const MOCK_QUOTE = {
  orderId: 'order-1',
  orderNumber: 'ORD-001',
  companyId: 'company-1',
  shippingTotalSugerido: 10.0,
  customer: {
    lat: -12.0, lng: -77.0,
    fullName: 'Pedro López', province: 'Lima', city: 'Lima', district: 'Surco',
  },
  warehouses: [
    {
      warehouseId: 1,
      warehouseName: 'Almacén Principal',
      ubigeo: { department: 'Lima', province: 'Lima', district: 'San Isidro' },
      items: [
        { sku: 'SKU-001', ean: '', quantity: 1, unitPrice: 50.0, productName: 'Producto A' },
      ],
      couriers: [MOCK_COURIER_BTN],
    },
  ],
  unresolvedItems: [],
};

// ── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(useAuth).mockReturnValue(MOCK_AUTH as unknown as ReturnType<typeof useAuth>);
  // quoteAliclikOrder nunca resuelve por defecto (modal se queda en loading)
  jest.mocked(quoteAliclikOrder).mockReturnValue(new Promise(() => {}));
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe('SendToAliclikButton', () => {

  describe('render inicial', () => {
    it('renderiza el botón con label por defecto "Enviar a Aliclik"', () => {
      render(<SendToAliclikButton orderId="order-1" />);
      expect(screen.getByRole('button', { name: /enviar a aliclik/i })).toBeInTheDocument();
    });

    it('renderiza el botón con label personalizado', () => {
      render(<SendToAliclikButton orderId="order-1" label="Despachar" />);
      expect(screen.getByRole('button', { name: /despachar/i })).toBeInTheDocument();
    });

    it('el modal no está visible inicialmente', () => {
      render(<SendToAliclikButton orderId="order-1" />);
      expect(screen.queryByTestId('dialog')).not.toBeInTheDocument();
    });
  });

  describe('apertura del modal', () => {
    it('al hacer click en el botón aparece el título del modal', async () => {
      const user = userEvent.setup();
      render(<SendToAliclikButton orderId="order-1" />);
      await user.click(screen.getByRole('button', { name: /enviar a aliclik/i }));
      // El dialog aparece en el DOM
      expect(await screen.findByTestId('dialog')).toBeInTheDocument();
      // Dentro del dialog hay exactamente un <h2> con el título del modal
      const dialog = screen.getByTestId('dialog');
      const title = dialog.querySelector('h2');
      expect(title).not.toBeNull();
      expect(title?.textContent).toMatch(/enviar a aliclik/i);
    });

    it('llama a quoteAliclikOrder con el orderId correcto al abrir', async () => {
      const user = userEvent.setup();
      render(<SendToAliclikButton orderId="order-xyz" companyId="company-1" />);
      await user.click(screen.getByRole('button', { name: /enviar a aliclik/i }));
      await waitFor(() => {
        expect(quoteAliclikOrder).toHaveBeenCalledWith(
          'fake-token',
          'company-1',
          'order-xyz',
        );
      });
    });

    it('pasa onSuccess al modal y lo dispara tras crear', async () => {
      // Para este test: quoteAliclikOrder resuelve y createAliclikOrder resuelve
      jest.mocked(quoteAliclikOrder).mockResolvedValue(MOCK_QUOTE);
      const { createAliclikOrder: mockCreate } = jest.requireMock('@/services/aliclikService');
      mockCreate.mockResolvedValue({ shipments: [{ warehouseId: 1, externalOrderNumber: 'ALI-999' }] });

      const onSuccess = jest.fn();
      const user = userEvent.setup();
      render(<SendToAliclikButton orderId="order-1" companyId="company-1" onSuccess={onSuccess} />);
      await user.click(screen.getByRole('button', { name: /enviar a aliclik/i }));

      // Esperar que la cotización cargue; el almacén con courier queda preseleccionado → botón habilitado
      const createBtn = await screen.findByRole('button', { name: /crear pedido en aliclik/i });
      await waitFor(() => expect(createBtn).not.toBeDisabled());
      await user.click(createBtn);

      await waitFor(() => {
        expect(onSuccess).toHaveBeenCalled();
      });
    });
  });
});
