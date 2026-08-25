/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Tests: PaymentVerificationModal
 *
 * Comportamiento verificado:
 * 1. Pago CON comprobante adjunto: aprobar NO muestra el confirm() del navegador,
 *    y llama directo al endpoint de aprobación.
 * 2. Pago SIN comprobante: aprobar SÍ muestra confirm(); si el usuario cancela
 *    (confirm devuelve false) no se llama al endpoint de aprobación.
 * 3. Pago SIN comprobante: si el usuario confirma (confirm devuelve true) sí se
 *    llama al endpoint de aprobación.
 *
 * Work-arounds jsdom aplicados (mismo patrón que SendToAliclikModal.test.tsx):
 * - @/components/ui/dialog → mock que renderiza children directamente cuando open=true.
 * - @/components/ui/select → mock de <select> nativo (el formulario "Registrar
 *   Nuevo Pago" siempre se renderiza mientras haya saldo pendiente, y usa Select
 *   de Radix para el método de pago).
 * - axios → mockeado (get/patch/post) siguiendo el patrón dual default+top-level
 *   usado en el resto de tests de este repo para que funcione con la
 *   interop de ts-jest (esModuleInterop).
 * - window.confirm → mockeado (jsdom no lo implementa por defecto).
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ── Mocks de infraestructura ─────────────────────────────────────────────────

jest.mock('axios', () => ({
  default: {
    get: jest.fn(),
    patch: jest.fn(),
    post: jest.fn(),
  },
  get: jest.fn(),
  patch: jest.fn(),
  post: jest.fn(),
}));

jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
    warning: jest.fn(),
  },
}));

jest.mock('next/navigation', () => ({
  usePathname: () => '/finanzas',
}));

jest.mock('@/components/ui/dialog', () => {
  const React = require('react');
  const Dialog = ({ open, children }: { open?: boolean; children?: React.ReactNode }) =>
    open ? <div data-testid="dialog">{children}</div> : null;
  const DialogContent = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  const DialogHeader = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  const DialogTitle = ({ children }: { children?: React.ReactNode }) => <h2>{children}</h2>;
  return { Dialog, DialogContent, DialogHeader, DialogTitle };
});

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
      <select value={value} onChange={(e) => onValueChange?.(e.target.value)}>
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

import axios from 'axios';
import PaymentVerificationModal from '../PaymentVerificationModal';

const mockedAxios = axios as unknown as {
  get: jest.Mock;
  patch: jest.Mock;
  post: jest.Mock;
};

function makeOrderData(paymentProofUrl: string | null) {
  return {
    grandTotal: '100.00',
    payments: [
      {
        id: 'payment-1',
        paymentMethod: 'YAPE',
        amount: 100,
        status: 'PENDING',
        paymentProofUrl,
        paymentDate: '2026-08-01T00:00:00.000Z',
      },
    ],
  };
}

function renderModal() {
  return render(
    <PaymentVerificationModal
      open={true}
      onClose={jest.fn()}
      orderId="order-1"
      orderNumber="ORD-001"
      canApprove={true}
    />,
  );
}

describe('PaymentVerificationModal — aprobación de pagos', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.confirm = jest.fn();
  });

  it('pago CON comprobante: aprobar NO muestra confirm() y llama al endpoint de aprobación', async () => {
    mockedAxios.get.mockResolvedValue({ data: makeOrderData('https://proof.example.com/1.jpg') });
    mockedAxios.patch.mockResolvedValue({ data: {} });

    renderModal();

    const approveButton = await screen.findByRole('button', { name: /aprobar/i });
    await userEvent.click(approveButton);

    expect(window.confirm).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(mockedAxios.patch).toHaveBeenCalledWith(
        expect.stringContaining('/payments/payments/payment-1/approve'),
      ),
    );
  });

  it('pago SIN comprobante: aprobar muestra confirm(); si el usuario cancela, no se aprueba', async () => {
    mockedAxios.get.mockResolvedValue({ data: makeOrderData(null) });
    (window.confirm as jest.Mock).mockReturnValue(false);

    renderModal();

    const approveButton = await screen.findByRole('button', { name: /aprobar/i });
    await userEvent.click(approveButton);

    expect(window.confirm).toHaveBeenCalledTimes(1);
    expect(mockedAxios.patch).not.toHaveBeenCalled();
  });

  it('pago SIN comprobante: aprobar muestra confirm(); si el usuario confirma, sí se aprueba', async () => {
    mockedAxios.get.mockResolvedValue({ data: makeOrderData(null) });
    mockedAxios.patch.mockResolvedValue({ data: {} });
    (window.confirm as jest.Mock).mockReturnValue(true);

    renderModal();

    const approveButton = await screen.findByRole('button', { name: /aprobar/i });
    await userEvent.click(approveButton);

    expect(window.confirm).toHaveBeenCalledTimes(1);
    await waitFor(() =>
      expect(mockedAxios.patch).toHaveBeenCalledWith(
        expect.stringContaining('/payments/payments/payment-1/approve'),
      ),
    );
  });
});
