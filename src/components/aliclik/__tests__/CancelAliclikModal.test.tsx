/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Tests: CancelAliclikModal
 *
 * Comportamiento verificado:
 * 1. Muestra la pantalla de confirmación al abrirse (no llama al service hasta confirmar).
 * 2. Click en "No, volver" llama a onClose sin llamar al service.
 * 3. Al confirmar → llama a cancelAliclikOrder con (token, orderId, companyId).
 * 4. Muestra spinner "Cancelando en Aliclik..." mientras la promesa está pendiente.
 * 5. Tras éxito muestra resumen por almacén:
 *    - "cancelled"      → texto "Cancelado"
 *    - "cancel_pending" → texto "Cancelación diferida"
 *    - "rejected"       → texto "Rechazado" + reason
 * 6. "cancel_pending" muestra el aviso de cancelación diferida.
 * 7. Llama a toast.success cuando todos los resultados son "cancelled".
 * 8. Llama a toast.error cuando algún resultado es "rejected".
 * 9. Llama a toast.success (diferida) cuando ninguno es rejected pero hay cancel_pending.
 * 10. Llama a onSuccess tras éxito.
 * 11. Error del service → muestra toast.error y vuelve a la pantalla de confirmación.
 * 12. Companyid se resuelve desde useAuth().auth.company.id cuando no se pasa por prop.
 * 13. Si no hay companyId resuelto → toast.error y NO llama al service.
 * 14. Modal cerrado (open=false) → no renderiza nada.
 *
 * Work-arounds jsdom:
 * - @/components/ui/dialog → div simple cuando open=true.
 * - @/components/ui/button → <button> nativo.
 * - cancelAliclikOrder mockeado en @/services/aliclikService.
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
  cancelAliclikOrder: jest.fn(),
}));

jest.mock('@/components/ui/dialog', () => {
  const React = require('react');
  const Dialog = ({
    open,
    children,
  }: {
    open?: boolean;
    onOpenChange?: (v: boolean) => void;
    children?: React.ReactNode;
  }) => (open ? <div data-testid="dialog">{children}</div> : null);

  const DialogContent = ({
    children,
  }: {
    children?: React.ReactNode;
    className?: string;
    'aria-describedby'?: string;
  }) => <div data-testid="dialog-content">{children}</div>;

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
    'aria-label': ariaLabel,
  }: {
    children?: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    className?: string;
    variant?: string;
    'aria-label'?: string;
  }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      className={className}
      data-variant={variant}
      aria-label={ariaLabel}
    >
      {children}
    </button>
  );
  const buttonVariants = () => '';
  return { Button, buttonVariants };
});

jest.mock('lucide-react', () => ({
  Loader2: ({ className }: { className?: string }) => (
    <span data-testid="loader" className={className} />
  ),
  XCircle: () => <span data-testid="x-circle-icon" />,
  CheckCircle2: () => <span data-testid="check-icon" />,
  Clock: () => <span data-testid="clock-icon" />,
  AlertTriangle: () => <span data-testid="alert-icon" />,
}));

jest.mock('@/lib/utils', () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
}));

// ── Imports bajo prueba (después de los mocks) ───────────────────────────────

import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { cancelAliclikOrder } from '@/services/aliclikService';
import CancelAliclikModal from '../CancelAliclikModal';

// ── Casts ────────────────────────────────────────────────────────────────────

const mockUseAuth = jest.mocked(useAuth);
const mockCancelOrder = jest.mocked(cancelAliclikOrder);
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

/** Todos "cancelled" → toast.success con mensaje de cancelación correcta */
const RESULT_ALL_CANCELLED = {
  results: [
    { warehouseId: 1, externalOrderNumber: 'ALI-001', result: 'cancelled' as const },
    { warehouseId: 2, externalOrderNumber: 'ALI-002', result: 'cancelled' as const },
  ],
};

/** cancelled + cancel_pending → branch mixedCancelledAndPending → toast.success "parcial" */
const RESULT_WITH_PENDING = {
  results: [
    { warehouseId: 1, externalOrderNumber: 'ALI-001', result: 'cancelled' as const },
    { warehouseId: 2, externalOrderNumber: 'ALI-002', result: 'cancel_pending' as const },
  ],
};

/** Solo cancel_pending → branch else → toast.success "procesará" */
const RESULT_ONLY_PENDING = {
  results: [
    { warehouseId: 1, externalOrderNumber: 'ALI-001', result: 'cancel_pending' as const },
    { warehouseId: 2, externalOrderNumber: 'ALI-002', result: 'cancel_pending' as const },
  ],
};

/** Uno "rejected" → toast.error */
const RESULT_WITH_REJECTED = {
  results: [
    { warehouseId: 1, externalOrderNumber: 'ALI-001', result: 'cancelled' as const },
    { warehouseId: 3, externalOrderNumber: null, result: 'rejected' as const, reason: 'El pedido ya fue entregado' },
  ],
};

/** Mix: cancelled + cancel_pending + rejected para test de resumen completo */
const RESULT_MIXED = {
  results: [
    { warehouseId: 10, externalOrderNumber: 'ALI-010', result: 'cancelled' as const },
    { warehouseId: 20, externalOrderNumber: 'ALI-020', result: 'cancel_pending' as const },
    { warehouseId: 30, externalOrderNumber: null, result: 'rejected' as const, reason: 'Fuera de plazo' },
  ],
};

const BASE_PROPS = {
  open: true,
  onClose: jest.fn(),
  orderId: 'order-abc',
  companyId: 'company-1',
  onSuccess: jest.fn(),
};

// ── Helper ────────────────────────────────────────────────────────────────────

function renderModal(overrides: Partial<typeof BASE_PROPS> = {}) {
  return render(<CancelAliclikModal {...BASE_PROPS} {...overrides} />);
}

// ── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  mockUseAuth.mockReturnValue(MOCK_AUTH as unknown as ReturnType<typeof useAuth>);
  mockCancelOrder.mockResolvedValue(RESULT_ALL_CANCELLED);
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe('CancelAliclikModal', () => {

  // ── 1. Pantalla de confirmación ──────────────────────────────────────────────

  describe('pantalla de confirmación (fase inicial)', () => {
    it('muestra el título "Cancelar en Aliclik"', () => {
      renderModal();
      expect(screen.getByRole('heading', { name: /cancelar en aliclik/i })).toBeInTheDocument();
    });

    it('muestra el texto de advertencia sobre todos los almacenes', () => {
      renderModal();
      expect(
        screen.getByText(/cancelará el pedido en/i),
      ).toBeInTheDocument();
    });

    it('muestra el botón "No, volver"', () => {
      renderModal();
      expect(screen.getByRole('button', { name: /no, volver/i })).toBeInTheDocument();
    });

    it('muestra el botón de confirmar cancelación', () => {
      renderModal();
      expect(
        screen.getByRole('button', { name: /sí, cancelar en aliclik/i }),
      ).toBeInTheDocument();
    });

    it('NO llama a cancelAliclikOrder sin que el usuario confirme', () => {
      renderModal();
      expect(mockCancelOrder).not.toHaveBeenCalled();
    });

    it('modal cerrado (open=false) no renderiza nada', () => {
      const { container } = renderModal({ open: false });
      expect(container.firstChild).toBeNull();
    });
  });

  // ── 2. "No, volver" cierra sin cancelar ─────────────────────────────────────

  describe('botón "No, volver"', () => {
    it('click en "No, volver" llama a onClose', async () => {
      const user = userEvent.setup();
      const onClose = jest.fn();
      renderModal({ onClose });

      await user.click(screen.getByRole('button', { name: /no, volver/i }));

      expect(onClose).toHaveBeenCalled();
    });

    it('NO llama a cancelAliclikOrder al hacer click en "No, volver"', async () => {
      const user = userEvent.setup();
      renderModal();

      await user.click(screen.getByRole('button', { name: /no, volver/i }));

      expect(mockCancelOrder).not.toHaveBeenCalled();
    });
  });

  // ── 3. Confirmar llama al service correctamente ──────────────────────────────

  describe('al confirmar la cancelación', () => {
    it('llama a cancelAliclikOrder con token, orderId y companyId de props', async () => {
      const user = userEvent.setup();
      renderModal();

      await user.click(screen.getByRole('button', { name: /sí, cancelar en aliclik/i }));

      await waitFor(() => {
        expect(mockCancelOrder).toHaveBeenCalledWith('fake-token', 'order-abc', 'company-1');
      });
    });

    it('llama a cancelAliclikOrder una sola vez al confirmar', async () => {
      const user = userEvent.setup();
      renderModal();

      await user.click(screen.getByRole('button', { name: /sí, cancelar en aliclik/i }));

      await waitFor(() => {
        expect(mockCancelOrder).toHaveBeenCalledTimes(1);
      });
    });
  });

  // ── 4. Estado loading ────────────────────────────────────────────────────────

  describe('estado loading', () => {
    it('muestra el spinner mientras la promesa está pendiente', async () => {
      // cancelAliclikOrder nunca resuelve → se queda en fase "loading"
      mockCancelOrder.mockReturnValue(new Promise(() => {}));
      const user = userEvent.setup();
      renderModal();

      await user.click(screen.getByRole('button', { name: /sí, cancelar en aliclik/i }));

      expect(await screen.findByTestId('loader')).toBeInTheDocument();
    });

    it('muestra el texto "Cancelando en Aliclik..." mientras carga', async () => {
      mockCancelOrder.mockReturnValue(new Promise(() => {}));
      const user = userEvent.setup();
      renderModal();

      await user.click(screen.getByRole('button', { name: /sí, cancelar en aliclik/i }));

      expect(await screen.findByText(/cancelando en aliclik\.\.\./i)).toBeInTheDocument();
    });

    it('oculta los botones de confirmación durante el loading', async () => {
      mockCancelOrder.mockReturnValue(new Promise(() => {}));
      const user = userEvent.setup();
      renderModal();

      await user.click(screen.getByRole('button', { name: /sí, cancelar en aliclik/i }));

      await screen.findByTestId('loader');
      expect(screen.queryByRole('button', { name: /sí, cancelar en aliclik/i })).not.toBeInTheDocument();
    });
  });

  // ── 5. Resumen por almacén tras éxito ────────────────────────────────────────

  describe('resumen por almacén (fase result)', () => {
    it('muestra "Resultado por almacén:" tras éxito', async () => {
      const user = userEvent.setup();
      renderModal();

      await user.click(screen.getByRole('button', { name: /sí, cancelar en aliclik/i }));

      expect(await screen.findByText(/resultado por almacén/i)).toBeInTheDocument();
    });

    it('muestra "Cancelado" para resultado "cancelled"', async () => {
      const user = userEvent.setup();
      renderModal();

      await user.click(screen.getByRole('button', { name: /sí, cancelar en aliclik/i }));

      // RESULT_ALL_CANCELLED tiene 2 items cancelled → el componente renderiza 2 labels "Cancelado"
      const labels = await screen.findAllByText('Cancelado');
      expect(labels).toHaveLength(2);
    });

    it('muestra el warehouseId en el resumen', async () => {
      mockCancelOrder.mockResolvedValue(RESULT_MIXED);
      const user = userEvent.setup();
      renderModal();

      await user.click(screen.getByRole('button', { name: /sí, cancelar en aliclik/i }));

      expect(await screen.findByText(/almacén 10/i)).toBeInTheDocument();
    });

    it('muestra el externalOrderNumber en el resumen', async () => {
      const user = userEvent.setup();
      renderModal();

      await user.click(screen.getByRole('button', { name: /sí, cancelar en aliclik/i }));

      expect(await screen.findByText(/#ALI-001/)).toBeInTheDocument();
    });

    it('muestra "Cancelación diferida" para resultado "cancel_pending"', async () => {
      mockCancelOrder.mockResolvedValue(RESULT_WITH_PENDING);
      const user = userEvent.setup();
      renderModal();

      await user.click(screen.getByRole('button', { name: /sí, cancelar en aliclik/i }));

      expect(await screen.findByText('Cancelación diferida')).toBeInTheDocument();
    });

    it('muestra "Rechazado" para resultado "rejected"', async () => {
      mockCancelOrder.mockResolvedValue(RESULT_WITH_REJECTED);
      const user = userEvent.setup();
      renderModal();

      await user.click(screen.getByRole('button', { name: /sí, cancelar en aliclik/i }));

      expect(await screen.findByText('Rechazado')).toBeInTheDocument();
    });

    it('muestra la reason del resultado "rejected"', async () => {
      mockCancelOrder.mockResolvedValue(RESULT_WITH_REJECTED);
      const user = userEvent.setup();
      renderModal();

      await user.click(screen.getByRole('button', { name: /sí, cancelar en aliclik/i }));

      expect(await screen.findByText('El pedido ya fue entregado')).toBeInTheDocument();
    });

    it('muestra los tres tipos de resultado en el resumen mixto', async () => {
      mockCancelOrder.mockResolvedValue(RESULT_MIXED);
      const user = userEvent.setup();
      renderModal();

      await user.click(screen.getByRole('button', { name: /sí, cancelar en aliclik/i }));

      expect(await screen.findByText('Cancelado')).toBeInTheDocument();
      expect(screen.getByText('Cancelación diferida')).toBeInTheDocument();
      expect(screen.getByText('Rechazado')).toBeInTheDocument();
    });

    it('muestra el reason del rejected en el resumen mixto', async () => {
      mockCancelOrder.mockResolvedValue(RESULT_MIXED);
      const user = userEvent.setup();
      renderModal();

      await user.click(screen.getByRole('button', { name: /sí, cancelar en aliclik/i }));

      expect(await screen.findByText('Fuera de plazo')).toBeInTheDocument();
    });

    it('muestra el botón "Entendido, cerrar" en la fase de resultado', async () => {
      const user = userEvent.setup();
      renderModal();

      await user.click(screen.getByRole('button', { name: /sí, cancelar en aliclik/i }));

      expect(await screen.findByRole('button', { name: /entendido, cerrar/i })).toBeInTheDocument();
    });
  });

  // ── 6. Aviso de cancel_pending ────────────────────────────────────────────────

  describe('aviso de cancelación diferida', () => {
    it('muestra el aviso de cancelación diferida cuando hay al menos un cancel_pending', async () => {
      mockCancelOrder.mockResolvedValue(RESULT_WITH_PENDING);
      const user = userEvent.setup();
      renderModal();

      await user.click(screen.getByRole('button', { name: /sí, cancelar en aliclik/i }));

      expect(
        await screen.findByText(/serán cancelados por aliclik/i),
      ).toBeInTheDocument();
    });

    it('NO muestra el aviso de cancelación diferida cuando no hay cancel_pending', async () => {
      // RESULT_ALL_CANCELLED es el default en beforeEach (2 items cancelled, ninguno cancel_pending)
      const user = userEvent.setup();
      renderModal();

      await user.click(screen.getByRole('button', { name: /sí, cancelar en aliclik/i }));

      // Esperar a que la fase result esté visible antes de afirmar la ausencia del aviso
      await screen.findByText(/resultado por almacén/i);
      expect(
        screen.queryByText(/serán cancelados por aliclik/i),
      ).not.toBeInTheDocument();
    });
  });

  // ── 7-9. Toast según resultado ────────────────────────────────────────────────

  describe('toast según resultado', () => {
    it('llama a toast.success "correctamente" cuando todos son "cancelled"', async () => {
      const user = userEvent.setup();
      renderModal();

      await user.click(screen.getByRole('button', { name: /sí, cancelar en aliclik/i }));

      await waitFor(() => {
        expect(mockToast.success).toHaveBeenCalledWith(
          expect.stringContaining('correctamente'),
        );
      });
    });

    it('llama a toast.error cuando algún resultado es "rejected"', async () => {
      mockCancelOrder.mockResolvedValue(RESULT_WITH_REJECTED);
      const user = userEvent.setup();
      renderModal();

      await user.click(screen.getByRole('button', { name: /sí, cancelar en aliclik/i }));

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith(
          expect.stringMatching(/uno o más almacenes/i),
        );
      });
    });

    it('llama a toast.success "diferida" cuando todos son cancel_pending (sin cancelled ni rejected)', async () => {
      mockCancelOrder.mockResolvedValue(RESULT_ONLY_PENDING);
      const user = userEvent.setup();
      renderModal();

      await user.click(screen.getByRole('button', { name: /sí, cancelar en aliclik/i }));

      await waitFor(() => {
        expect(mockToast.success).toHaveBeenCalledWith(
          expect.stringMatching(/procesará/i),
        );
      });
    });

    it('llama a toast.success "parcial" cuando hay cancelled + cancel_pending pero sin rejected', async () => {
      // RESULT_WITH_PENDING tiene cancelled + cancel_pending, sin rejected
      // → branch mixedCancelledAndPending → toast.success con "parcial"
      mockCancelOrder.mockResolvedValue(RESULT_WITH_PENDING);
      const user = userEvent.setup();
      renderModal();

      await user.click(screen.getByRole('button', { name: /sí, cancelar en aliclik/i }));

      await waitFor(() => {
        expect(mockToast.success).toHaveBeenCalledWith(
          expect.stringMatching(/parcial/i),
        );
      });
    });
  });

  // ── 10. onSuccess ─────────────────────────────────────────────────────────────

  describe('callback onSuccess', () => {
    it('llama a onSuccess después de una cancelación exitosa', async () => {
      const onSuccess = jest.fn();
      const user = userEvent.setup();
      renderModal({ onSuccess });

      await user.click(screen.getByRole('button', { name: /sí, cancelar en aliclik/i }));

      await waitFor(() => {
        expect(onSuccess).toHaveBeenCalled();
      });
    });

    it('NO llama a onSuccess cuando el service rechaza', async () => {
      mockCancelOrder.mockRejectedValue(new Error('fail'));
      const onSuccess = jest.fn();
      const user = userEvent.setup();
      renderModal({ onSuccess });

      await user.click(screen.getByRole('button', { name: /sí, cancelar en aliclik/i }));

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalled();
      });
      expect(onSuccess).not.toHaveBeenCalled();
    });
  });

  // ── 11. Error del service ─────────────────────────────────────────────────────

  describe('error del service', () => {
    it('muestra toast.error con el mensaje del servidor al rechazar', async () => {
      mockCancelOrder.mockRejectedValue({
        response: { data: { message: 'Credenciales inválidas en Aliclik' } },
      });
      const user = userEvent.setup();
      renderModal();

      await user.click(screen.getByRole('button', { name: /sí, cancelar en aliclik/i }));

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith('Credenciales inválidas en Aliclik');
      });
    });

    it('usa mensaje genérico cuando el error no tiene response.data.message', async () => {
      mockCancelOrder.mockRejectedValue(new Error('network error'));
      const user = userEvent.setup();
      renderModal();

      await user.click(screen.getByRole('button', { name: /sí, cancelar en aliclik/i }));

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith('Error al cancelar el pedido en Aliclik');
      });
    });

    it('vuelve a la fase de confirmación después de un error del service', async () => {
      mockCancelOrder.mockRejectedValue(new Error('fail'));
      const user = userEvent.setup();
      renderModal();

      await user.click(screen.getByRole('button', { name: /sí, cancelar en aliclik/i }));

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalled();
      });

      // Los botones de confirmación vuelven a estar en el DOM
      expect(
        screen.getByRole('button', { name: /sí, cancelar en aliclik/i }),
      ).toBeInTheDocument();
    });

    it('NO muestra la pantalla de resultado cuando el service rechaza', async () => {
      mockCancelOrder.mockRejectedValue(new Error('fail'));
      const user = userEvent.setup();
      renderModal();

      await user.click(screen.getByRole('button', { name: /sí, cancelar en aliclik/i }));

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalled();
      });
      expect(screen.queryByText(/resultado por almacén/i)).not.toBeInTheDocument();
    });
  });

  // ── 12. companyId desde useAuth cuando no viene por prop ─────────────────────

  describe('resolución de companyId desde useAuth', () => {
    it('usa auth.company.id cuando no se pasa companyId por prop', async () => {
      const user = userEvent.setup();
      // Renderizar sin companyId prop → debe resolverlo desde useAuth
      renderModal({ companyId: undefined });

      await user.click(screen.getByRole('button', { name: /sí, cancelar en aliclik/i }));

      await waitFor(() => {
        // company.id = 'company-1' del MOCK_AUTH
        expect(mockCancelOrder).toHaveBeenCalledWith('fake-token', 'order-abc', 'company-1');
      });
    });

    it('prefiere la prop companyId sobre auth.company.id cuando se pasa', async () => {
      const user = userEvent.setup();
      renderModal({ companyId: 'company-override' });

      await user.click(screen.getByRole('button', { name: /sí, cancelar en aliclik/i }));

      await waitFor(() => {
        expect(mockCancelOrder).toHaveBeenCalledWith(
          'fake-token',
          'order-abc',
          'company-override',
        );
      });
    });
  });

  // ── 13. Sin companyId resuelto → toast.error, no llama al service ─────────────

  describe('sin companyId resuelto', () => {
    it('muestra toast.error cuando no hay companyId ni en props ni en auth', async () => {
      // Sobreescribir auth sin company
      mockUseAuth.mockReturnValue({
        ...MOCK_AUTH,
        auth: { ...MOCK_AUTH.auth, company: null },
      } as unknown as ReturnType<typeof useAuth>);

      const user = userEvent.setup();
      renderModal({ companyId: undefined });

      await user.click(screen.getByRole('button', { name: /sí, cancelar en aliclik/i }));

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith(
          expect.stringMatching(/empresa/i),
        );
      });
    });

    it('NO llama a cancelAliclikOrder cuando no se puede determinar el companyId', async () => {
      mockUseAuth.mockReturnValue({
        ...MOCK_AUTH,
        auth: { ...MOCK_AUTH.auth, company: null },
      } as unknown as ReturnType<typeof useAuth>);

      const user = userEvent.setup();
      renderModal({ companyId: undefined });

      await user.click(screen.getByRole('button', { name: /sí, cancelar en aliclik/i }));

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalled();
      });
      expect(mockCancelOrder).not.toHaveBeenCalled();
    });
  });

  // ── 14. Reset de estado al reabrir ────────────────────────────────────────────

  describe('reset al reabrir', () => {
    it('vuelve a la fase de confirmación al reabrir el modal', async () => {
      const user = userEvent.setup();
      const { rerender } = render(
        <CancelAliclikModal
          open={true}
          onClose={jest.fn()}
          orderId="order-abc"
          companyId="company-1"
          onSuccess={jest.fn()}
        />,
      );

      // Confirmar → llega a fase result
      await user.click(screen.getByRole('button', { name: /sí, cancelar en aliclik/i }));
      expect(await screen.findByText(/resultado por almacén/i)).toBeInTheDocument();

      // Cerrar
      rerender(
        <CancelAliclikModal
          open={false}
          onClose={jest.fn()}
          orderId="order-abc"
          companyId="company-1"
          onSuccess={jest.fn()}
        />,
      );

      // Reabrir → debe volver a confirmación
      rerender(
        <CancelAliclikModal
          open={true}
          onClose={jest.fn()}
          orderId="order-abc"
          companyId="company-1"
          onSuccess={jest.fn()}
        />,
      );

      expect(
        screen.getByRole('button', { name: /sí, cancelar en aliclik/i }),
      ).toBeInTheDocument();
      expect(screen.queryByText(/resultado por almacén/i)).not.toBeInTheDocument();
    });
  });
});
