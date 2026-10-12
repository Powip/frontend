import axiosAuth from '@/lib/axiosAuth';
import { getAllPedidosCC, getPedidosCC, getKpisCC } from '../atencionClienteService';
import type { OrderHeader, KpisCC } from '@/interfaces/IOrder';

jest.mock('@/lib/axiosAuth', () => ({ __esModule: true, default: { get: jest.fn() } }));
const get = jest.mocked(axiosAuth.get);
const row = (id: string, storeId: string, created_at: string) => ({ id, storeId, inventoryId: 'shared-warehouse', stockStoreId: 'warehouse-owner', created_at }) as OrderHeader;

beforeEach(() => get.mockReset());

it('une las tiendas del negocio, ordena globalmente y pagina sin perder el origen del pedido', async () => {
  const signal = new AbortController().signal;
  get.mockImplementation(async (url) => {
    const params = new URLSearchParams(String(url).split('?')[1]);
    const storeId = params.get('storeId')!;
    const data = storeId === 'KUNCA' ? [row('old', storeId, '2026-10-01')] : [row('new', storeId, '2026-10-12')];
    return { data: { data, total: data.length, totalPages: 1 } };
  });
  const result = await getPedidosCC({ storeIds: ['KUNCA', 'WEB', 'WEB'], page: 1, limit: 1, subEstado: 'contactado' }, signal);
  expect(result).toMatchObject({ total: 2, totalPages: 2, data: [{ id: 'new', storeId: 'WEB', inventoryId: 'shared-warehouse', stockStoreId: 'warehouse-owner' }] });
  expect(get).toHaveBeenCalledTimes(2);
  for (const [url, config] of get.mock.calls) {
    expect(String(url)).toContain('subEstado=contactado');
    expect(config?.signal).toBe(signal);
  }
});

it('busca en todas las páginas aunque backend aplique un límite menor', async () => {
  get.mockImplementation(async (url) => {
    const params = new URLSearchParams(String(url).split('?')[1]);
    const page = Number(params.get('page'));
    return { data: { data: [row(`r${page}`, 'WEB', '2026-10-12')], total: 3, totalPages: 3 } };
  });
  const result = await getAllPedidosCC({ storeIds: ['KUNCA', 'WEB'] });
  expect(result.truncated).toBe(false);
  expect(get).toHaveBeenCalledTimes(6);
});

it('una tienda vacía no oculta los pedidos de su hermana', async () => {
  get.mockImplementation(async (url) => {
    const storeId = new URLSearchParams(String(url).split('?')[1]).get('storeId');
    const data = storeId === 'WEB' ? [row('web-order', 'WEB', '2026-10-12')] : [];
    return { data: { data, total: data.length, totalPages: 1 } };
  });
  expect((await getAllPedidosCC({ storeIds: ['KUNCA', 'WEB'] })).data.map((order) => order.id)).toEqual(['web-order']);
  expect((await getAllPedidosCC({ storeIds: ['KUNCA'] })).data).toEqual([]);
});

it('falla toda la lectura si una tienda responde error: no entrega una lista parcial como completa', async () => {
  get.mockImplementation(async (url) => {
    if (String(url).includes('storeId=WEB')) throw new Error('401');
    return { data: { data: [], total: 0, totalPages: 1 } };
  });
  await expect(getPedidosCC({ storeIds: ['KUNCA', 'WEB'] })).rejects.toThrow('401');
});

it('rechaza una página global incompleta en lugar de anunciar un total vacío', async () => {
  get.mockResolvedValue({ data: { data: [row('only', 'WEB', '2026-10-12')], total: 5000, totalPages: 25 } });
  await expect(getPedidosCC({ storeIds: ['WEB'] })).rejects.toThrow('todos los pedidos');
});

it('suma conteos y calcula efectividad con bases, sin promediar porcentajes', async () => {
  get.mockImplementation(async (_url, config) => {
    const isKunca = config?.params.storeId === 'KUNCA';
    return { data: { por_confirmar: isKunca ? 1 : 4, confirmadosHoy: isKunca ? 1 : 3, gestionadosHoy: isKunca ? 1 : 9, efectividadHoy: isKunca ? 100 : 33, confirmadosMes: isKunca ? 1 : 3, gestionadosMes: isKunca ? 1 : 9, efectividadMes: isKunca ? 100 : 33, upsellHoy: 1, upsellMensual: 2 } as KpisCC };
  });
  const result = await getKpisCC('cod', ['KUNCA', 'WEB']);
  expect(result).toMatchObject({ por_confirmar: 5, confirmadosHoy: 4, gestionadosHoy: 10, efectividadHoy: 40, efectividadMes: 40, upsellHoy: 2, upsellMensual: 4 });
});

it('API antiguo sin bases diarias no inventa un porcentaje agregado', async () => {
  get.mockResolvedValue({ data: { efectividadHoy: 75, confirmadosMes: 3, gestionadosMes: 4 } });
  expect(Number.isNaN((await getKpisCC('cod', ['KUNCA', 'WEB'])).efectividadHoy)).toBe(true);
});

it('desempeño de agentes une cada persona una vez y recalcula tickets y tasas con las bases sumadas', async () => {
  const { getAgentesPerformance } = await import('../agentesService');
  get.mockImplementation(async (url) => {
    const isKunca = String(url).includes('storeId=KUNCA');
    return { data: [{ id: 'same-agent', nombre: 'Ana', asignados: isKunca ? 1 : 9, contactados: isKunca ? 1 : 3, confirmados: isKunca ? 1 : 3, entregados: isKunca ? 1 : 1, ventasConfirmadas: isKunca ? 100 : 600, unidades: 1, facturacionBase: isKunca ? 90 : 570, upsellMonto: isKunca ? 10 : 30 }] };
  });
  const result = await getAgentesPerformance(['KUNCA', 'WEB'], 'company', '2026-10-01', '2026-10-31');
  expect(result).toHaveLength(1);
  expect(result[0]).toMatchObject({ asignados: 10, contactados: 4, confirmados: 4, entregados: 2, pctContactados: 40, pctConfirmados: 40, pctEntregados: 50, ticketPromedio: 175, ticketFinal: 175, unidades: 2 });
});

it('desempeño no presenta un ranking parcial si una tienda falla', async () => {
  const { getAgentesPerformance } = await import('../agentesService');
  get.mockImplementation(async (url) => {
    if (String(url).includes('storeId=WEB')) throw new Error('401');
    return { data: [] };
  });
  await expect(getAgentesPerformance(['KUNCA', 'WEB'], 'company', 'from', 'to')).rejects.toThrow('401');
});
