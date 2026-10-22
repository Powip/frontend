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
 * - @/lib/axiosAuth → mockeado (get/post/patch/put) porque aprobar/rechazar
 *   pagos ahora usan la instancia con Bearer token (fix 401 en /finanzas),
 *   junto con la lectura, registro y subida de comprobantes.
 * - window.confirm → mockeado (jsdom no lo implementa por defecto), solo para
 *   comprobar que YA NO se llama al aprobar.
 */

import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GATEWAY } from '@/lib/gateway';
let mockCanLegacyRecord = true;
let mockCcPermissions: string[] | null = null;
jest.mock('@/contexts/AuthContext', () => ({useAuth: () => ({auth:{company:{id:'company-1'},user:{id:'finance-user-1',permissions:['APPROVE_PAYMENTS','CREATE_SALE','EDIT_SALE']},accessToken:'synthetic'},hasPermission:(permission:string) => mockCcPermissions ? mockCcPermissions.includes(permission) : mockCanLegacyRecord})}));

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

jest.mock('@/lib/axiosAuth', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
    put: jest.fn(),
  },
}));

jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
    warning: jest.fn(),
  },
}));

jest.mock('next/navigation', () => ({
  // FIX aprobacion-pagos-solo-finanzas: mockeado como jest.fn() (no un valor
  // fijo) para poder simular distintas rutas por test — el modal solo debe
  // habilitar Aprobar/Rechazar cuando pathname incluye "/finanzas".
  usePathname: jest.fn(() => '/finanzas'),
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
import axiosAuth from '@/lib/axiosAuth';
import { toast } from 'sonner';
import { usePathname } from 'next/navigation';
import PaymentVerificationModal from '../PaymentVerificationModal';

process.env.NEXT_PUBLIC_API_VENTAS = 'http://ventas';

const mockedAxios = axios as unknown as {
  get: jest.Mock;
  patch: jest.Mock;
  post: jest.Mock;
};
const mockedAxiosAuth = axiosAuth as unknown as {
  get: jest.Mock;
  post: jest.Mock;
  patch: jest.Mock;
  put: jest.Mock;
};
const mockToast = toast as jest.Mocked<typeof toast>;
const mockUsePathname = usePathname as jest.Mock;

// Default global: casi todos los tests existentes asumen /finanzas. Los tests
// de ruta lo sobreescriben puntualmente con mockReturnValue.
beforeEach(() => {
  mockCcPermissions = null;
  mockCanLegacyRecord = true;
  mockUsePathname.mockReturnValue('/finanzas');
});

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
    mockedAxiosAuth.get.mockResolvedValue({ data: makeOrderData('https://proof.example.com/1.jpg') });
    mockedAxiosAuth.patch.mockResolvedValue({ data: {} });

    renderModal();

    const approveButton = await screen.findByRole('button', { name: /aprobar/i });
    await userEvent.click(approveButton);

    expect(window.confirm).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(mockedAxiosAuth.patch).toHaveBeenCalledWith(
        'http://ventas/payments/payments/payment-1/approve',
      ),
    );
  });

  it('pago SIN comprobante: "Aprobar" está habilitado y aprueba sin confirm() (comprobante opcional)', async () => {
    mockedAxiosAuth.get.mockResolvedValue({ data: makeOrderData(null) });
    mockedAxiosAuth.patch.mockResolvedValue({ data: {} });

    const onPaymentUpdated = jest.fn();
    renderModal({ onPaymentUpdated });

    const approveButton = await screen.findByRole('button', { name: /aprobar/i });
    expect(approveButton).toBeEnabled();

    await userEvent.click(approveButton);

    expect(window.confirm).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(mockedAxiosAuth.patch).toHaveBeenCalledWith(
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
    mockedAxiosAuth.get.mockResolvedValue({ data: makeOrderData(null) });
    mockedAxiosAuth.patch.mockResolvedValue({ data: {} });

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
      expect(mockedAxiosAuth.patch).toHaveBeenCalledWith(
        'http://ventas/payments/payments/payment-1',
        { amount: 150 },
      ),
    );
    await waitFor(() => expect(onPaymentUpdated).toHaveBeenCalled());
    // 1 GET al montar + 1 GET de refetch tras guardar.
    expect(mockedAxiosAuth.get).toHaveBeenCalledTimes(2);
    expect(mockToast.success).toHaveBeenCalled();
  });

  it('si el PATCH del monto responde 400 muestra toast.error y hace refetch igual', async () => {
    mockedAxiosAuth.get.mockResolvedValue({ data: makeOrderData(null) });
    mockedAxiosAuth.patch.mockRejectedValue({
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
    expect(mockedAxiosAuth.get).toHaveBeenCalledTimes(2);
  });

  it('mientras el input de "Corregir monto" está abierto se ocultan "Aprobar" y "Rechazar" de esa fila', async () => {
    mockedAxiosAuth.get.mockResolvedValue({ data: makeOrderData(null) });

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
    mockedAxiosAuth.get.mockResolvedValue({ data: makeOrderData(null) });

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
    mockedAxiosAuth.get.mockResolvedValue({ data: makeOrderData(null) });

    renderModal();

    expect(
      await screen.findByText('Comprobante (opcional)'),
    ).toBeInTheDocument();
  });
});

describe('PaymentVerificationModal — comprobantes con sesión autenticada', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedAxiosAuth.get.mockResolvedValue({ data: makeOrderData(null) });
    mockedAxiosAuth.patch.mockResolvedValue({ data: {} });
    mockedAxiosAuth.post.mockResolvedValue({ data: {} });
  });

  it('carga el comprobante guardado con el cliente autenticado y lo muestra antes de aprobar', async () => {
    const proofUrl = 'https://proof.example.com/guardado.pdf';
    mockedAxiosAuth.get.mockResolvedValue({ data: makeOrderData(proofUrl) });

    renderModal();

    expect(await screen.findByRole('link', { name: /ver comprobante/i }))
      .toHaveAttribute('href', proofUrl);
    expect(mockedAxiosAuth.get).toHaveBeenCalledWith('http://ventas/order-header/order-1');
    expect(mockedAxios.get).not.toHaveBeenCalled();
  });

  it('sube el archivo al pago pendiente con el cliente autenticado y vuelve a consultar el comprobante', async () => {
    const onPaymentUpdated = jest.fn();
    const { container } = renderModal({ onPaymentUpdated });
    await screen.findByText('Sin comprobante adjunto');
    const file = new File(['receipt'], 'comprobante.jpg', { type: 'image/jpeg' });

    await userEvent.upload(container.querySelector('input[type="file"].hidden') as HTMLInputElement, file);

    await waitFor(() => expect(onPaymentUpdated).toHaveBeenCalledTimes(1));
    const [url, data] = mockedAxiosAuth.patch.mock.calls[0];
    expect(url).toBe('http://ventas/payments/payments/payment-1/upload-proof');
    expect((data as FormData).get('file')).toBe(file);
    expect(mockedAxios.patch).not.toHaveBeenCalled();
    expect(mockedAxiosAuth.get).toHaveBeenCalledTimes(2);
  });

  it('permite adjuntar un PDF a un pago aprobado sin comprobante sin volver a aprobarlo', async () => {
    const order = makeOrderData(null);
    order.payments[0].status = 'PAID';
    mockedAxiosAuth.get.mockResolvedValue({ data: order });
    const onPaymentUpdated = jest.fn();
    const { container } = renderModal({ onPaymentUpdated });
    await screen.findByText('✓ Aprobado');
    expect(screen.getByRole('button', { name: 'Agregar comprobante' })).toBeEnabled();
    const file = new File(['receipt'], 'comprobante.pdf', { type: 'application/pdf' });

    await userEvent.upload(container.querySelector('input[type="file"].hidden') as HTMLInputElement, file);

    await waitFor(() => expect(onPaymentUpdated).toHaveBeenCalledTimes(1));
    expect(mockedAxiosAuth.patch).toHaveBeenCalledTimes(1);
    const [url, data] = mockedAxiosAuth.patch.mock.calls[0];
    expect(url).toBe('http://ventas/payments/payments/payment-1/upload-proof');
    expect((data as FormData).get('file')).toBe(file);
    expect(mockedAxiosAuth.post).not.toHaveBeenCalled();
  });

  it('registra un pago con PDF usando la sesión y sin aprobarlo automáticamente', async () => {
    renderModal();
    const amountInput = await screen.findByLabelText('Monto *');
    await userEvent.type(amountInput, '25');
    await userEvent.selectOptions(screen.getByRole('combobox'), 'YAPE');
    const file = new File(['receipt'], 'comprobante.pdf', { type: 'application/pdf' });
    await userEvent.upload(screen.getByLabelText('Comprobante (opcional)'), file);

    await userEvent.click(screen.getByRole('button', { name: 'Registrar Pago' }));

    await waitFor(() => expect(mockedAxiosAuth.post).toHaveBeenCalledTimes(1));
    const [url, data] = mockedAxiosAuth.post.mock.calls[0];
    expect(url).toBe('http://ventas/payments/orders/order-1/payments/with-proof');
    expect((data as FormData).get('file')).toBe(file);
    expect((data as FormData).get('amount')).toBe('25');
    expect(mockedAxios.post).not.toHaveBeenCalled();
    expect(mockedAxiosAuth.patch).not.toHaveBeenCalled();
  });

  it.each([
    ['pago existente', 'tipo', 'Tipo de archivo no permitido. Use JPG, PNG, WEBP o PDF.'],
    ['pago existente', 'tamaño', 'El archivo es muy grande. Máximo 5MB.'],
    ['nuevo pago', 'tipo', 'Tipo de archivo no permitido. Use JPG, PNG, WEBP o PDF.'],
    ['nuevo pago', 'tamaño', 'El archivo es muy grande. Máximo 5MB.'],
  ])('rechaza el %s con archivo de %s inválido antes de enviarlo', async (target, invalid, message) => {
    const { container } = renderModal();
    await screen.findByText('Sin comprobante adjunto');
    const file = invalid === 'tipo'
      ? new File(['gif'], 'comprobante.gif', { type: 'image/gif' })
      : new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'comprobante.pdf', { type: 'application/pdf' });
    const input = target === 'pago existente'
      ? container.querySelector('input[type="file"].hidden') as HTMLInputElement
      : screen.getByLabelText('Comprobante (opcional)') as HTMLInputElement;

    await userEvent.setup({ applyAccept: false }).upload(input, file);

    expect(mockToast.error).toHaveBeenCalledWith(message);
    expect(mockedAxiosAuth.patch).not.toHaveBeenCalled();
    expect(mockedAxiosAuth.post).not.toHaveBeenCalled();
    expect(input).toHaveValue('');
  });

  it('ignora el GET anterior que termina después de cambiar de orden y adjunta al pago visible', async () => {
    type Response = { data: ReturnType<typeof makeOrderData> };
    let resolveFirst!: (response: Response) => void;
    let resolveSecond!: (response: Response) => void;
    const firstRequest = new Promise<Response>((resolve) => { resolveFirst = resolve; });
    const secondRequest = new Promise<Response>((resolve) => { resolveSecond = resolve; });
    const firstOrder = makeOrderData('https://proof.example.com/orden-anterior.jpg');
    const secondOrder = makeOrderData(null);
    secondOrder.payments[0].id = 'payment-2';
    secondOrder.payments[0].paymentMethod = 'PLIN';
    mockedAxiosAuth.get.mockReturnValueOnce(firstRequest)
      .mockReturnValueOnce(secondRequest)
      .mockResolvedValue({ data: secondOrder });
    const onClose = jest.fn();
    const { container, rerender } = render(
      <PaymentVerificationModal open onClose={onClose} orderId="order-1" orderNumber="ORD-001" />,
    );
    await waitFor(() => expect(mockedAxiosAuth.get).toHaveBeenCalledTimes(1));

    rerender(<PaymentVerificationModal open onClose={onClose} orderId="order-2" orderNumber="ORD-002" />);
    await waitFor(() => expect(mockedAxiosAuth.get).toHaveBeenCalledTimes(2));
    await act(async () => { resolveSecond({ data: secondOrder }); });
    expect(screen.getByText('S/ 100.00 - PLIN')).toBeInTheDocument();
    await act(async () => { resolveFirst({ data: firstOrder }); });

    expect(screen.getByRole('heading', { name: /ORD-002/ })).toBeInTheDocument();
    expect(screen.getByText('S/ 100.00 - PLIN')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Ver comprobante' })).not.toBeInTheDocument();
    const file = new File(['receipt'], 'comprobante.jpg', { type: 'image/jpeg' });
    await userEvent.upload(container.querySelector('input[type="file"].hidden') as HTMLInputElement, file);
    await waitFor(() => expect(mockedAxiosAuth.patch).toHaveBeenCalledTimes(1));
    expect(mockedAxiosAuth.patch.mock.calls[0][0]).toBe('http://ventas/payments/payments/payment-2/upload-proof');
  });

  it('no conserva los comprobantes de la orden anterior si falla la carga de la siguiente', async () => {
    mockedAxiosAuth.get.mockResolvedValueOnce({ data: makeOrderData('https://proof.example.com/orden-anterior.jpg') })
      .mockRejectedValueOnce(new Error('order unavailable'));
    const onClose = jest.fn();
    const { rerender } = render(
      <PaymentVerificationModal open onClose={onClose} orderId="order-1" orderNumber="ORD-001" />,
    );
    await screen.findByRole('link', { name: 'Ver comprobante' });

    rerender(<PaymentVerificationModal open onClose={onClose} orderId="order-2" orderNumber="ORD-002" />);

    await waitFor(() => expect(mockToast.error).toHaveBeenCalledWith('Error al cargar datos de la orden'));
    expect(screen.getByRole('heading', { name: /ORD-002/ })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Ver comprobante' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Agregar comprobante' })).not.toBeInTheDocument();
  });

  it('permite volver a elegir el mismo comprobante después de que falle la subida', async () => {
    mockedAxiosAuth.patch.mockRejectedValueOnce(new Error('upload unavailable'));
    const onPaymentUpdated = jest.fn();
    const { container } = renderModal({ onPaymentUpdated });
    await screen.findByText('Sin comprobante adjunto');
    const input = container.querySelector('input[type="file"].hidden') as HTMLInputElement;
    const file = new File(['receipt'], 'comprobante.jpg', { type: 'image/jpeg' });

    await userEvent.upload(input, file);
    await waitFor(() => expect(mockToast.error).toHaveBeenCalledWith('Error al subir el comprobante'));
    expect(onPaymentUpdated).not.toHaveBeenCalled();
    await userEvent.upload(input, file);

    await waitFor(() => expect(onPaymentUpdated).toHaveBeenCalledTimes(1));
    expect(mockedAxiosAuth.patch).toHaveBeenCalledTimes(2);
    expect(mockedAxiosAuth.patch.mock.calls[1][1].get('file')).toBe(file);
  });
});

// ── FIX aprobacion-pagos-solo-finanzas ──────────────────────────────────────
// Aprobar/rechazar pagos ya solo puede pasar desde /finanzas — ver
// docs/features/FIX-aprobacion-pagos-solo-finanzas/spec.md. Antes del fix,
// isAllowedRoute también incluía /operaciones, /ventas, /atencion-cliente,
// /seguimiento y /couriers.

describe('PaymentVerificationModal — restricción de Aprobar/Rechazar a /finanzas', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.confirm = jest.fn();
    mockUsePathname.mockReturnValue('/finanzas');
  });

  it('en /finanzas con canApprove=true SÍ muestra los botones Aprobar/Rechazar', async () => {
    mockedAxiosAuth.get.mockResolvedValue({ data: makeOrderData(null) });

    renderModal({ canApprove: true });

    expect(
      await screen.findByRole('button', { name: /aprobar/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /rechazar/i }),
    ).toBeInTheDocument();
  });

  it.each(['/operaciones', '/ventas', '/atencion-cliente', '/seguimiento', '/couriers'])(
    'en %s con canApprove=true YA NO muestra Aprobar/Rechazar/Corregir monto (antes sí lo permitía)',
    async (route) => {
      mockUsePathname.mockReturnValue(route);
      mockedAxiosAuth.get.mockResolvedValue({ data: makeOrderData(null) });

      renderModal({ canApprove: true });

      // El resto del modal (crear pago, subir comprobante) sigue disponible
      // fuera de Finanzas — el resumen del pago carga igual.
      expect(await screen.findByText(/YAPE/)).toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: /aprobar/i }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: /rechazar/i }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: /corregir monto/i }),
      ).not.toBeInTheDocument();
    },
  );
});

describe('PaymentVerificationModal — 403 al aprobar/rechazar (guard VIEW_FINANCES del backend)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.confirm = jest.fn();
    mockUsePathname.mockReturnValue('/finanzas');
  });

  it('si el PATCH de aprobar responde 403, muestra "No tenés permiso para aprobar pagos" (no el error genérico)', async () => {
    mockedAxiosAuth.get.mockResolvedValue({ data: makeOrderData(null) });
    mockedAxiosAuth.patch.mockRejectedValue({
      isAxiosError: true,
      response: { status: 403 },
    });

    renderModal({ canApprove: true });

    await userEvent.click(
      await screen.findByRole('button', { name: /aprobar/i }),
    );

    await waitFor(() =>
      expect(mockToast.error).toHaveBeenCalledWith(
        'No tenés permiso para aprobar pagos',
      ),
    );
    expect(mockToast.error).not.toHaveBeenCalledWith('Error al aprobar el pago');
  });

  it('si el PATCH de rechazar responde 403, muestra "No tenés permiso para rechazar pagos" (no el error genérico)', async () => {
    mockedAxiosAuth.get.mockResolvedValue({ data: makeOrderData(null) });
    mockedAxiosAuth.patch.mockRejectedValue({
      isAxiosError: true,
      response: { status: 403 },
    });
    (window.confirm as jest.Mock).mockReturnValue(true);

    renderModal({ canApprove: true });

    await userEvent.click(
      await screen.findByRole('button', { name: /rechazar/i }),
    );

    await waitFor(() =>
      expect(mockToast.error).toHaveBeenCalledWith(
        'No tenés permiso para rechazar pagos',
      ),
    );
    expect(mockToast.error).not.toHaveBeenCalledWith('Error al rechazar el pago');
  });

  it('si el PATCH de aprobar falla con otro status (no 403), mantiene el mensaje de error genérico', async () => {
    mockedAxiosAuth.get.mockResolvedValue({ data: makeOrderData(null) });
    mockedAxiosAuth.patch.mockRejectedValue({
      isAxiosError: true,
      response: { status: 500 },
    });

    renderModal({ canApprove: true });

    await userEvent.click(
      await screen.findByRole('button', { name: /aprobar/i }),
    );

    await waitFor(() =>
      expect(mockToast.error).toHaveBeenCalledWith('Error al aprobar el pago'),
    );
  });
});

describe("PaymentVerificationModal — conserva anticipos vinculados al convertir", () => {
  const anchoredOrder = (version: number | null = 7) => {
    const order = makeOrderData(null);
    return {
      ...order,
      commercialStage: "SALE",
      commercialLeadId: "lead-1",
      currency: "USD",
      payments: order.payments.map((payment) => ({
        ...payment,
        leadId: "lead-1",
        leadPaymentVersion: version,
      })),
    };
  };
  beforeEach(() => {
    jest.clearAllMocks();
    window.confirm = jest.fn().mockReturnValue(true);
    mockedAxiosAuth.get.mockResolvedValue({ data: anchoredOrder() });
    mockedAxiosAuth.patch.mockResolvedValue({ data: {} });
  });
  it("aprueba la misma identidad con versión mediante la API de Leads", async () => {
    renderModal();
    await userEvent.click(
      await screen.findByRole("button", { name: /aprobar/i }),
    );
    expect(mockedAxiosAuth.patch).toHaveBeenCalledWith(
      `${GATEWAY.ventas}/leads/lead-1/payments/payment-1/approve`,
      { version: 7 },
    );
    expect(mockedAxiosAuth.post).not.toHaveBeenCalled();
  });
  it("rechaza mediante la API de Leads sin reemplazar el pago", async () => {
    renderModal();
    await userEvent.click(
      await screen.findByRole("button", { name: /rechazar/i }),
    );
    expect(mockedAxiosAuth.patch).toHaveBeenCalledWith(
      `${GATEWAY.ventas}/leads/lead-1/payments/payment-1/reject`,
      { version: 7, notes: "Pago rechazado" },
    );
  });
  it("corrige el monto con su versión financiera", async () => {
    renderModal();
    await userEvent.click(
      await screen.findByRole("button", { name: /corregir monto/i }),
    );
    const amount = screen.getByDisplayValue("100");
    await userEvent.clear(amount);
    await userEvent.type(amount, "85");
    await userEvent.click(screen.getByRole("button", { name: /guardar/i }));
    expect(mockedAxiosAuth.patch).toHaveBeenCalledWith(
      `${GATEWAY.ventas}/leads/lead-1/payments/payment-1/amount`,
      { version: 7, amount: 85 },
    );
  });
  it("adjunta comprobante al mismo anticipo con versión y permite cobrar el saldo por el pedido", async () => {
    const { container } = renderModal();
    await screen.findByText("Sin comprobante adjunto");
    expect(screen.getByText("Comprobante (opcional)")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Lead/i })).toHaveAttribute(
      "href",
      "/leads-comerciales?leadId=lead-1",
    );
    const file = new File(["proof"], "p.pdf", { type: "application/pdf" });
    await userEvent.upload(
      container.querySelector('input[type="file"].hidden') as HTMLInputElement,
      file,
    );
    const [url, data] = mockedAxiosAuth.patch.mock.calls[0];
    expect(url).toBe(
      `${GATEWAY.ventas}/leads/lead-1/payments/payment-1/upload-proof`,
    );
    expect((data as FormData).get("version")).toBe("7");
    expect((data as FormData).get("file")).toBe(file);
  });
  it("falla cerrado si falta la versión, sin recurrir al endpoint anterior", async () => {
    mockedAxiosAuth.get.mockResolvedValue({ data: anchoredOrder(null) });
    const logging = jest.spyOn(console, "error").mockImplementation(() => {});
    try {
      renderModal();
      await userEvent.click(
        await screen.findByRole("button", { name: /aprobar/i }),
      );
      expect(mockedAxiosAuth.patch).not.toHaveBeenCalled();
      expect(mockToast.error).toHaveBeenCalled();
    } finally {
      logging.mockRestore();
    }
  });
  it("cobra sólo el saldo nuevo sin reenviar ni duplicar los anticipos de la venta", async () => {
    const order = anchoredOrder();
    order.payments[0].amount = 40;
    order.payments[0].status = "PAID";
    mockedAxiosAuth.get.mockResolvedValue({ data: order });
    mockedAxiosAuth.post.mockResolvedValue({ data: {} });
    renderModal();
    await userEvent.type(await screen.findByLabelText("Monto *"), "60");
    await userEvent.selectOptions(screen.getByRole("combobox"), "PLIN");
    await userEvent.click(
      screen.getByRole("button", { name: /registrar pago/i }),
    );
    expect(mockedAxiosAuth.post).toHaveBeenCalledTimes(1);
    const [url, body] = mockedAxiosAuth.post.mock.calls[0];
    expect(url).toBe(
      "http://ventas/payments/orders/order-1/payments/with-proof",
    );
    expect((body as FormData).get("amount")).toBe("60");
    expect((body as FormData).get("payments")).toBeNull();
    expect(mockedAxiosAuth.patch).not.toHaveBeenCalled();
  });
  it("descarta el resultado de una aprobación después de desmontar el pedido visible", async () => {
    let resolve!: (value: unknown) => void;
    mockedAxiosAuth.patch.mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    const onPaymentUpdated = jest.fn();
    const view = renderModal({ onPaymentUpdated });
    await userEvent.click(
      await screen.findByRole("button", { name: /aprobar/i }),
    );
    view.unmount();
    await act(async () => {
      resolve({ data: {} });
    });
    expect(onPaymentUpdated).not.toHaveBeenCalled();
    expect(mockToast.success).not.toHaveBeenCalled();
  });
});


describe("PaymentVerificationModal — captura canónica sobre pedido Lead", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedAxiosAuth.get.mockImplementation((url: string) => Promise.resolve({data: url.endsWith("/payment-capabilities") ? {enabled:true,canView:true,canCapture:true,canReview:true} : url.includes("/leads/lead-1/payments") ? {data:[{id:"advance-1",leadPaymentVersion:2}]} : {...makeOrderData(null),commercialStage:"LEAD",commercialLeadId:"lead-1",currency:"PEN",payments:[]}}));
    mockedAxiosAuth.post.mockResolvedValue({data:{id:"advance-1",leadPaymentVersion:1}});
  });
  async function fillAdvance(container: HTMLElement) {
    await screen.findByText("Registrar Nuevo Pago");
    await userEvent.type(screen.getByLabelText("Monto *"),"10");
    await userEvent.selectOptions(screen.getByRole("combobox"),"PLIN");
    await userEvent.upload(container.querySelector('input#proof') as HTMLInputElement,new File(["proof"],"p.pdf",{type:"application/pdf"}));
  }
  it("reintenta sólo el comprobante del anticipo guardado sin repetir la captura", async () => {
    mockCanLegacyRecord = false; // MANAGE_LEADS is authorized by the server capability, independent of legacy sale permissions.
    mockedAxiosAuth.patch.mockRejectedValueOnce(new Error("Respuesta interrumpida")).mockResolvedValue({data:{id:"advance-1",leadPaymentVersion:3}});
    mockedAxiosAuth.post.mockResolvedValueOnce({data:{id:"advance-1",leadPaymentVersion:1}}).mockResolvedValue({data:{id:"advance-1",leadPaymentVersion:2}});
    const rendered=renderModal();await fillAdvance(rendered.container);
    await userEvent.click(screen.getByRole("button",{name:"Registrar Pago"}));
    await waitFor(() => expect(mockedAxiosAuth.post).toHaveBeenCalledTimes(1));
    expect(mockedAxiosAuth.post).toHaveBeenCalledWith(`${GATEWAY.ventas}/leads/lead-1/payments`,expect.objectContaining({amount:10,currency:"PEN",paymentMethod:"PLIN",captureId:expect.any(String)}));
    await screen.findByRole("button",{name:"Reintentar comprobante"});
    // Conversion while proof is pending must preserve the original capture on reopening.
    mockedAxiosAuth.get.mockImplementation((url:string)=>Promise.resolve({data:url.endsWith("/payment-capabilities")?{enabled:true,canCapture:true,canView:false,canReview:false}:{...makeOrderData(null),commercialStage:"SALE",commercialLeadId:"lead-1",currency:"PEN",payments:[]}}));
    rendered.rerender(<PaymentVerificationModal open={false} onClose={jest.fn()} orderId="order-1" orderNumber="ORD-001" />);
    rendered.rerender(<PaymentVerificationModal open={true} onClose={jest.fn()} orderId="order-1" orderNumber="ORD-001" />);
    const retry=await screen.findByRole("button",{name:"Reintentar comprobante"});
    await waitFor(()=>expect(retry).toBeEnabled());await userEvent.click(retry);
    await waitFor(()=>expect(mockedAxiosAuth.patch).toHaveBeenCalledTimes(2));
    expect(mockedAxiosAuth.post).toHaveBeenCalledTimes(2);
    expect(mockedAxiosAuth.post.mock.calls[1]).toEqual(mockedAxiosAuth.post.mock.calls[0]);
    expect(mockedAxiosAuth.get.mock.calls.some(([url])=>String(url).includes("/leads/lead-1/payments"))).toBe(false);
    for(const [url]of mockedAxiosAuth.patch.mock.calls)expect(url).toBe(`${GATEWAY.ventas}/leads/lead-1/payments/advance-1/upload-proof`);
    expect((mockedAxiosAuth.patch.mock.calls[1][1] as FormData).get("version")).toBe("2");
  });
  it("reusa captureId y payload cuando la captura tiene una respuesta incierta", async () => {
    mockedAxiosAuth.post.mockRejectedValueOnce(new Error("Respuesta interrumpida")).mockResolvedValue({data:{id:"advance-1",leadPaymentVersion:1}});
    mockedAxiosAuth.patch.mockResolvedValue({data:{id:"advance-1"}});
    const {container}=renderModal();await fillAdvance(container);
    await userEvent.click(screen.getByRole("button",{name:"Registrar Pago"}));
    const retry=await screen.findByRole("button",{name:"Reintentar anticipo"});await waitFor(()=>expect(retry).toBeEnabled());
    await userEvent.click(retry);
    await waitFor(()=>expect(mockedAxiosAuth.post).toHaveBeenCalledTimes(2));
    expect(mockedAxiosAuth.post.mock.calls[1]).toEqual(mockedAxiosAuth.post.mock.calls[0]);
    expect(mockedAxiosAuth.post.mock.calls.some(([url])=>String(url).includes("with-proof"))).toBe(false);
  });
});

it("does not expose Lead capture when sale permission is present but the backend capability denies it",async()=>{
 jest.clearAllMocks();mockCanLegacyRecord=true;
 mockedAxiosAuth.get.mockImplementation((url:string)=>Promise.resolve({data:url.endsWith("/payment-capabilities")?{enabled:true,canView:true,canCapture:false,canReview:false}:{...makeOrderData(null),commercialStage:"LEAD",commercialLeadId:"lead-1",currency:"PEN",payments:[]}}));
 renderModal();await screen.findByText("La captura de anticipos no está habilitada para esta cuenta.");
 expect(screen.getByRole("button",{name:"Registrar Pago"})).toBeDisabled();expect(mockedAxiosAuth.post).not.toHaveBeenCalled();
});

describe("PaymentVerificationModal — adelantos Shopify COD desde Gestión CC", () => {
  const codOrder = (overrides: Record<string, unknown> = {}) => ({
    ...makeOrderData(null),
    companyId: "company-1",
    commercialStage: "LEAD",
    commercialLeadId: "lead-1",
    canalOrigen: "shopify_cod",
    currency: "PEN",
    ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockUsePathname.mockReturnValue("/atencion-cliente");
    mockCcPermissions = ["MANAGE_CUSTOMER_SERVICE"];
    mockedAxiosAuth.get.mockResolvedValue({ data: codOrder() });
    mockedAxiosAuth.post.mockResolvedValue({ data: { id: "advance-1" } });
    mockedAxiosAuth.patch.mockResolvedValue({ data: {} });
  });

  it("registra adelanto con comprobante en el mismo pedido pendiente sin salir de CC ni aprobarlo", async () => {
    const onPaymentUpdated = jest.fn();
    let resolve!: (value: unknown) => void;
    mockedAxiosAuth.post.mockReturnValue(new Promise((done) => { resolve = done; }));
    renderModal({ onPaymentUpdated });
    const file = new File(["receipt"], "adelanto.pdf", { type: "application/pdf" });

    await userEvent.type(await screen.findByLabelText("Monto *"), "35.50");
    await userEvent.selectOptions(screen.getByRole("combobox"), "YAPE");
    await userEvent.upload(screen.getByLabelText("Comprobante (opcional)"), file);
    const submit = screen.getByRole("button", { name: "Registrar Pago" });
    expect(submit).toBeEnabled();
    expect(screen.queryByRole("button", { name: /aprobar|rechazar/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /consultar el Lead/i })).not.toBeInTheDocument();

    await userEvent.dblClick(submit);
    expect(mockedAxiosAuth.post).toHaveBeenCalledTimes(1);
    const [url, body] = mockedAxiosAuth.post.mock.calls[0];
    expect(url).toBe("http://ventas/payments/orders/order-1/payments/with-proof");
    expect((body as FormData).get("amount")).toBe("35.5");
    expect((body as FormData).get("paymentMethod")).toBe("YAPE");
    expect((body as FormData).get("file")).toBe(file);
    expect((body as FormData).get("status")).toBeNull();
    expect((body as FormData).get("commercialStage")).toBeNull();
    expect(mockedAxiosAuth.patch).not.toHaveBeenCalled();
    await act(async () => { resolve({ data: { id: "advance-1" } }); });
    await waitFor(() => expect(onPaymentUpdated).toHaveBeenCalledTimes(1));
  });

  it.each(["LEAD", "SALE"])("adjunta comprobante al pago existente de un pedido COD %s con permiso de CC", async (commercialStage) => {
    mockedAxiosAuth.get.mockResolvedValue({ data: codOrder({ commercialStage }) });
    const { container } = renderModal();
    await screen.findByText("Sin comprobante adjunto");
    expect(screen.getByRole("button", { name: "Agregar comprobante" })).toBeEnabled();
    const file = new File(["receipt"], "adelanto.jpg", { type: "image/jpeg" });
    await userEvent.upload(
      container.querySelector('input[type="file"].hidden') as HTMLInputElement,
      file,
    );
    expect(mockedAxiosAuth.patch).toHaveBeenCalledTimes(1);
    const [url, body] = mockedAxiosAuth.patch.mock.calls[0];
    expect(url).toBe("http://ventas/payments/payments/payment-1/upload-proof");
    expect((body as FormData).get("file")).toBe(file);
    expect(mockedAxiosAuth.post).not.toHaveBeenCalled();
  });

  it("conserva la versión y ruta canónica al adjuntar un comprobante a un anticipo ya anclado", async () => {
    const order = codOrder({ commercialStage: "SALE" });
    mockedAxiosAuth.get.mockResolvedValue({
      data: {
        ...order,
        payments: order.payments.map((payment) => ({
          ...payment,
          leadId: "lead-1",
          leadPaymentVersion: 4,
        })),
      },
    });
    const { container } = renderModal();
    await screen.findByText("Sin comprobante adjunto");
    const file = new File(["receipt"], "adelanto.jpg", { type: "image/jpeg" });
    await userEvent.upload(
      container.querySelector('input[type="file"].hidden') as HTMLInputElement,
      file,
    );
    expect(mockedAxiosAuth.patch).toHaveBeenCalledTimes(1);
    const [url, body] = mockedAxiosAuth.patch.mock.calls[0];
    expect(url).toBe(`${GATEWAY.ventas}/leads/lead-1/payments/payment-1/upload-proof`);
    expect((body as FormData).get("version")).toBe("4");
    expect((body as FormData).get("file")).toBe(file);
    expect(mockedAxiosAuth.post).not.toHaveBeenCalled();
  });

  it.each([null, "manual", "shopify"])("no extiende el permiso de CC a otros pedidos (%s)", async (canalOrigen) => {
    mockedAxiosAuth.get.mockResolvedValue({ data: codOrder({ canalOrigen }) });
    renderModal();
    await userEvent.type(await screen.findByLabelText("Monto *"), "30");
    await userEvent.selectOptions(screen.getByRole("combobox"), "YAPE");
    expect(screen.getByRole("button", { name: "Registrar Pago" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Agregar comprobante" })).toBeDisabled();
    expect(mockedAxiosAuth.post).not.toHaveBeenCalled();
    expect(mockedAxiosAuth.patch).not.toHaveBeenCalled();
  });

  it("mantiene la sesión de consulta sin permiso para registrar pagos ni adjuntar comprobantes", async () => {
    mockCcPermissions = ["VIEW_CUSTOMER_SERVICE"];
    renderModal();
    await userEvent.type(await screen.findByLabelText("Monto *"), "30");
    await userEvent.selectOptions(screen.getByRole("combobox"), "YAPE");
    expect(screen.getByRole("button", { name: "Registrar Pago" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Agregar comprobante" })).toBeDisabled();
    expect(mockedAxiosAuth.post).not.toHaveBeenCalled();
    expect(mockedAxiosAuth.patch).not.toHaveBeenCalled();
  });

  it("no usa el permiso de CC como permiso de ventas o de Finanzas fuera de Gestión CC", async () => {
    mockUsePathname.mockReturnValue("/finanzas");
    renderModal();
    await userEvent.type(await screen.findByLabelText("Monto *"), "30");
    await userEvent.selectOptions(screen.getByRole("combobox"), "YAPE");
    expect(screen.getByRole("button", { name: "Registrar Pago" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Agregar comprobante" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: /aprobar|rechazar/i })).not.toBeInTheDocument();
    expect(mockedAxiosAuth.post).not.toHaveBeenCalled();
    expect(mockedAxiosAuth.patch).not.toHaveBeenCalled();
  });
});
