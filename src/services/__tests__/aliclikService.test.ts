/**
 * Tests: aliclikService
 *
 * Comportamiento verificado:
 * 1. quoteAliclikOrder hace GET a la URL correcta con header Bearer.
 * 2. quoteAliclikOrder retorna res.data.
 * 3. createAliclikOrder hace POST a la URL correcta con Bearer y el payload.
 * 4. createAliclikOrder retorna res.data.
 *
 * axios está mockeado para evitar llamadas reales a la red.
 */

jest.mock('axios', () => ({
  default: {
    get: jest.fn(),
    post: jest.fn(),
    defaults: { withCredentials: false },
  },
  get: jest.fn(),
  post: jest.fn(),
  defaults: { withCredentials: false },
}));

import axios from 'axios';
import { quoteAliclikOrder, createAliclikOrder } from '@/services/aliclikService';
import type { AliclikCreateOrderPayload } from '@/services/aliclikService';

const mockAxiosGet = jest.mocked(axios.get);
const mockAxiosPost = jest.mocked(axios.post);

const FAKE_TOKEN = 'Bearer-test-token';
const COMPANY_ID = 'company-abc';
const ORDER_ID = 'order-123';

// La URL base viene de NEXT_PUBLIC_API_INTEGRATIONS o el fallback
const BASE_URL = 'http://localhost:3004';

const MOCK_QUOTE_RESPONSE = {
  orderId: ORDER_ID,
  orderNumber: 'ORD-001',
  companyId: COMPANY_ID,
  shippingTotalSugerido: 20.0,
  customer: {
    lat: -12.0, lng: -77.0,
    fullName: 'Test Cliente', province: 'Lima', city: 'Lima', district: 'Barranco',
  },
  warehouses: [],
  unresolvedItems: [],
};

const MOCK_CREATE_RESULT = {
  shipments: [{ warehouseId: 1, externalOrderNumber: 'ALI-99999' }],
};

const MOCK_PAYLOAD: AliclikCreateOrderPayload = {
  companyId: COMPANY_ID,
  orderId: ORDER_ID,
  channel: 'whatsapp',
  note: 'Nota de prueba',
  shipments: [
    {
      warehouseId: 1,
      delivery: 15.5,
      courier: {
        transportId: 100,
        deliveryCost: 15.5,
        returnCost: 8.0,
        addDays: 2,
        flagDeliveryExpress: false,
        schedule: null,
        scheduleExpressStart: null,
        scheduleExpressEnd: null,
      },
    },
  ],
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('aliclikService', () => {

  describe('quoteAliclikOrder', () => {
    it('hace GET a la URL correcta incluyendo companyId y orderId', async () => {
      mockAxiosGet.mockResolvedValue({ data: MOCK_QUOTE_RESPONSE });
      await quoteAliclikOrder(FAKE_TOKEN, COMPANY_ID, ORDER_ID);
      expect(mockAxiosGet).toHaveBeenCalledWith(
        `${BASE_URL}/aliclik/${COMPANY_ID}/orders/${ORDER_ID}/quote`,
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: `Bearer ${FAKE_TOKEN}`,
          }),
        }),
      );
    });

    it('retorna res.data de la respuesta', async () => {
      mockAxiosGet.mockResolvedValue({ data: MOCK_QUOTE_RESPONSE });
      const result = await quoteAliclikOrder(FAKE_TOKEN, COMPANY_ID, ORDER_ID);
      expect(result).toEqual(MOCK_QUOTE_RESPONSE);
    });

    it('propaga el error cuando axios.get rechaza', async () => {
      const error = new Error('Network Error');
      mockAxiosGet.mockRejectedValue(error);
      await expect(quoteAliclikOrder(FAKE_TOKEN, COMPANY_ID, ORDER_ID)).rejects.toThrow('Network Error');
    });
  });

  describe('createAliclikOrder', () => {
    it('hace POST a /aliclik/orders con el payload completo', async () => {
      mockAxiosPost.mockResolvedValue({ data: MOCK_CREATE_RESULT });
      await createAliclikOrder(FAKE_TOKEN, MOCK_PAYLOAD);
      expect(mockAxiosPost).toHaveBeenCalledWith(
        `${BASE_URL}/aliclik/orders`,
        MOCK_PAYLOAD,
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: `Bearer ${FAKE_TOKEN}`,
          }),
        }),
      );
    });

    it('retorna res.data de la respuesta', async () => {
      mockAxiosPost.mockResolvedValue({ data: MOCK_CREATE_RESULT });
      const result = await createAliclikOrder(FAKE_TOKEN, MOCK_PAYLOAD);
      expect(result).toEqual(MOCK_CREATE_RESULT);
    });

    it('propaga el error cuando axios.post rechaza', async () => {
      const error = { response: { data: { message: 'Unauthorized' } } };
      mockAxiosPost.mockRejectedValue(error);
      await expect(createAliclikOrder(FAKE_TOKEN, MOCK_PAYLOAD)).rejects.toEqual(error);
    });

    it('el header Authorization incluye el token recibido', async () => {
      mockAxiosPost.mockResolvedValue({ data: MOCK_CREATE_RESULT });
      await createAliclikOrder('mi-token-secreto', MOCK_PAYLOAD);
      const [, , config] = mockAxiosPost.mock.calls[0] as [string, unknown, { headers: Record<string, string> }];
      expect(config.headers.Authorization).toBe('Bearer mi-token-secreto');
    });
  });
});
