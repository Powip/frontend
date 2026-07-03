import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useUpsellRecords } from '../useUpsellRecords';
import { getUpsellRecords } from '@/services/atencionClienteService';
import type { CcUpsellRecordsResponse } from '@/interfaces/IOrder';

// ── Mock del service HTTP — nunca llamadas reales ─────────────────────────────
jest.mock('@/services/atencionClienteService', () => ({
  getUpsellRecords: jest.fn(),
}));

const mockGetUpsellRecords = jest.mocked(getUpsellRecords);

// ── Fixtures ──────────────────────────────────────────────────────────────────

const MOCK_RESPONSE: CcUpsellRecordsResponse = {
  items: [
    {
      id: 'rec-001',
      orderNumber: '1001',
      productName: 'Camiseta Negra',
      sku: 'CAM-01',
      quantity: 2,
      unitPrice: 50,
      subtotal: 100,
      addedByName: 'Ana García',
      sellerName: 'Carlos López',
      shop: 'tiendaA.myshopify.com',
      createdAt: '2026-05-10T14:00:00.000Z',
    },
  ],
  totalMonto: 100,
  totalUnidades: 2,
  totalRegistros: 1,
};

const STORE_ID = 'store-abc';

const RANGE = {
  from: new Date('2026-05-01T00:00:00.000Z'),
  to: new Date('2026-05-31T23:59:59.000Z'),
};

// ── Helper: wrapper con QueryClientProvider ───────────────────────────────────

function buildWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: 0,
      },
    },
  });
  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
  return wrapper;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useUpsellRecords', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  // ── 1. Llamada al service con los parámetros correctos ────────────────────

  describe('llamada al service', () => {
    it('llama a getUpsellRecords con storeId, startDate y endDate derivados del range', async () => {
      mockGetUpsellRecords.mockResolvedValue(MOCK_RESPONSE);

      const { result } = renderHook(
        () => useUpsellRecords(STORE_ID, RANGE),
        { wrapper: buildWrapper() },
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockGetUpsellRecords).toHaveBeenCalledTimes(1);
      expect(mockGetUpsellRecords).toHaveBeenCalledWith(
        STORE_ID,
        RANGE.from.toISOString(),
        RANGE.to.toISOString(),
      );
    });

    it('expone la data devuelta por el service', async () => {
      mockGetUpsellRecords.mockResolvedValue(MOCK_RESPONSE);

      const { result } = renderHook(
        () => useUpsellRecords(STORE_ID, RANGE),
        { wrapper: buildWrapper() },
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toEqual(MOCK_RESPONSE);
    });

    it('expone los items del response', async () => {
      mockGetUpsellRecords.mockResolvedValue(MOCK_RESPONSE);

      const { result } = renderHook(
        () => useUpsellRecords(STORE_ID, RANGE),
        { wrapper: buildWrapper() },
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data?.items).toHaveLength(1);
      expect(result.current.data?.items[0].orderNumber).toBe('1001');
    });
  });

  // ── 2. Estado inicial — isLoading ─────────────────────────────────────────

  describe('estado inicial', () => {
    it('inicia con isLoading=true antes de resolver', () => {
      // Promesa que nunca resuelve — mantiene el estado de loading
      mockGetUpsellRecords.mockReturnValue(new Promise(() => {}));

      const { result } = renderHook(
        () => useUpsellRecords(STORE_ID, RANGE),
        { wrapper: buildWrapper() },
      );

      expect(result.current.isLoading).toBe(true);
      expect(result.current.data).toBeUndefined();
    });
  });

  // ── 3. Query deshabilitada cuando faltan parámetros ───────────────────────

  describe('query deshabilitada', () => {
    it('NO llama al service cuando storeId es null', () => {
      mockGetUpsellRecords.mockResolvedValue(MOCK_RESPONSE);

      renderHook(
        () => useUpsellRecords(null, RANGE),
        { wrapper: buildWrapper() },
      );

      expect(mockGetUpsellRecords).not.toHaveBeenCalled();
    });

    it('NO llama al service cuando storeId es undefined', () => {
      mockGetUpsellRecords.mockResolvedValue(MOCK_RESPONSE);

      renderHook(
        () => useUpsellRecords(undefined, RANGE),
        { wrapper: buildWrapper() },
      );

      expect(mockGetUpsellRecords).not.toHaveBeenCalled();
    });

    it('NO llama al service cuando range es undefined', () => {
      mockGetUpsellRecords.mockResolvedValue(MOCK_RESPONSE);

      renderHook(
        () => useUpsellRecords(STORE_ID, undefined),
        { wrapper: buildWrapper() },
      );

      expect(mockGetUpsellRecords).not.toHaveBeenCalled();
    });

    it('NO llama al service cuando range.from es undefined', () => {
      mockGetUpsellRecords.mockResolvedValue(MOCK_RESPONSE);

      renderHook(
        () => useUpsellRecords(STORE_ID, { from: undefined, to: RANGE.to }),
        { wrapper: buildWrapper() },
      );

      expect(mockGetUpsellRecords).not.toHaveBeenCalled();
    });

    it('NO llama al service cuando range.to es undefined', () => {
      mockGetUpsellRecords.mockResolvedValue(MOCK_RESPONSE);

      renderHook(
        () => useUpsellRecords(STORE_ID, { from: RANGE.from, to: undefined }),
        { wrapper: buildWrapper() },
      );

      expect(mockGetUpsellRecords).not.toHaveBeenCalled();
    });
  });

  // ── 4. Estado de error ────────────────────────────────────────────────────

  describe('estado de error', () => {
    it('expone isError=true cuando el service rechaza', async () => {
      mockGetUpsellRecords.mockRejectedValue(new Error('Error del servidor'));

      const { result } = renderHook(
        () => useUpsellRecords(STORE_ID, RANGE),
        { wrapper: buildWrapper() },
      );

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(result.current.data).toBeUndefined();
    });
  });
});
