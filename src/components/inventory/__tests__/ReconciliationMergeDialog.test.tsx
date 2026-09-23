/**
 * Tests: ReconciliationMergeDialog (FEAT-17 Fase 5 — bandeja de reconciliación)
 *
 * Comportamiento verificado:
 * 1. `task: null` no renderiza nada.
 * 2. Preselecciona como ganador el candidato con `is_suggested_winner: true`,
 *    sin importar su posición dentro de `task.items`.
 * 3. Cambiar la selección de ganador (radio) recalcula correctamente
 *    `loser_variant_ids` como el resto de los ids del cluster (no el
 *    seleccionado), preservando el orden de `task.items`.
 * 4. Confirmar llama a `resolveReconciliationMerge(taskId, { winner_variant_id,
 *    loser_variant_ids })` con los ids correctos usando la preselección por
 *    defecto (ganador sugerido).
 * 5. Cancelar NO llama a `resolveReconciliationMerge` y cierra el diálogo
 *    (dispara `onClose`).
 * 6. Si `resolveReconciliationMerge` rechaza la promesa, se muestra
 *    `toast.error` y el diálogo sigue abierto (no se llama a `onClose`).
 *
 * Mocks aplicados:
 * - @/services/reconciliationTask.service → `resolveReconciliationMerge` +
 *   `getReconciliationTaskErrorMessage` (devuelve el `fallback` recibido).
 * - sonner → toast.success/error.
 * - AlertDialog (Radix) → SIN mockear, es seguro en jsdom (no depende de
 *   pointer capture / ResizeObserver como sí lo hace Select).
 *
 * Los radios no tienen un `aria-label`/`htmlFor` propio: el `<input
 * type="radio">` vive DENTRO del `<label>` (wrapping implícito), así que su
 * nombre accesible es todo el texto del label (nombre + badge "Sugerida" +
 * SKU/origen/confianza). En vez de matchear ese nombre completo, los tests
 * ubican los radios por orden con `getAllByRole('radio')` y validan el
 * candidato asociado navegando al `<label>` contenedor (`closest('label')`).
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
  resolveReconciliationMerge: jest.fn(),
  getReconciliationTaskErrorMessage: jest.fn(
    (_error: unknown, fallback: string) => fallback,
  ),
}));

// ── Imports bajo prueba (después de los mocks) ────────────────────────────────

import { toast } from 'sonner';
import {
  resolveReconciliationMerge,
  type ReconciliationTask,
  type ReconciliationTaskItem,
} from '@/services/reconciliationTask.service';
import { ReconciliationMergeDialog } from '../ReconciliationMergeDialog';

// ── Casts ────────────────────────────────────────────────────────────────────

const mockResolveMerge = jest.mocked(resolveReconciliationMerge);
const mockToast = toast as jest.Mocked<typeof toast>;

// ── Fixtures ─────────────────────────────────────────────────────────────────

function makeItem(overrides: Partial<ReconciliationTaskItem> = {}): ReconciliationTaskItem {
  return {
    variant_id: 'variant-x',
    product_id: 'product-x',
    variant_name: 'Producto Test',
    sku: 'SKU-X',
    company_sku: null,
    external_id: 'ext-x',
    source: 'shopify',
    confidence: 0.8,
    ...overrides,
  };
}

/**
 * Cluster de 3 candidatos donde el sugerido NO es el primero del array — a
 * propósito, para verificar que la preselección se basa en
 * `is_suggested_winner`, no en la posición.
 */
function makeClusterTask(overrides: Partial<ReconciliationTask> = {}): ReconciliationTask {
  return {
    id: 'task-cluster-1',
    companyId: 'company-1',
    type: 'duplicate_cluster',
    status: 'pending',
    confidenceLevel: 0.85,
    dedupeKey: null,
    resolvedByUserId: null,
    resolvedAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    items: [
      makeItem({ variant_id: 'variant-a', variant_name: 'Producto A', source: 'shopify' }),
      makeItem({
        variant_id: 'variant-b',
        variant_name: 'Producto B',
        source: 'aliclik',
        is_suggested_winner: true,
      }),
      makeItem({ variant_id: 'variant-c', variant_name: 'Producto C', source: 'yavendio' }),
    ],
    ...overrides,
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function getRadios(): HTMLInputElement[] {
  return screen.getAllByRole('radio') as HTMLInputElement[];
}

function labelTextFor(radio: HTMLInputElement): string {
  return radio.closest('label')?.textContent ?? '';
}

function getCheckedRadio(): HTMLInputElement {
  const checked = getRadios().find((radio) => radio.checked);
  if (!checked) throw new Error('No hay ningún radio marcado');
  return checked;
}

// ── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  mockResolveMerge.mockResolvedValue(makeClusterTask({ status: 'confirmed' }));
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe('ReconciliationMergeDialog', () => {
  it('task: null no renderiza nada', () => {
    render(
      <ReconciliationMergeDialog task={null} onClose={jest.fn()} onSuccess={jest.fn()} />,
    );

    expect(screen.queryByText(/resolver duplicados/i)).not.toBeInTheDocument();
  });

  describe('preselección del ganador sugerido', () => {
    it('preselecciona el candidato con is_suggested_winner: true como ganador por defecto', () => {
      const task = makeClusterTask();
      render(<ReconciliationMergeDialog task={task} onClose={jest.fn()} onSuccess={jest.fn()} />);

      expect(getRadios()).toHaveLength(3);
      expect(labelTextFor(getCheckedRadio())).toContain('Producto B');
    });
  });

  describe('cambiar la selección de ganador', () => {
    it('recalcula loser_variant_ids como el resto de los ids del cluster al cambiar de candidato', async () => {
      const task = makeClusterTask();
      render(<ReconciliationMergeDialog task={task} onClose={jest.fn()} onSuccess={jest.fn()} />);

      const user = userEvent.setup();
      const radios = getRadios();
      // Cambia la selección al tercer candidato (Producto C, variant-c).
      await user.click(radios[2]);

      expect(labelTextFor(getCheckedRadio())).toContain('Producto C');

      await user.click(screen.getByRole('button', { name: /confirmar fusión/i }));

      expect(mockResolveMerge).toHaveBeenCalledWith('task-cluster-1', 'variant-c', [
        'variant-a',
        'variant-b',
      ]);
    });
  });

  describe('confirmar la fusión', () => {
    it('llama a resolveReconciliationMerge con winner/loser ids correctos usando la preselección por defecto', async () => {
      const task = makeClusterTask();
      render(<ReconciliationMergeDialog task={task} onClose={jest.fn()} onSuccess={jest.fn()} />);

      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: /confirmar fusión/i }));

      await waitFor(() =>
        expect(mockResolveMerge).toHaveBeenCalledWith('task-cluster-1', 'variant-b', [
          'variant-a',
          'variant-c',
        ]),
      );
      expect(mockToast.success).toHaveBeenCalledWith(
        'Cluster de duplicados fusionado correctamente',
      );
    });

    it('tras confirmar exitosamente, llama a onSuccess y luego a onClose', async () => {
      const task = makeClusterTask();
      const onClose = jest.fn();
      const onSuccess = jest.fn().mockResolvedValue(undefined);
      render(<ReconciliationMergeDialog task={task} onClose={onClose} onSuccess={onSuccess} />);

      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: /confirmar fusión/i }));

      await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    });
  });

  describe('cancelar', () => {
    it('NO llama a resolveReconciliationMerge y dispara onClose', async () => {
      const task = makeClusterTask();
      const onClose = jest.fn();
      render(<ReconciliationMergeDialog task={task} onClose={onClose} onSuccess={jest.fn()} />);

      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: /cancelar/i }));

      expect(mockResolveMerge).not.toHaveBeenCalled();
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('manejo de errores', () => {
    it('si resolveReconciliationMerge rechaza, muestra toast.error y no cierra el diálogo', async () => {
      const task = makeClusterTask();
      const onClose = jest.fn();
      mockResolveMerge.mockRejectedValueOnce(new Error('falla de red'));
      render(<ReconciliationMergeDialog task={task} onClose={onClose} onSuccess={jest.fn()} />);

      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: /confirmar fusión/i }));

      expect(
        await screen.findByRole('button', { name: /confirmar fusión/i }),
      ).toBeInTheDocument();
      expect(mockToast.error).toHaveBeenCalledWith('No se pudo resolver el merge del cluster');
      expect(onClose).not.toHaveBeenCalled();
    });
  });
});
