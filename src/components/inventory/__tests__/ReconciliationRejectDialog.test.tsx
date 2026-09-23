/**
 * Tests: ReconciliationRejectDialog (FEAT-17 Fase 5 — bandeja de reconciliación)
 *
 * Comportamiento verificado:
 * 1. `task: null` no renderiza nada.
 * 2. Texto condicional por tipo de tarea: para `type: 'provisional'` muestra
 *    "la variante provisional se desactivará."; para `type: 'manual'` y
 *    `type: 'duplicate_cluster'` muestra "la tarea se descartará.". Ambos
 *    casos muestran "Esta acción no se puede deshacer.".
 * 3. Cancelar NO llama a `rejectReconciliationTask` y dispara `onClose`.
 * 4. Confirmar llama a `rejectReconciliationTask(task.id)` y, si resuelve,
 *    llama a `onSuccess` y luego a `onClose`.
 * 5. Si `rejectReconciliationTask` rechaza la promesa, se muestra
 *    `toast.error` y el diálogo sigue abierto (no se llama a `onClose`).
 * 6. El botón "Confirmar rechazo" muestra "Rechazando..." mientras la
 *    mutación está en curso.
 *
 * Mocks aplicados:
 * - @/services/reconciliationTask.service → `rejectReconciliationTask` +
 *   `getReconciliationTaskErrorMessage` (devuelve el `fallback` recibido).
 * - sonner → toast.success/error.
 * - AlertDialog (Radix) → SIN mockear, es seguro en jsdom (no depende de
 *   pointer capture / ResizeObserver como sí lo hace Select).
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ── Mocks de infraestructura ─────────────────────────────────────────────────

jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('@/services/reconciliationTask.service', () => ({
  rejectReconciliationTask: jest.fn(),
  getReconciliationTaskErrorMessage: jest.fn(
    (_error: unknown, fallback: string) => fallback,
  ),
}));

// ── Imports bajo prueba (después de los mocks) ────────────────────────────────

import { toast } from 'sonner';
import {
  rejectReconciliationTask,
  type ReconciliationTask,
  type ReconciliationTaskItem,
} from '@/services/reconciliationTask.service';
import { ReconciliationRejectDialog } from '../ReconciliationRejectDialog';

// ── Casts ────────────────────────────────────────────────────────────────────

const mockReject = jest.mocked(rejectReconciliationTask);
const mockToast = toast as jest.Mocked<typeof toast>;

// ── Fixtures ─────────────────────────────────────────────────────────────────

function makeItem(overrides: Partial<ReconciliationTaskItem> = {}): ReconciliationTaskItem {
  return {
    variant_id: null,
    product_id: null,
    variant_name: 'Zapatilla Roja Talla 40',
    sku: null,
    company_sku: 'ZAP-ROJA-40',
    external_id: 'ext-shopify-1',
    source: 'shopify',
    confidence: 0,
    ...overrides,
  };
}

function makeTask(overrides: Partial<ReconciliationTask> = {}): ReconciliationTask {
  return {
    id: 'task-prov-1',
    companyId: 'company-1',
    type: 'provisional',
    status: 'pending',
    confidenceLevel: null,
    dedupeKey: null,
    resolvedByUserId: null,
    resolvedAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    items: [makeItem()],
    ...overrides,
  };
}

// ── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  mockReject.mockResolvedValue(makeTask({ status: 'rejected' }));
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe('ReconciliationRejectDialog', () => {
  it('task: null no renderiza nada', () => {
    render(<ReconciliationRejectDialog task={null} onClose={jest.fn()} onSuccess={jest.fn()} />);

    expect(screen.queryByText(/rechazar tarea de reconciliación/i)).not.toBeInTheDocument();
  });

  describe('texto condicional por tipo de tarea', () => {
    it('type: provisional muestra que la variante provisional se desactivará', () => {
      const task = makeTask({ type: 'provisional' });
      render(<ReconciliationRejectDialog task={task} onClose={jest.fn()} onSuccess={jest.fn()} />);

      expect(screen.getByText(/rechazar tarea de reconciliación/i)).toBeInTheDocument();
      expect(screen.getByText(/la variante provisional se desactivará/i)).toBeInTheDocument();
      expect(screen.queryByText(/la tarea se descartará/i)).not.toBeInTheDocument();
      expect(screen.getByText(/esta acción no se puede deshacer/i)).toBeInTheDocument();
    });

    it('type: manual muestra que la tarea se descartará', () => {
      const task = makeTask({
        type: 'manual',
        items: [
          makeItem({
            variant_name: 'Línea de venta sin match',
            external_order_id: 'ORD-100',
            external_line_ref: 'line-1',
          }),
        ],
      });
      render(<ReconciliationRejectDialog task={task} onClose={jest.fn()} onSuccess={jest.fn()} />);

      expect(screen.getByText(/la tarea se descartará/i)).toBeInTheDocument();
      expect(
        screen.queryByText(/la variante provisional se desactivará/i),
      ).not.toBeInTheDocument();
    });

    it('type: duplicate_cluster muestra que la tarea se descartará', () => {
      const task = makeTask({
        type: 'duplicate_cluster',
        confidenceLevel: 0.85,
        items: [
          makeItem({ variant_id: 'variant-a', variant_name: 'Camiseta Azul M' }),
          makeItem({ variant_id: 'variant-b', variant_name: 'Camiseta Azul Mediana' }),
        ],
      });
      render(<ReconciliationRejectDialog task={task} onClose={jest.fn()} onSuccess={jest.fn()} />);

      expect(screen.getByText(/la tarea se descartará/i)).toBeInTheDocument();
    });
  });

  describe('cancelar', () => {
    it('NO llama a rejectReconciliationTask y dispara onClose', async () => {
      const task = makeTask();
      const onClose = jest.fn();
      render(<ReconciliationRejectDialog task={task} onClose={onClose} onSuccess={jest.fn()} />);

      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: /cancelar/i }));

      expect(mockReject).not.toHaveBeenCalled();
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('confirmar el rechazo', () => {
    it('llama a rejectReconciliationTask con el id de la tarea', async () => {
      const task = makeTask();
      render(<ReconciliationRejectDialog task={task} onClose={jest.fn()} onSuccess={jest.fn()} />);

      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: /confirmar rechazo/i }));

      await waitFor(() => expect(mockReject).toHaveBeenCalledWith('task-prov-1'));
      expect(mockToast.success).toHaveBeenCalledWith('Tarea rechazada');
    });

    it('muestra "Rechazando..." en el botón mientras la mutación está en curso', async () => {
      const task = makeTask();
      let resolveReject!: (value: ReconciliationTask) => void;
      mockReject.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveReject = resolve;
          }),
      );
      render(<ReconciliationRejectDialog task={task} onClose={jest.fn()} onSuccess={jest.fn()} />);

      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: /confirmar rechazo/i }));

      expect(await screen.findByText(/rechazando\.\.\./i)).toBeInTheDocument();

      resolveReject(makeTask({ status: 'rejected' }));

      await waitFor(() => expect(screen.queryByText(/rechazando\.\.\./i)).not.toBeInTheDocument());
    });

    it('tras confirmar exitosamente, llama a onSuccess y luego a onClose', async () => {
      const task = makeTask();
      const onClose = jest.fn();
      const onSuccess = jest.fn().mockResolvedValue(undefined);
      render(<ReconciliationRejectDialog task={task} onClose={onClose} onSuccess={onSuccess} />);

      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: /confirmar rechazo/i }));

      await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    });
  });

  describe('manejo de errores', () => {
    it('si rejectReconciliationTask rechaza, muestra toast.error y no cierra el diálogo', async () => {
      const task = makeTask();
      const onClose = jest.fn();
      mockReject.mockRejectedValueOnce(new Error('falla de red'));
      render(<ReconciliationRejectDialog task={task} onClose={onClose} onSuccess={jest.fn()} />);

      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: /confirmar rechazo/i }));

      expect(
        await screen.findByRole('button', { name: /confirmar rechazo/i }),
      ).toBeInTheDocument();
      expect(mockToast.error).toHaveBeenCalledWith('No se pudo rechazar la tarea');
      expect(onClose).not.toHaveBeenCalled();
    });
  });
});
