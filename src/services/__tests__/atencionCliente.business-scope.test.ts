import axiosAuth from '@/lib/axiosAuth';
import { getAllPedidosCC, getPedidosCC, getKpisCC } from '../atencionClienteService';
import type { OrderHeader, KpisCC } from '@/interfaces/IOrder';

jest.mock('@/lib/axiosAuth', () => ({ __esModule: true, default: { get: jest.fn() } }));
const get = jest.mocked(axiosAuth.get);
const row = (id: string, storeId: string, created_at: string) => ({ id, storeId, inventoryId: 'shared-warehouse', stockStoreId: 'warehouse-owner', created_at }) as OrderHeader;

beforeEach(() => get.mockReset());

it('pide una sola página global al servidor y conserva total, orden y origen', async () => {
  const signal = new AbortController().signal;
  const response = { data: [row('new', 'WEB', '2026-10-12')], total: 5000, page: 2, totalPages: 100 };
  get.mockResolvedValue({ data: response });
  const result = await getPedidosCC({ storeIds: ['KUNCA', 'WEB', 'WEB'], page: 2, limit: 50, subEstado: 'contactado' }, signal);
  expect(result).toBe(response);
  expect(get).toHaveBeenCalledTimes(1);
  const [url, config] = get.mock.calls[0];
  const params = new URLSearchParams(String(url).split('?')[1]);
  expect(params.get('storeIds')).toBe('KUNCA,WEB');
  expect(params.has('storeId')).toBe(false);
  expect(params.get('page')).toBe('2');
  expect(params.get('limit')).toBe('50');
  expect(params.get('subEstado')).toBe('contactado');
  expect(config?.signal).toBe(signal);
});

it('envía la búsqueda al servidor junto al alcance, filtros y paginación', async () => {
  get.mockResolvedValue({ data: { data: [], total: 0, page: 2, totalPages: 1 } });
  await getPedidosCC({ storeIds: ['WEB', 'KUNCA'], search: '  ORD-059_%  ', page: 2, limit: 50, subEstado: 'contactado', agenteId: 'agent' });
  const params = new URLSearchParams(String(get.mock.calls[0][0]).split('?')[1]);
  expect(params.get('search')).toBe('ORD-059_%');
  expect(params.get('storeIds')).toBe('KUNCA,WEB');
  expect(params.get('page')).toBe('2');
  expect(params.get('subEstado')).toBe('contactado');
  expect(params.get('agenteId')).toBe('agent');
  expect(get).toHaveBeenCalledTimes(1);
});

it('descarga explícitamente todas las páginas aunque backend aplique un límite menor', async () => {
  get.mockImplementation(async (url) => {
    const params = new URLSearchParams(String(url).split('?')[1]);
    const page = Number(params.get('page'));
    return { data: { data: [row(`r${page}`, 'WEB', '2026-10-12')], total: 3, totalPages: 3 } };
  });
  const result = await getAllPedidosCC({ storeIds: ['KUNCA', 'WEB'] });
  expect(result.truncated).toBe(false);
  expect(get).toHaveBeenCalledTimes(3);
  for (const [url] of get.mock.calls) {
    const params = new URLSearchParams(String(url).split('?')[1]);
    expect(params.get('storeIds')).toBe('KUNCA,WEB');
    expect(params.has('storeId')).toBe(false);
  }
});

it('una tienda vacía no oculta los pedidos de su hermana', async () => {
  get.mockImplementation(async (url) => {
    const ids = new URLSearchParams(String(url).split('?')[1]).get('storeIds');
    const data = ids?.includes('WEB') ? [row('web-order', 'WEB', '2026-10-12')] : [];
    return { data: { data, total: data.length, totalPages: 1 } };
  });
  expect((await getAllPedidosCC({ storeIds: ['KUNCA', 'WEB'] })).data.map((order) => order.id)).toEqual(['web-order']);
  expect((await getAllPedidosCC({ storeIds: ['KUNCA'] })).data).toEqual([]);
});

it('propaga el rechazo del alcance global sin anunciar una lista parcial', async () => {
  get.mockRejectedValue(new Error('401'));
  await expect(getPedidosCC({ storeIds: ['KUNCA', 'WEB'] })).rejects.toThrow('401');
  expect(get).toHaveBeenCalledTimes(1);
});

it.each([{}, { storeIds: [] }, { storeId: 'WEB', storeIds: ['KUNCA'] }])('no consulta sin alcance explícito o con ambos filtros: %j', async (filters) => {
  await expect(getPedidosCC(filters)).rejects.toThrow('Selecciona tiendas');
  expect(get).not.toHaveBeenCalled();
});

it('usa el KPI agregado del servidor en una llamada con la misma señal de cancelación', async () => {
  const signal = new AbortController().signal;
  const data = { por_confirmar: 5, confirmadosHoy: 4, gestionadosHoy: 10, efectividadHoy: 40,
    confirmadosMes: 4, gestionadosMes: 10, efectividadMes: 40, upsellHoy: 2, upsellMensual: 4 } as KpisCC;
  get.mockResolvedValue({ data });
  const result = await getKpisCC('cod', ['WEB', 'KUNCA', 'WEB'], signal);
  expect(result).toMatchObject({ por_confirmar: 5, confirmadosHoy: 4, gestionadosHoy: 10, efectividadHoy: 40, efectividadMes: 40, upsellHoy: 2, upsellMensual: 4 });
  expect(result).toBe(data);
  expect(get).toHaveBeenCalledTimes(1);
  expect(get.mock.calls[0][1]).toEqual({ params: { tipoGestion: 'cod', storeIds: 'KUNCA,WEB' }, signal });
});

it('conserva storeId para la lectura existente de una tienda', async () => {
  get.mockResolvedValue({ data: { efectividadHoy: 75, confirmadosMes: 3, gestionadosMes: 4 } });
  await getKpisCC('cod', 'WEB');
  expect(get.mock.calls[0][1]?.params).toEqual({ tipoGestion: 'cod', storeId: 'WEB' });
  await getPedidosCC({ storeId: 'WEB', page: 1, limit: 50 });
  expect(new URLSearchParams(String(get.mock.calls[1][0]).split('?')[1]).get('storeId')).toBe('WEB');
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
