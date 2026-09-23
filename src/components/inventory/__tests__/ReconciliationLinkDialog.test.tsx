/**
 * Tests: ReconciliationLinkDialog (FEAT-17 Fase 5 — bandeja de reconciliación)
 *
 * Comportamiento verificado:
 * 1. `task: null` no renderiza nada.
 * 2. Muestra el `variant_name`, el SKU y el `targetVariantId` recibido por
 *    props, junto con la advertencia "Esta acción no se puede deshacer.".
 * 3. Cancelar NO llama a `resolveReconciliationLink` y dispara `onClose`.
 * 4. Confirmar llama a `resolveReconciliationLink(task.id, targetVariantId)`
 *    (recortando espacios) y, si resuelve, llama a `onSuccess(task.id)` y
 *    luego a `onClose`.
 * 5. Si `resolveReconciliationLink` rechaza la promesa, se muestra
 *    `toast.error` y el diálogo sigue abierto (no se llama a `onClose`).
 * 6. El botón "Confirmar vinculación" muestra "Vinculando..." mientras la
 *    mutación está en curso.
 *
 * Mocks aplicados:
 * - @/services/reconciliationTask.service → `resolveReconciliationLink` +
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
  resolveReconciliationLink: jest.fn(),
  getReconciliationTaskErrorMessage: jest.fn(
    (_error: unknown, fallback: string) => fallback,
  ),
}));

// ── Imports bajo prueba (después de los mocks) ────────────────────────────────

import { toast } from 'sonner';
import {
  resolveReconciliationLink,
  type ReconciliationTask,
  type ReconciliationTaskItem,
} from '@/services/reconciliationTask.service';
import { ReconciliationLinkDialog } from '../ReconciliationLinkDialog';

// ── Casts ────────────────────────────────────────────────────────────────────

const mockResolveLink = jest.mocked(resolveReconciliationLink);
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

function makeProvisionalTask(overrides: Partial<ReconciliationTask> = {}): ReconciliationTask {
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
  mockResolveLink.mockResolvedValue(makeProvisionalTask({ status: 'confirmed' }));
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe('ReconciliationLinkDialog', () => {
  it('task: null no renderiza nada', () => {
    render(
      <ReconciliationLinkDialog
        task={null}
        targetVariantId="variant-existing-99"
        onClose={jest.fn()}
        onSuccess={jest.fn()}
      />,
    );

    expect(screen.queryByText(/vincular a variante existente/i)).not.toBeInTheDocument();
  });

  it('muestra variant_name, SKU y el targetVariantId recibido, con la advertencia de acción irreversible', () => {
    const task = makeProvisionalTask();
    render(
      <ReconciliationLinkDialog
        task={task}
        targetVariantId="variant-existing-99"
        onClose={jest.fn()}
        onSuccess={jest.fn()}
      />,
    );

    expect(screen.getByText(/vincular a variante existente/i)).toBeInTheDocument();
    expect(screen.getByText(/zapatilla roja talla 40/i)).toBeInTheDocument();
    expect(screen.getByText(/zap-roja-40/i)).toBeInTheDocument();
    expect(screen.getByText(/variant-existing-99/i)).toBeInTheDocument();
    expect(screen.getByText(/esta acción no se puede deshacer/i)).toBeInTheDocument();
  });

  describe('cancelar', () => {
    it('NO llama a resolveReconciliationLink y dispara onClose', async () => {
      const task = makeProvisionalTask();
      const onClose = jest.fn();
      render(
        <ReconciliationLinkDialog
          task={task}
          targetVariantId="variant-existing-99"
          onClose={onClose}
          onSuccess={jest.fn()}
        />,
      );

      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: /cancelar/i }));

      expect(mockResolveLink).not.toHaveBeenCalled();
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('confirmar la vinculación', () => {
    it('llama a resolveReconciliationLink con el id de la tarea y el targetVariantId recortado', async () => {
      const task = makeProvisionalTask();
      render(
        <ReconciliationLinkDialog
          task={task}
          targetVariantId="  variant-existing-99  "
          onClose={jest.fn()}
          onSuccess={jest.fn()}
        />,
      );

      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: /confirmar vinculación/i }));

      await waitFor(() =>
        expect(mockResolveLink).toHaveBeenCalledWith('task-prov-1', 'variant-existing-99'),
      );
      expect(mockToast.success).toHaveBeenCalledWith('Variante vinculada correctamente');
    });

    it('muestra "Vinculando..." en el botón mientras la mutación está en curso', async () => {
      const task = makeProvisionalTask();
      let resolveLink!: (value: ReconciliationTask) => void;
      mockResolveLink.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveLink = resolve;
          }),
      );
      render(
        <ReconciliationLinkDialog
          task={task}
          targetVariantId="variant-existing-99"
          onClose={jest.fn()}
          onSuccess={jest.fn()}
        />,
      );

      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: /confirmar vinculación/i }));

      expect(await screen.findByText(/vinculando\.\.\./i)).toBeInTheDocument();

      resolveLink(makeProvisionalTask({ status: 'confirmed' }));

      await waitFor(() =>
        expect(screen.queryByText(/vinculando\.\.\./i)).not.toBeInTheDocument(),
      );
    });

    it('tras confirmar exitosamente, llama a onSuccess(taskId) y luego a onClose', async () => {
      const task = makeProvisionalTask();
      const onClose = jest.fn();
      const onSuccess = jest.fn().mockResolvedValue(undefined);
      render(
        <ReconciliationLinkDialog
          task={task}
          targetVariantId="variant-existing-99"
          onClose={onClose}
          onSuccess={onSuccess}
        />,
      );

      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: /confirmar vinculación/i }));

      await waitFor(() => expect(onSuccess).toHaveBeenCalledWith('task-prov-1'));
      await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    });

    it('el botón está deshabilitado si targetVariantId está vacío (solo espacios)', () => {
      const task = makeProvisionalTask();
      render(
        <ReconciliationLinkDialog
          task={task}
          targetVariantId="   "
          onClose={jest.fn()}
          onSuccess={jest.fn()}
        />,
      );

      expect(screen.getByRole('button', { name: /confirmar vinculación/i })).toBeDisabled();
    });
  });

  describe('manejo de errores', () => {
    it('si resolveReconciliationLink rechaza, muestra toast.error y no cierra el diálogo', async () => {
      const task = makeProvisionalTask();
      const onClose = jest.fn();
      mockResolveLink.mockRejectedValueOnce(new Error('falla de red'));
      render(
        <ReconciliationLinkDialog
          task={task}
          targetVariantId="variant-existing-99"
          onClose={onClose}
          onSuccess={jest.fn()}
        />,
      );

      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: /confirmar vinculación/i }));

      expect(
        await screen.findByRole('button', { name: /confirmar vinculación/i }),
      ).toBeInTheDocument();
      expect(mockToast.error).toHaveBeenCalledWith('No se pudo vincular la variante');
      expect(onClose).not.toHaveBeenCalled();
    });
  });
});
