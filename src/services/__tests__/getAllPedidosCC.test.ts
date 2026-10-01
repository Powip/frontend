/**
 * Tests: getAllPedidosCC — conjunto completo de la pestaña para el buscador
 *
 * 1. Recorre todas las páginas y concatena los pedidos, con los mismos filtros en cada request.
 * 2. No asume que el backend respete limit=200: si devuelve páginas más chicas
 *    (y totalPages calculado con otro tamaño), sigue hasta cubrir `total`.
 * 3. Marca `truncated` cuando lo traído es menor que `total` (tope de páginas).
 * 4. Sin `total` en la respuesta, usa totalPages como respaldo.
 * 5. Deduplica por id si el listado se desplaza entre páginas.
 * 6. Propaga el AbortSignal a cada request.
 */
jest.mock('@/lib/axiosAuth', () => ({
  __esModule: true,
  default: { get: jest.fn() },
}));

import axiosAuth from '@/lib/axiosAuth';
import { getAllPedidosCC } from '../atencionClienteService';

const get = jest.mocked(axiosAuth.get);

function pageParam(url: unknown) {
  return Number(new URL(String(url), 'http://x').searchParams.get('page'));
}

/** Backend simulado: `total` pedidos, sirve `served` por página sin importar `limit`. */
function backend(total: number, served: number, opts: { totalPages?: number; omitTotal?: boolean } = {}) {
  return async (url: unknown) => {
    const n = pageParam(url);
    const start = (n - 1) * served;
    const count = Math.max(0, Math.min(served, total - start));
    return {
      data: {
        data: Array.from({ length: count }, (_, i) => ({ id: `o${start + i}` })),
        ...(opts.omitTotal ? {} : { total }),
        page: n,
        totalPages: opts.totalPages ?? Math.ceil(total / served),
      },
    };
  };
}

describe('getAllPedidosCC', () => {
  beforeEach(() => get.mockReset());

  it('recorre todas las páginas con los mismos filtros', async () => {
    get.mockImplementation(backend(450, 200) as never);

    const res = await getAllPedidosCC({
      storeId: 's1',
      tipoGestion: 'cod',
      subEstado: 'no_contesta',
      canalOrigen: 'releasit',
      agenteId: 'ag1',
      startDate: '2026-09-01T00:00:00.000Z',
    });

    expect(get).toHaveBeenCalledTimes(3);
    expect(res.data).toHaveLength(450);
    expect(res).toMatchObject({ total: 450, truncated: false });

    get.mock.calls.forEach(([url], i) => {
      const params = new URL(String(url), 'http://x').searchParams;
      expect(params.get('subEstado')).toBe('no_contesta');
      expect(params.get('canalOrigen')).toBe('releasit');
      expect(params.get('agenteId')).toBe('ag1');
      expect(params.get('startDate')).toBe('2026-09-01T00:00:00.000Z');
      expect(params.get('limit')).toBe('200');
      expect(params.get('page')).toBe(String(i + 1));
    });
  });

  it('si el backend limita a 50 por página y reporta totalPages con 200, sigue hasta cubrir total', async () => {
    // total 180 → el backend dice totalPages=1 (180/200) pero entrega 50 por página
    get.mockImplementation(backend(180, 50, { totalPages: 1 }) as never);
    const res = await getAllPedidosCC({ storeId: 's1' });
    expect(get).toHaveBeenCalledTimes(4);
    expect(res.data).toHaveLength(180);
    expect(res.truncated).toBe(false);
  });

  it('marca truncated cuando el tope de páginas deja pedidos sin traer', async () => {
    get.mockImplementation(backend(1500, 50) as never); // 20 × 50 = 1000 < 1500
    const res = await getAllPedidosCC({ storeId: 's1' });
    expect(get).toHaveBeenCalledTimes(20);
    expect(res.data).toHaveLength(1000);
    expect(res).toMatchObject({ total: 1500, truncated: true });
  });

  it('sin total en la respuesta usa totalPages como respaldo', async () => {
    get.mockImplementation(backend(300, 200, { omitTotal: true }) as never);
    const res = await getAllPedidosCC({ storeId: 's1' });
    expect(get).toHaveBeenCalledTimes(2);
    expect(res).toMatchObject({ total: 300, truncated: false });
  });

  it('deduplica pedidos repetidos entre páginas', async () => {
    get
      .mockResolvedValueOnce({ data: { data: [{ id: 'a' }, { id: 'b' }], total: 3, page: 1, totalPages: 2 } })
      .mockResolvedValueOnce({ data: { data: [{ id: 'b' }, { id: 'c' }], total: 3, page: 2, totalPages: 2 } });
    const res = await getAllPedidosCC({ storeId: 's1' });
    expect(res.data.map((o) => o.id)).toEqual(['a', 'b', 'c']);
    expect(res.truncated).toBe(false);
  });

  it('propaga el AbortSignal', async () => {
    get.mockImplementation(backend(10, 200) as never);
    const controller = new AbortController();
    await getAllPedidosCC({ storeId: 's1' }, controller.signal);
    expect(get.mock.calls[0][1]).toEqual({ signal: controller.signal });
  });
});
