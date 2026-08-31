/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Tests: PaymentVerificationModal
 *
 * FIX finanzas-pagos (§2.2.C): el comprobante de pago es OPCIONAL. Se eliminó el
 * confirm() bloqueante al aprobar sin comprobante y se agregó "Corregir monto"
 * para editar un pago PENDING antes de aprobarlo.
 *
 * Comportamiento verificado:
 * 1. Pago CON comprobante adjunto: aprobar NO muestra el confirm() del navegador
 *    y llama directo al endpoint de aprobación.
 * 2. Pago SIN comprobante: aprobar tampoco muestra confirm() — el botón
 *    "Aprobar" está habilitado y llama directo a
 *    PATCH /payments/payments/:id/approve.
 * 3. "Corregir monto" en un pago PENDING abre un input inline; "Guardar" hace
 *    PATCH ${API_VENTAS}/payments/payments/:id con { amount } y luego refetch +
 *    onPaymentUpdated().
 * 4. Si ese PATCH responde 400, se muestra toast.error("No se puede editar el
 *    monto...") y se hace refetch igual.
 * 5. El uploader del formulario "Registrar Nuevo Pago" está rotulado
 *    "Comprobante (opcional)".
 *
 * Work-arounds jsdom aplicados (mismo patrón que SendToAliclikModal.test.tsx):
 * - @/components/ui/dialog → mock que renderiza children directamente cuando open=true.
 * - @/components/ui/select → mock de <select> nativo (el formulario "Registrar
 *   Nuevo Pago" siempre se renderiza mientras haya saldo pendiente, y usa Select
 *   de Radix para el método de pago).
 * - axios → mockeado (get/patch/post + isAxiosError) siguiendo el patrón dual
 *   default+top-level usado en el resto de tests de este repo para que funcione
 *   con la interop de ts-jest (esModuleInterop).
 * - window.confirm → mockeado (jsdom no lo implementa por defecto), solo para
 *   comprobar que YA NO se llama al aprobar.
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ── Mocks de infraestructura ─────────────────────────────────────────────────

jest.mock('axios', () => {
  const isAxiosError = (e: unknown) =>
    Boolean(e && (e as { isAxiosError?: boolean }).isAxiosError);
  return {
    default: {
      get: jest.fn(),
      patch: jest.fn(),
      post: jest.fn(),
      isAxiosError,
    },
    get: jest.fn(),
    patch: jest.fn(),
    post: jest.fn(),
    isAxiosError,
  };
});

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
import { toast } from 'sonner';
import PaymentVerificationModal from '../PaymentVerificationModal';

process.env.NEXT_PUBLIC_API_VENTAS = 'http://ventas';

const mockedAxios = axios as unknown as {
  get: jest.Mock;
  patch: jest.Mock;
  post: jest.Mock;
};
const mockToast = toast as jest.Mocked<typeof toast>;

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

function renderModal(
  props: { onPaymentUpdated?: () => void; canApprove?: boolean } = {},
) {
  return render(
    <PaymentVerificationModal
      open={true}
      onClose={jest.fn()}
      orderId="order-1"
      orderNumber="ORD-001"
      canApprove={true}
      {...props}
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
        'http://ventas/payments/payments/payment-1/approve',
      ),
    );
  });

  it('pago SIN comprobante: "Aprobar" está habilitado y aprueba sin confirm() (comprobante opcional)', async () => {
    mockedAxios.get.mockResolvedValue({ data: makeOrderData(null) });
    mockedAxios.patch.mockResolvedValue({ data: {} });

    const onPaymentUpdated = jest.fn();
    renderModal({ onPaymentUpdated });

    const approveButton = await screen.findByRole('button', { name: /aprobar/i });
    expect(approveButton).toBeEnabled();

    await userEvent.click(approveButton);

    expect(window.confirm).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(mockedAxios.patch).toHaveBeenCalledWith(
        'http://ventas/payments/payments/payment-1/approve',
      ),
    );
    await waitFor(() => expect(onPaymentUpdated).toHaveBeenCalled());
  });
});

describe('PaymentVerificationModal — corregir monto de un pago PENDING', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.confirm = jest.fn();
  });

  it('"Corregir monto" abre el input; "Guardar" hace PATCH con { amount } y luego refetch + onPaymentUpdated', async () => {
    mockedAxios.get.mockResolvedValue({ data: makeOrderData(null) });
    mockedAxios.patch.mockResolvedValue({ data: {} });

    const onPaymentUpdated = jest.fn();
    renderModal({ onPaymentUpdated });

    const corregir = await screen.findByRole('button', { name: /corregir monto/i });
    await userEvent.click(corregir);

    // El input inline se precarga con el monto actual del pago.
    const amountInput = screen.getByDisplayValue('100');
    await userEvent.clear(amountInput);
    await userEvent.type(amountInput, '150');

    await userEvent.click(screen.getByRole('button', { name: /guardar/i }));

    await waitFor(() =>
      expect(mockedAxios.patch).toHaveBeenCalledWith(
        'http://ventas/payments/payments/payment-1',
        { amount: 150 },
      ),
    );
    await waitFor(() => expect(onPaymentUpdated).toHaveBeenCalled());
    // 1 GET al montar + 1 GET de refetch tras guardar.
    expect(mockedAxios.get).toHaveBeenCalledTimes(2);
    expect(mockToast.success).toHaveBeenCalled();
  });

  it('si el PATCH del monto responde 400 muestra toast.error y hace refetch igual', async () => {
    mockedAxios.get.mockResolvedValue({ data: makeOrderData(null) });
    mockedAxios.patch.mockRejectedValue({
      isAxiosError: true,
      response: { status: 400 },
    });

    renderModal();

    await userEvent.click(
      await screen.findByRole('button', { name: /corregir monto/i }),
    );

    const amountInput = screen.getByDisplayValue('100');
    await userEvent.clear(amountInput);
    await userEvent.type(amountInput, '150');

    await userEvent.click(screen.getByRole('button', { name: /guardar/i }));

    await waitFor(() =>
      expect(mockToast.error).toHaveBeenCalledWith(
        'No se puede editar el monto: el pago ya no está pendiente.',
      ),
    );
    // Refetch en el catch para reflejar el estado real del pago.
    expect(mockedAxios.get).toHaveBeenCalledTimes(2);
  });

  it('mientras el input de "Corregir monto" está abierto se ocultan "Aprobar" y "Rechazar" de esa fila', async () => {
    mockedAxios.get.mockResolvedValue({ data: makeOrderData(null) });

    renderModal();

    // Antes de editar: los 3 controles están visibles.
    expect(await screen.findByRole('button', { name: /aprobar/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /rechazar/i })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /corregir monto/i }));

    // Con el editor abierto: solo quedan "Guardar" / "Cancelar".
    expect(screen.queryByRole('button', { name: /aprobar/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /rechazar/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /guardar/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancelar/i })).toBeInTheDocument();

    // Al cancelar, "Aprobar" / "Rechazar" vuelven.
    await userEvent.click(screen.getByRole('button', { name: /cancelar/i }));
    expect(screen.getByRole('button', { name: /aprobar/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /rechazar/i })).toBeInTheDocument();
  });

  it('"Corregir monto" NO se muestra si canApprove es false', async () => {
    mockedAxios.get.mockResolvedValue({ data: makeOrderData(null) });

    renderModal({ canApprove: false });

    // El resumen del pago se renderiza (esperamos a que cargue).
    expect(await screen.findByText(/YAPE/)).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /corregir monto/i }),
    ).not.toBeInTheDocument();
    // Sin permiso tampoco hay acciones de aprobación.
    expect(screen.queryByRole('button', { name: /aprobar/i })).not.toBeInTheDocument();
  });
});

describe('PaymentVerificationModal — formulario "Registrar Nuevo Pago"', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.confirm = jest.fn();
  });

  it('el uploader de comprobante está rotulado "Comprobante (opcional)"', async () => {
    mockedAxios.get.mockResolvedValue({ data: makeOrderData(null) });

    renderModal();

    expect(
      await screen.findByText('Comprobante (opcional)'),
    ).toBeInTheDocument();
  });
});
