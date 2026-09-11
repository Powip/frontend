/**
 * Tests: useShalomLiveStatuses (components/tracking/useShalomLiveStatus.ts)
 *
 * Comportamiento verificado (fix de tracking en lote):
 * 1. Con <=50 pedidos elegibles -> `trackShalomMassive` se llama UNA sola vez con
 *    todos los pares { orderNumber, orderCode } (no N requests sueltos).
 * 2. Con >50 pedidos -> se parte en chunks de 50 (120 -> 3 llamadas).
 * 3. La respuesta del lote se mapea a `liveStatuses[orderId]` derivando el ultimo
 *    paso desde `statuses.data` ({ transito: {...} } -> "En Tránsito"). La clave
 *    de reasociacion se normaliza (trim + upper) en ambos lados del Map, asi que
 *    un `orderCode` con espacio/case distinto igual matchea.
 * 4. Si un chunk rechaza, los demas chunks igual resuelven y `loadingLiveStatuses`
 *    vuelve a false; los badges ya resueltos (merge por chunk) se conservan.
 * 5. Pedidos sin `externalTrackingNumber` o sin `shippingCode` no entran en la llamada.
 * 6. Sin pedidos / sin pedidos elegibles / sin accessToken -> no se llama al service.
 * 7. Se rastrea aunque `auth.company` sea null (se quito el gate por company id).
 *
 * Mocks:
 * - @/contexts/AuthContext -> useAuth
 * - @/services/shalomService -> trackShalomMassive
 */

import { renderHook, waitFor } from '@testing-library/react';

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: jest.fn(),
}));

jest.mock('@/services/shalomService', () => ({
  trackShalomMassive: jest.fn(),
}));

import { useAuth } from '@/contexts/AuthContext';
import { trackShalomMassive } from '@/services/shalomService';
import { useShalomLiveStatuses } from '../useShalomLiveStatus';
import type { OrderHeader } from '@/interfaces/IOrder';

// ── Casts ─────────────────────────────────────────────────────────────────────

const mockUseAuth = jest.mocked(useAuth);
const mockTrack = trackShalomMassive as jest.Mock;

// ── Fixtures ──────────────────────────────────────────────────────────────────

const AUTH_WITH_TOKEN = {
  auth: { accessToken: 'fake-token', company: { id: 'company-1' } },
} as unknown as ReturnType<typeof useAuth>;

/**
 * Pedidos Shalom elegibles: `externalTrackingNumber` de 8 digitos + `shippingCode`.
 * `id` = `ord-<i>`, tracking = `1000` + i con padding a 4, code = `C<i>`.
 */
function eligibleOrders(count: number, startIdx = 0): OrderHeader[] {
  return Array.from({ length: count }, (_, k) => {
    const i = startIdx + k;
    return {
      id: `ord-${i}`,
      externalTrackingNumber: `1000${String(i).padStart(4, '0')}`,
      shippingCode: `C${i}`,
    } as unknown as OrderHeader;
  });
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  mockTrack.mockReset();
  mockTrack.mockResolvedValue([]);
  mockUseAuth.mockReturnValue(AUTH_WITH_TOKEN);
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useShalomLiveStatuses', () => {
  // ── 1. Una sola llamada en lote ─────────────────────────────────────────────

  it('con <=50 pedidos elegibles llama a trackShalomMassive una sola vez con todos los pares', async () => {
    const orders = eligibleOrders(30);

    const { result } = renderHook(() => useShalomLiveStatuses(orders));

    await waitFor(() => expect(mockTrack).toHaveBeenCalled());
    await waitFor(() => expect(result.current.loadingLiveStatuses).toBe(false));

    expect(mockTrack).toHaveBeenCalledTimes(1);

    const [token, batch] = mockTrack.mock.calls[0];
    expect(token).toBe('fake-token');
    expect(batch).toHaveLength(30);
    expect(batch[0]).toEqual({ orderNumber: '10000000', orderCode: 'C0' });
    expect(batch[29]).toEqual({ orderNumber: '10000029', orderCode: 'C29' });
  });

  // ── 2. Chunks de 50 ────────────────────────────────────────────────────────

  it('con >50 pedidos elegibles parte en chunks de 50 (120 -> 3 llamadas)', async () => {
    const orders = eligibleOrders(120);

    const { result } = renderHook(() => useShalomLiveStatuses(orders));

    await waitFor(() => expect(mockTrack).toHaveBeenCalledTimes(3));
    await waitFor(() => expect(result.current.loadingLiveStatuses).toBe(false));

    expect(mockTrack.mock.calls[0][1]).toHaveLength(50);
    expect(mockTrack.mock.calls[1][1]).toHaveLength(50);
    expect(mockTrack.mock.calls[2][1]).toHaveLength(20);
  });

  // ── 3. Mapeo de la respuesta al paso correcto ──────────────────────────────

  it('mapea la respuesta del lote a liveStatuses[orderId] derivando el paso desde statuses.data', async () => {
    const orders = eligibleOrders(1); // ord-0 / 10000000 / C0
    mockTrack.mockResolvedValue([
      {
        orderNumber: '10000000',
        orderCode: 'C0',
        search: { success: true, message: 'ok' },
        // El item del lote trae `statuses` en la raiz (no anidado bajo `data`).
        statuses: {
          data: {
            registrado: { fecha: '2026-01-01' },
            origen: { fecha: '2026-01-02' },
            transito: { fecha: '2026-01-03' },
          },
        },
      },
    ]);

    const { result } = renderHook(() => useShalomLiveStatuses(orders));

    await waitFor(() =>
      expect(result.current.liveStatuses['ord-0']).toBe('En Tránsito'),
    );
  });

  it('reasocia aunque el proveedor ecoe el orderCode con distinto case/espacios', async () => {
    // En prod se vio `shippingCode` con espacio final ("CHJN "); el proveedor
    // puede devolver el codigo trimmeado y/o en otro case. La clave del Map se
    // normaliza en ambos lados, asi que igual debe matchear.
    const orders: OrderHeader[] = [
      {
        id: 'ord-space',
        externalTrackingNumber: '10009999',
        shippingCode: 'CHJN ',
      } as unknown as OrderHeader,
    ];
    mockTrack.mockResolvedValue([
      {
        orderNumber: '10009999',
        orderCode: 'chjn', // trimmeado + minuscula
        statuses: {
          data: {
            registrado: { fecha: 'x' },
            transito: { fecha: 'y' },
          },
        },
      },
    ]);

    const { result } = renderHook(() => useShalomLiveStatuses(orders));

    await waitFor(() =>
      expect(result.current.liveStatuses['ord-space']).toBe('En Tránsito'),
    );
  });

  it('ignora los items del lote que no matchean ningun pedido conocido', async () => {
    const orders = eligibleOrders(1); // ord-0 / 10000000 / C0
    mockTrack.mockResolvedValue([
      {
        orderNumber: '99999999',
        orderCode: 'ZZZZ',
        statuses: { data: { entregado: { fecha: 'x' } } },
      },
    ]);

    const { result } = renderHook(() => useShalomLiveStatuses(orders));

    await waitFor(() => expect(result.current.loadingLiveStatuses).toBe(false));
    expect(result.current.liveStatuses).toEqual({});
  });

  // ── 4. Un chunk falla, el resto sigue ──────────────────────────────────────

  it('si un chunk rechaza, los demas chunks resuelven y loadingLiveStatuses vuelve a false', async () => {
    const orders = eligibleOrders(120);
    mockTrack
      .mockRejectedValueOnce(new Error('429 Too Many Requests')) // chunk 1 (ord-0..49)
      .mockResolvedValueOnce([
        {
          orderNumber: '10000050', // primer pedido del chunk 2
          orderCode: 'C50',
          statuses: { data: { entregado: { fecha: '2026-02-01' } } },
        },
      ])
      .mockResolvedValueOnce([]); // chunk 3

    const { result } = renderHook(() => useShalomLiveStatuses(orders));

    await waitFor(() => expect(mockTrack).toHaveBeenCalledTimes(3));
    await waitFor(() => expect(result.current.loadingLiveStatuses).toBe(false));

    // El chunk que fallo no aborta el resto: el status del chunk 2 si se mapeo.
    expect(result.current.liveStatuses['ord-50']).toBe('Entregado');
  });

  // ── 5. Filtrado de pedidos no elegibles ────────────────────────────────────

  it('excluye de la llamada los pedidos sin externalTrackingNumber o sin shippingCode', async () => {
    const orders: OrderHeader[] = [
      { id: 'ok', externalTrackingNumber: '10000001', shippingCode: 'ABCD' } as unknown as OrderHeader,
      { id: 'sin-code', externalTrackingNumber: '10000002', shippingCode: null } as unknown as OrderHeader,
      { id: 'sin-track', externalTrackingNumber: null, shippingCode: 'EFGH' } as unknown as OrderHeader,
      { id: 'ninguno', externalTrackingNumber: null, shippingCode: null } as unknown as OrderHeader,
    ];

    const { result } = renderHook(() => useShalomLiveStatuses(orders));

    await waitFor(() => expect(mockTrack).toHaveBeenCalled());
    await waitFor(() => expect(result.current.loadingLiveStatuses).toBe(false));

    expect(mockTrack).toHaveBeenCalledTimes(1);
    expect(mockTrack.mock.calls[0][1]).toEqual([
      { orderNumber: '10000001', orderCode: 'ABCD' },
    ]);
  });

  it('no llama a trackShalomMassive si ningun pedido es elegible', async () => {
    const orders: OrderHeader[] = [
      { id: 'a', externalTrackingNumber: null, shippingCode: null } as unknown as OrderHeader,
      { id: 'b', externalTrackingNumber: '123', shippingCode: null } as unknown as OrderHeader,
    ];

    const { result } = renderHook(() => useShalomLiveStatuses(orders));

    await waitFor(() => expect(result.current.loadingLiveStatuses).toBe(false));
    expect(mockTrack).not.toHaveBeenCalled();
  });

  it('no llama a trackShalomMassive cuando la lista de pedidos esta vacia', () => {
    const { result } = renderHook(() => useShalomLiveStatuses([]));

    expect(mockTrack).not.toHaveBeenCalled();
    expect(result.current.loadingLiveStatuses).toBe(false);
  });

  // ── 6. Gate por token / sin gate por company ───────────────────────────────

  it('no llama a trackShalomMassive si no hay accessToken en el auth', async () => {
    mockUseAuth.mockReturnValue({ auth: null } as unknown as ReturnType<typeof useAuth>);

    const { result } = renderHook(() => useShalomLiveStatuses(eligibleOrders(3)));

    await waitFor(() => expect(result.current.loadingLiveStatuses).toBe(false));
    expect(mockTrack).not.toHaveBeenCalled();
  });

  it('rastrea aunque auth.company sea null: ya no hay gate por company id', async () => {
    mockUseAuth.mockReturnValue({
      auth: { accessToken: 'fake-token', company: null },
    } as unknown as ReturnType<typeof useAuth>);

    const { result } = renderHook(() => useShalomLiveStatuses(eligibleOrders(3)));

    await waitFor(() => expect(mockTrack).toHaveBeenCalled());
    await waitFor(() => expect(result.current.loadingLiveStatuses).toBe(false));

    expect(mockTrack).toHaveBeenCalledWith('fake-token', expect.any(Array));
  });
});
