/**
 * Tests: aliclikService — cancelAliclikOrder
 *
 * Comportamiento verificado:
 * 1. Hace POST a /aliclik/orders/cancel con body { companyId, orderId }.
 * 2. Incluye header Authorization: Bearer <token>.
 * 3. Retorna res.data (AliclikCancelOrderResult con results[]).
 * 4. Acepta companyId pasado como argumento explícito.
 * 5. Propaga el error cuando axios.post rechaza.
 *
 * axios está completamente mockeado — sin llamadas reales a la red.
 */

jest.mock('axios', () => ({
  default: {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
    defaults: { withCredentials: false },
    isAxiosError: jest.fn(),
  },
  get: jest.fn(),
  post: jest.fn(),
  patch: jest.fn(),
  defaults: { withCredentials: false },
  isAxiosError: jest.fn(),
}));

import axios from 'axios';
import { cancelAliclikOrder } from '@/services/aliclikService';
import type { AliclikCancelOrderResult } from '@/services/aliclikService';

const mockAxiosPost = jest.mocked(axios.post);

const FAKE_TOKEN = 'test-token-cancel';
const ORDER_ID = 'order-xyz';
const COMPANY_ID = 'company-abc';
const BASE_URL = 'http://localhost:3004';

const MOCK_CANCEL_RESULT: AliclikCancelOrderResult = {
  results: [
    { warehouseId: 1, externalOrderNumber: 'ALI-001', result: 'cancelled' },
    { warehouseId: 2, externalOrderNumber: 'ALI-002', result: 'cancel_pending' },
    { warehouseId: 3, externalOrderNumber: null, result: 'rejected', reason: 'El pedido ya fue entregado' },
  ],
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('cancelAliclikOrder', () => {
  // ── 1. Endpoint correcto ─────────────────────────────────────────────────────

  it('hace POST a /aliclik/orders/cancel con body { companyId, orderId }', async () => {
    mockAxiosPost.mockResolvedValue({ data: MOCK_CANCEL_RESULT });

    await cancelAliclikOrder(FAKE_TOKEN, ORDER_ID, COMPANY_ID);

    expect(mockAxiosPost).toHaveBeenCalledWith(
      `${BASE_URL}/aliclik/orders/cancel`,
      { companyId: COMPANY_ID, orderId: ORDER_ID },
      expect.anything(),
    );
  });

  // ── 2. Header Authorization ──────────────────────────────────────────────────

  it('incluye header Authorization: Bearer <token>', async () => {
    mockAxiosPost.mockResolvedValue({ data: MOCK_CANCEL_RESULT });

    await cancelAliclikOrder(FAKE_TOKEN, ORDER_ID, COMPANY_ID);

    const [, , config] = mockAxiosPost.mock.calls[0] as [
      string,
      unknown,
      { headers: Record<string, string> },
    ];
    expect(config.headers.Authorization).toBe(`Bearer ${FAKE_TOKEN}`);
  });

  // ── 3. Retorna res.data ──────────────────────────────────────────────────────

  it('retorna AliclikCancelOrderResult con el array de results', async () => {
    mockAxiosPost.mockResolvedValue({ data: MOCK_CANCEL_RESULT });

    const result = await cancelAliclikOrder(FAKE_TOKEN, ORDER_ID, COMPANY_ID);

    expect(result).toEqual(MOCK_CANCEL_RESULT);
    expect(result.results).toHaveLength(3);
  });

  it('retorna correctamente resultado "cancelled"', async () => {
    mockAxiosPost.mockResolvedValue({ data: MOCK_CANCEL_RESULT });

    const result = await cancelAliclikOrder(FAKE_TOKEN, ORDER_ID, COMPANY_ID);

    expect(result.results[0]).toMatchObject({
      warehouseId: 1,
      result: 'cancelled',
      externalOrderNumber: 'ALI-001',
    });
  });

  it('retorna correctamente resultado "cancel_pending"', async () => {
    mockAxiosPost.mockResolvedValue({ data: MOCK_CANCEL_RESULT });

    const result = await cancelAliclikOrder(FAKE_TOKEN, ORDER_ID, COMPANY_ID);

    expect(result.results[1]).toMatchObject({
      warehouseId: 2,
      result: 'cancel_pending',
    });
  });

  it('retorna correctamente resultado "rejected" con reason', async () => {
    mockAxiosPost.mockResolvedValue({ data: MOCK_CANCEL_RESULT });

    const result = await cancelAliclikOrder(FAKE_TOKEN, ORDER_ID, COMPANY_ID);

    expect(result.results[2]).toMatchObject({
      warehouseId: 3,
      result: 'rejected',
      reason: 'El pedido ya fue entregado',
    });
  });

  // ── 4. Acepta companyId explícito ────────────────────────────────────────────

  it('usa el companyId recibido como argumento en el body', async () => {
    const otherCompany = 'company-otro';
    mockAxiosPost.mockResolvedValue({ data: { results: [] } });

    await cancelAliclikOrder(FAKE_TOKEN, ORDER_ID, otherCompany);

    const [, body] = mockAxiosPost.mock.calls[0] as [string, { companyId: string; orderId: string }];
    expect(body.companyId).toBe(otherCompany);
  });

  it('usa el orderId recibido como argumento en el body', async () => {
    const otherOrder = 'order-otro-456';
    mockAxiosPost.mockResolvedValue({ data: { results: [] } });

    await cancelAliclikOrder(FAKE_TOKEN, otherOrder, COMPANY_ID);

    const [, body] = mockAxiosPost.mock.calls[0] as [string, { companyId: string; orderId: string }];
    expect(body.orderId).toBe(otherOrder);
  });

  // ── 5. Propagación de errores ────────────────────────────────────────────────

  it('propaga el error cuando axios.post rechaza (error de red)', async () => {
    const networkErr = new Error('Network Error');
    mockAxiosPost.mockRejectedValue(networkErr);

    await expect(cancelAliclikOrder(FAKE_TOKEN, ORDER_ID, COMPANY_ID)).rejects.toThrow(
      'Network Error',
    );
  });

  it('propaga el error cuando axios.post rechaza con response del servidor', async () => {
    const serverErr = { response: { data: { message: 'Credenciales inválidas' }, status: 401 } };
    mockAxiosPost.mockRejectedValue(serverErr);

    await expect(cancelAliclikOrder(FAKE_TOKEN, ORDER_ID, COMPANY_ID)).rejects.toEqual(serverErr);
  });
});
