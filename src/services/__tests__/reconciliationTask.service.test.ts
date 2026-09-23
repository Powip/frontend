/**
 * Tests: reconciliationTask.service (FEAT-17 Fase 5 — bandeja de reconciliación)
 *
 * Comportamiento verificado:
 * 1. listReconciliationTasks — GET a `{API_PRODUCTOS}/reconciliation-tasks` con
 *    `{ params }` tal cual se le pasan (incluido `undefined` cuando no se
 *    filtra), y devuelve `res.data` sin transformar.
 * 2. getReconciliationTask — GET a `.../reconciliation-tasks/:id`, devuelve `res.data`.
 * 3. resolveReconciliationLink — POST a `.../:id/resolve-link` con body
 *    `{ target_variant_id }`.
 * 4. resolveReconciliationMerge — POST a `.../:id/resolve-merge` con body
 *    `{ winner_variant_id, loser_variant_ids }`.
 * 5. confirmReconciliationProvisional — POST a `.../:id/confirm-provisional`
 *    sin body.
 * 6. rejectReconciliationTask — POST a `.../:id/resolve-reject` sin body.
 * 7. bulkConfirmReconciliationTasks — POST a `.../bulk-confirm` con body
 *    `{ task_ids }`, devuelve el array de resultados tal cual.
 * 8. getReconciliationTaskErrorMessage:
 *    - `response.data.message` string → se devuelve tal cual.
 *    - `response.data.message` array (class-validator) no vacío → se unen con ", ".
 *    - `response.data.message` array VACÍO → cae al fallback (no hay mensaje útil).
 *    - error de axios sin `response` (request nunca llegó a responder) → fallback.
 *    - error que no es de axios (Error genérico) → fallback.
 *
 * `axiosAuth` está completamente mockeado — ninguna llamada HTTP real. El
 * paquete `axios` (usado por el service solo para `axios.isAxiosError`) NO se
 * mockea: se usa la implementación real, pasándole objetos planos con
 * `isAxiosError: true` (mismo patrón que `app/inventario/__tests__/page.test.tsx`).
 *
 * `NEXT_PUBLIC_API_PRODUCTOS` se fija ANTES de importar el módulo (vía
 * `jest.isolateModules`, mismo patrón que `clientsService.test.ts`) porque la
 * URL base se resuelve una sola vez al cargar el módulo.
 */

const FAKE_API_PRODUCTOS = 'http://localhost:9999';
const BASE_URL = `${FAKE_API_PRODUCTOS}/reconciliation-tasks`;

jest.mock('@/lib/axiosAuth', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));

import axiosAuth from '@/lib/axiosAuth';
import type {
  BulkConfirmResultItem,
  ReconciliationTask,
} from '@/services/reconciliationTask.service';

type ServiceModule = typeof import('@/services/reconciliationTask.service');

let listReconciliationTasks: ServiceModule['listReconciliationTasks'];
let getReconciliationTask: ServiceModule['getReconciliationTask'];
let resolveReconciliationLink: ServiceModule['resolveReconciliationLink'];
let resolveReconciliationMerge: ServiceModule['resolveReconciliationMerge'];
let confirmReconciliationProvisional: ServiceModule['confirmReconciliationProvisional'];
let rejectReconciliationTask: ServiceModule['rejectReconciliationTask'];
let bulkConfirmReconciliationTasks: ServiceModule['bulkConfirmReconciliationTasks'];
let getReconciliationTaskErrorMessage: ServiceModule['getReconciliationTaskErrorMessage'];

beforeAll(() => {
  process.env.NEXT_PUBLIC_API_PRODUCTOS = FAKE_API_PRODUCTOS;

  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('@/services/reconciliationTask.service') as ServiceModule;
    listReconciliationTasks = mod.listReconciliationTasks;
    getReconciliationTask = mod.getReconciliationTask;
    resolveReconciliationLink = mod.resolveReconciliationLink;
    resolveReconciliationMerge = mod.resolveReconciliationMerge;
    confirmReconciliationProvisional = mod.confirmReconciliationProvisional;
    rejectReconciliationTask = mod.rejectReconciliationTask;
    bulkConfirmReconciliationTasks = mod.bulkConfirmReconciliationTasks;
    getReconciliationTaskErrorMessage = mod.getReconciliationTaskErrorMessage;
  });
});

const mockGet = jest.mocked(axiosAuth.get);
const mockPost = jest.mocked(axiosAuth.post);

// ── Fixtures ─────────────────────────────────────────────────────────────────

function makeTask(overrides: Partial<ReconciliationTask> = {}): ReconciliationTask {
  return {
    id: 'task-1',
    companyId: 'company-1',
    type: 'provisional',
    status: 'pending',
    items: [
      {
        variant_id: 'variant-1',
        product_id: 'product-1',
        variant_name: 'Producto Test',
        sku: 'SKU-001',
        company_sku: null,
        external_id: 'ext-1',
        source: 'shopify',
        confidence: 0,
      },
    ],
    confidenceLevel: null,
    dedupeKey: null,
    resolvedByUserId: null,
    resolvedAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

const BULK_RESULTS: BulkConfirmResultItem[] = [
  { task_id: 'task-1', status: 'confirmed' },
  { task_id: 'task-2', status: 'skipped', message: 'type manual no soportado' },
];

beforeEach(() => {
  jest.clearAllMocks();
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe('reconciliationTask.service', () => {
  describe('listReconciliationTasks', () => {
    it('hace GET a la URL base con los params tal cual se pasan y devuelve res.data', async () => {
      const tasks = [makeTask(), makeTask({ id: 'task-2' })];
      mockGet.mockResolvedValueOnce({ data: tasks });

      const result = await listReconciliationTasks({
        type: 'provisional',
        status: 'pending',
      });

      expect(mockGet).toHaveBeenCalledWith(BASE_URL, {
        params: { type: 'provisional', status: 'pending' },
      });
      expect(result).toEqual(tasks);
    });

    it('sin params, llama con params: undefined (no filtra nada)', async () => {
      mockGet.mockResolvedValueOnce({ data: [] });

      await listReconciliationTasks();

      expect(mockGet).toHaveBeenCalledWith(BASE_URL, { params: undefined });
    });
  });

  describe('getReconciliationTask', () => {
    it('hace GET a /reconciliation-tasks/:id y devuelve res.data', async () => {
      const task = makeTask({ id: 'task-42' });
      mockGet.mockResolvedValueOnce({ data: task });

      const result = await getReconciliationTask('task-42');

      expect(mockGet).toHaveBeenCalledWith(`${BASE_URL}/task-42`);
      expect(result).toEqual(task);
    });
  });

  describe('resolveReconciliationLink', () => {
    it('hace POST a /:id/resolve-link con { target_variant_id } y devuelve res.data', async () => {
      const updatedTask = makeTask({ id: 'task-1', status: 'confirmed' });
      mockPost.mockResolvedValueOnce({ data: updatedTask });

      const result = await resolveReconciliationLink('task-1', 'variant-existing-99');

      expect(mockPost).toHaveBeenCalledWith(`${BASE_URL}/task-1/resolve-link`, {
        target_variant_id: 'variant-existing-99',
      });
      expect(result).toEqual(updatedTask);
    });
  });

  describe('resolveReconciliationMerge', () => {
    it('hace POST a /:id/resolve-merge con { winner_variant_id, loser_variant_ids } y devuelve res.data', async () => {
      const updatedTask = makeTask({ id: 'task-cluster', status: 'confirmed' });
      mockPost.mockResolvedValueOnce({ data: updatedTask });

      const result = await resolveReconciliationMerge('task-cluster', 'variant-winner', [
        'variant-loser-1',
        'variant-loser-2',
      ]);

      expect(mockPost).toHaveBeenCalledWith(`${BASE_URL}/task-cluster/resolve-merge`, {
        winner_variant_id: 'variant-winner',
        loser_variant_ids: ['variant-loser-1', 'variant-loser-2'],
      });
      expect(result).toEqual(updatedTask);
    });
  });

  describe('confirmReconciliationProvisional', () => {
    it('hace POST a /:id/confirm-provisional sin body y devuelve res.data', async () => {
      const updatedTask = makeTask({ id: 'task-1', status: 'confirmed' });
      mockPost.mockResolvedValueOnce({ data: updatedTask });

      const result = await confirmReconciliationProvisional('task-1');

      expect(mockPost).toHaveBeenCalledWith(`${BASE_URL}/task-1/confirm-provisional`);
      expect(result).toEqual(updatedTask);
    });
  });

  describe('rejectReconciliationTask', () => {
    it('hace POST a /:id/resolve-reject sin body y devuelve res.data', async () => {
      const updatedTask = makeTask({ id: 'task-1', status: 'rejected' });
      mockPost.mockResolvedValueOnce({ data: updatedTask });

      const result = await rejectReconciliationTask('task-1');

      expect(mockPost).toHaveBeenCalledWith(`${BASE_URL}/task-1/resolve-reject`);
      expect(result).toEqual(updatedTask);
    });
  });

  describe('bulkConfirmReconciliationTasks', () => {
    it('hace POST a /bulk-confirm con { task_ids } y devuelve el array de resultados tal cual', async () => {
      mockPost.mockResolvedValueOnce({ data: BULK_RESULTS });

      const result = await bulkConfirmReconciliationTasks(['task-1', 'task-2']);

      expect(mockPost).toHaveBeenCalledWith(`${BASE_URL}/bulk-confirm`, {
        task_ids: ['task-1', 'task-2'],
      });
      expect(result).toEqual(BULK_RESULTS);
    });
  });

  describe('getReconciliationTaskErrorMessage', () => {
    it('devuelve el message string del backend cuando viene', () => {
      const error = {
        isAxiosError: true,
        response: { data: { message: 'Ya existe una tarea confirmada con ese id' } },
      };

      expect(getReconciliationTaskErrorMessage(error, 'fallback genérico')).toBe(
        'Ya existe una tarea confirmada con ese id',
      );
    });

    it('une con ", " el array de mensajes de class-validator cuando no está vacío', () => {
      const error = {
        isAxiosError: true,
        response: {
          data: { message: ['target_variant_id debe ser un UUID', 'target_variant_id no puede estar vacío'] },
        },
      };

      expect(getReconciliationTaskErrorMessage(error, 'fallback genérico')).toBe(
        'target_variant_id debe ser un UUID, target_variant_id no puede estar vacío',
      );
    });

    it('cae al fallback cuando el array de mensajes viene vacío', () => {
      const error = {
        isAxiosError: true,
        response: { data: { message: [] } },
      };

      expect(getReconciliationTaskErrorMessage(error, 'fallback genérico')).toBe(
        'fallback genérico',
      );
    });

    it('cae al fallback cuando el error de axios no tiene response (la request nunca llegó a responder)', () => {
      const error = {
        isAxiosError: true,
        message: 'Network Error',
      };

      expect(getReconciliationTaskErrorMessage(error, 'fallback genérico')).toBe(
        'fallback genérico',
      );
    });

    it('cae al fallback cuando el error no es de axios', () => {
      const error = new Error('algo explotó');

      expect(getReconciliationTaskErrorMessage(error, 'fallback genérico')).toBe(
        'fallback genérico',
      );
    });
  });
});
