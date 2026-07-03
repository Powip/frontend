/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Tests: CancelAliclikButton
 *
 * Comportamiento verificado:
 * 1. aliclikDispatchStatus falsy (null / undefined / "") → retorna null, no hay nada en el DOM.
 * 2. aliclikDispatchStatus con valor → renderiza el botón "Cancelar en Aliclik".
 * 3. Label personalizado se muestra en el botón.
 * 4. Click en el botón abre el modal (CancelAliclikModal entra en el DOM).
 * 5. El modal queda cerrado inicialmente.
 * 6. Las props orderId y companyId llegan correctamente al modal.
 *
 * Work-arounds jsdom:
 * - @/components/ui/dialog → div simple cuando open=true.
 * - @/components/ui/button → <button> nativo.
 * - CancelAliclikModal → mock completo para aislar el botón.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
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

jest.mock('@/lib/utils', () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
}));

jest.mock('lucide-react', () => ({
  XCircle: () => <span data-testid="x-circle-icon" />,
  CheckCircle2: () => null,
  Clock: () => null,
  AlertTriangle: () => null,
  Loader2: () => null,
}));

/**
 * Mock de CancelAliclikModal: registra las props que recibe y muestra
 * el contenido del modal solo cuando open=true, para verificar apertura.
 */
const mockModalOnClose = jest.fn();
jest.mock('../CancelAliclikModal', () => {
  const React = require('react');
  return function MockCancelAliclikModal({
    open,
    orderId,
    companyId,
    onClose,
  }: {
    open: boolean;
    orderId: string;
    companyId?: string;
    onClose: () => void;
    onSuccess?: () => void;
  }) {
    if (!open) return null;
    return (
      <div data-testid="cancel-modal">
        <span data-testid="modal-order-id">{orderId}</span>
        {companyId && <span data-testid="modal-company-id">{companyId}</span>}
        <button onClick={onClose}>Cerrar modal</button>
      </div>
    );
  };
});

// ── Imports bajo prueba (después de los mocks) ───────────────────────────────

import CancelAliclikButton from '../CancelAliclikButton';

// ── Fixtures ─────────────────────────────────────────────────────────────────

const BASE_PROPS = {
  orderId: 'order-123',
  companyId: 'company-1',
  onSuccess: jest.fn(),
};

// ── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe('CancelAliclikButton', () => {

  // ── 1. aliclikDispatchStatus falsy → no renderiza nada ───────────────────────

  describe('cuando aliclikDispatchStatus es falsy', () => {
    it('retorna null cuando aliclikDispatchStatus es undefined', () => {
      const { container } = render(
        <CancelAliclikButton {...BASE_PROPS} aliclikDispatchStatus={undefined} />,
      );
      expect(container.firstChild).toBeNull();
    });

    it('retorna null cuando aliclikDispatchStatus es null', () => {
      const { container } = render(
        <CancelAliclikButton {...BASE_PROPS} aliclikDispatchStatus={null} />,
      );
      expect(container.firstChild).toBeNull();
    });

    it('retorna null cuando aliclikDispatchStatus es string vacío ""', () => {
      const { container } = render(
        <CancelAliclikButton {...BASE_PROPS} aliclikDispatchStatus="" />,
      );
      expect(container.firstChild).toBeNull();
    });

    it('no hay botón en el DOM cuando aliclikDispatchStatus es null', () => {
      render(<CancelAliclikButton {...BASE_PROPS} aliclikDispatchStatus={null} />);
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });
  });

  // ── 2. aliclikDispatchStatus con valor → renderiza el botón ──────────────────

  describe('cuando aliclikDispatchStatus tiene valor', () => {
    it('renderiza el botón "Cancelar en Aliclik" con status "sent"', () => {
      render(<CancelAliclikButton {...BASE_PROPS} aliclikDispatchStatus="sent" />);
      expect(screen.getByRole('button', { name: /cancelar en aliclik/i })).toBeInTheDocument();
    });

    it('renderiza el botón con cualquier valor de aliclikDispatchStatus truthy', () => {
      render(<CancelAliclikButton {...BASE_PROPS} aliclikDispatchStatus="dispatched" />);
      expect(screen.getByRole('button', { name: /cancelar en aliclik/i })).toBeInTheDocument();
    });

    it('el botón tiene aria-label "Cancelar en Aliclik" por defecto', () => {
      render(<CancelAliclikButton {...BASE_PROPS} aliclikDispatchStatus="sent" />);
      expect(
        screen.getByRole('button', { name: 'Cancelar en Aliclik' }),
      ).toBeInTheDocument();
    });
  });

  // ── 3. Label personalizado ──────────────────────────────────────────────────

  describe('label personalizado', () => {
    it('muestra el label personalizado cuando se pasa prop label', () => {
      render(
        <CancelAliclikButton
          {...BASE_PROPS}
          aliclikDispatchStatus="sent"
          label="Anular pedido"
        />,
      );
      expect(screen.getByText('Anular pedido')).toBeInTheDocument();
    });

    it('el aria-label refleja el label personalizado', () => {
      render(
        <CancelAliclikButton
          {...BASE_PROPS}
          aliclikDispatchStatus="sent"
          label="Anular pedido"
        />,
      );
      expect(screen.getByRole('button', { name: 'Anular pedido' })).toBeInTheDocument();
    });
  });

  // ── 4. Click abre el modal ──────────────────────────────────────────────────

  describe('apertura del modal', () => {
    it('el modal no está en el DOM antes de hacer click', () => {
      render(<CancelAliclikButton {...BASE_PROPS} aliclikDispatchStatus="sent" />);
      expect(screen.queryByTestId('cancel-modal')).not.toBeInTheDocument();
    });

    it('al hacer click en el botón aparece el modal de cancelación', async () => {
      const user = userEvent.setup();
      render(<CancelAliclikButton {...BASE_PROPS} aliclikDispatchStatus="sent" />);

      await user.click(screen.getByRole('button', { name: /cancelar en aliclik/i }));

      expect(screen.getByTestId('cancel-modal')).toBeInTheDocument();
    });

    it('el modal recibe el orderId correcto', async () => {
      const user = userEvent.setup();
      render(
        <CancelAliclikButton
          {...BASE_PROPS}
          orderId="order-abc-999"
          aliclikDispatchStatus="sent"
        />,
      );

      await user.click(screen.getByRole('button', { name: /cancelar en aliclik/i }));

      expect(screen.getByTestId('modal-order-id')).toHaveTextContent('order-abc-999');
    });

    it('el modal recibe el companyId correcto', async () => {
      const user = userEvent.setup();
      render(
        <CancelAliclikButton
          {...BASE_PROPS}
          companyId="company-xyz"
          aliclikDispatchStatus="sent"
        />,
      );

      await user.click(screen.getByRole('button', { name: /cancelar en aliclik/i }));

      expect(screen.getByTestId('modal-company-id')).toHaveTextContent('company-xyz');
    });

    it('el modal se cierra al llamar onClose desde el modal', async () => {
      const user = userEvent.setup();
      render(<CancelAliclikButton {...BASE_PROPS} aliclikDispatchStatus="sent" />);

      await user.click(screen.getByRole('button', { name: /cancelar en aliclik/i }));
      expect(screen.getByTestId('cancel-modal')).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: /cerrar modal/i }));
      expect(screen.queryByTestId('cancel-modal')).not.toBeInTheDocument();
    });
  });
});
