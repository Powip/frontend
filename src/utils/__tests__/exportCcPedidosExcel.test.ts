/**
 * @jest-environment node
 */
/**
 * Tests: exportCcPedidosExcel (Gestión COD → exportar selección)
 *
 * Usa ExcelJS real (sin mock) y relee el .xlsx generado para verificar:
 * 1. Encabezados = columnas de datos de CcPedidosTable (incl. Vendedor/Región), sin checkbox ni acciones.
 * 2. Primera fila congelada y autofiltro sobre todo el rango.
 * 3. N° orden y teléfono como texto (conservan ceros a la izquierda); importes como números con formato S/.
 * 4. Badges e indicadores convertidos a texto legible (subestado, Aliclik, EVA, intentos, upsell, resumen).
 * 5. Solo se exportan los pedidos recibidos (la selección), en orden.
 * 6. Nombre de archivo según pestaña y fecha.
 */
import ExcelJS from 'exceljs';
import {
  buildCcPedidosWorkbook,
  buildCcPedidoRow,
  ccPedidosFileName,
} from '../exportCcPedidosExcel';
import { OrderHeader } from '@/interfaces/IOrder';

function makeOrder(overrides: Partial<OrderHeader> = {}): OrderHeader {
  return {
    id: 'order-1',
    orderNumber: '000123',
    customer: { fullName: 'Juan Pérez', phoneNumber: '051999111222' },
    grandTotal: '150.50',
    payments: [
      { status: 'PAID', amount: '50.00' },
      { status: 'PENDING', amount: '20.00' },
    ],
    items: [
      { productName: 'Polo', quantity: 2, attributes: { Talla: 'M' }, isPromoItem: false },
      { productName: 'Gorra', quantity: 1, attributes: {}, isPromoItem: true },
    ],
    subEstadoCc: 'contactado',
    canalOrigen: 'releasit',
    externalSource: 'google_sheets',
    aliclikDispatchStatus: 'IN_TRANSIT',
    evaStatus: null,
    courier: 'EVA Courier',
    callAttempts: 2,
    sellerName: 'Ana',
    salesRegion: 'LIMA',
    dniCliente: null,
    datosCompletos: false,
    created_at: '2026-09-15T15:30:00.000Z',
    ...overrides,
  } as unknown as OrderHeader;
}

async function roundTrip(orders: OrderHeader[]) {
  const wb = buildCcPedidosWorkbook(orders, 'Contactado');
  const buffer = await wb.xlsx.writeBuffer();
  const read = new ExcelJS.Workbook();
  await read.xlsx.load(buffer as ArrayBuffer);
  return read.worksheets[0];
}

function headerMap(ws: ExcelJS.Worksheet): Record<string, number> {
  const map: Record<string, number> = {};
  ws.getRow(1).eachCell((cell, col) => { map[String(cell.value)] = col; });
  return map;
}

describe('exportCcPedidosExcel', () => {
  it('incluye todas las columnas de datos de la tabla y ninguna de controles', async () => {
    const ws = await roundTrip([makeOrder()]);
    const headers = Object.keys(headerMap(ws));
    expect(headers).toEqual([
      'N° Orden', 'N° Externo', 'Fecha', 'Cliente', 'DNI', 'Teléfono', 'Tienda', 'Canal', 'Subestado',
      'Aliclik', 'EVA', 'Adelanto', 'Por cobrar', 'Total', 'Upsell', 'Intentos',
      'Vendedor', 'Región', 'Resumen',
    ]);
    expect(headers).not.toContain('Acciones');
  });

  it('congela la primera fila y aplica autofiltro sobre el rango de datos', async () => {
    const ws = await roundTrip([makeOrder(), makeOrder({ id: 'order-2' })]);
    expect(ws.views[0]).toMatchObject({ state: 'frozen', ySplit: 1 });
    expect(ws.autoFilter).toBe('A1:S3'); // 19 columnas: con «N° Externo» (FEAT-31)
    expect(ws.getColumn(1).width).toBeGreaterThan(8);
  });

  it('mantiene N° orden y teléfono como texto e importes como números con formato monetario', async () => {
    const ws = await roundTrip([makeOrder()]);
    const h = headerMap(ws);
    const row = ws.getRow(2);

    expect(row.getCell(h['N° Orden']).value).toBe('000123');
    expect(row.getCell(h['Teléfono']).value).toBe('051999111222');
    expect(row.getCell(h['Teléfono']).numFmt).toBe('@');

    expect(row.getCell(h['Adelanto']).value).toBe(50);
    expect(row.getCell(h['Por cobrar']).value).toBeCloseTo(100.5);
    expect(row.getCell(h['Total']).value).toBeCloseTo(150.5);
    expect(row.getCell(h['Total']).numFmt).toBe('"S/" #,##0.00');
    // el encabezado no hereda el formato de moneda
    expect(ws.getRow(1).getCell(h['Total']).numFmt ?? 'General').toBe('General');
  });

  it('convierte badges e indicadores en valores legibles', () => {
    const row = buildCcPedidoRow(makeOrder());
    expect(row).toMatchObject({
      cliente: 'Juan Pérez',
      dni: 'Faltante',
      tienda: 'SHEETS',
      canal: 'releasit',
      subestado: 'Contactado',
      aliclik: 'En tránsito',
      eva: 'Sin enviar',
      upsell: 1,
      intentos: '2/3',
      vendedor: 'Ana',
      region: 'LIMA',
      resumen: '2x Polo (Talla: M) · 1x Gorra [upsell]',
    });
    expect(row.fecha).toBeInstanceOf(Date);

    const sinCourier = buildCcPedidoRow(makeOrder({
      courier: null, aliclikDispatchStatus: null, evaStatus: 'EN RUTA', dniCliente: '12345678',
      subEstadoCc: 'anulado_cc',
    } as Partial<OrderHeader>));
    expect(sinCourier).toMatchObject({ eva: 'En ruta', aliclik: '', dni: '12345678', subestado: 'Anulado CC' });
  });

  it('con 2+ tiendas la columna Tienda lleva la tienda de Powip del pedido (igual que la pantalla)', () => {
    const stores = [{ id: 'store-1', name: 'AMAGREEN' }, { id: 'store-2', name: 'AMAGREEN MINORISTA' }];
    expect(buildCcPedidoRow(makeOrder({ storeId: 'store-2' }), stores).tienda).toBe('AMAGREEN MINORISTA');
    expect(buildCcPedidoRow(makeOrder({ storeId: 'store-1' }), stores).tienda).toBe('AMAGREEN');
  });

  it('con una sola tienda, sin tiendas o con una tienda desconocida conserva el vendor/canal', () => {
    const una = [{ id: 'store-1', name: 'AMAGREEN' }];
    const dos = [{ id: 'store-1', name: 'AMAGREEN' }, { id: 'store-2', name: 'AMAGREEN MINORISTA' }];
    expect(buildCcPedidoRow(makeOrder({ storeId: 'store-1' }), una).tienda).toBe('SHEETS');
    expect(buildCcPedidoRow(makeOrder({ storeId: 'store-1' })).tienda).toBe('SHEETS');
    expect(buildCcPedidoRow(makeOrder({ storeId: 'otra' }), dos).tienda).toBe('SHEETS');
  });

  it('el libro generado usa las tiendas recibidas en la columna Tienda', async () => {
    const stores = [{ id: 'store-1', name: 'AMAGREEN' }, { id: 'store-2', name: 'AMAGREEN MINORISTA' }];
    const wb = buildCcPedidosWorkbook([makeOrder({ storeId: 'store-2' })], 'Por confirmar', stores);
    const reread = new ExcelJS.Workbook();
    await reread.xlsx.load(await wb.xlsx.writeBuffer());
    const ws = reread.worksheets[0];
    const col = (ws.getRow(1).values as string[]).indexOf('Tienda');
    expect(ws.getRow(2).getCell(col).value).toBe('AMAGREEN MINORISTA');
  });

  it('exporta únicamente los pedidos recibidos, en orden', async () => {
    const ws = await roundTrip([
      makeOrder({ id: 'a', orderNumber: 'A-1' }),
      makeOrder({ id: 'b', orderNumber: 'B-2' }),
    ]);
    expect(ws.rowCount).toBe(3);
    expect(ws.getRow(2).getCell(1).value).toBe('A-1');
    expect(ws.getRow(3).getCell(1).value).toBe('B-2');
  });

  it('nombra el archivo según la pestaña y la fecha', () => {
    const d = new Date(2026, 8, 30);
    expect(ccPedidosFileName('Contactado', d)).toBe('pedidos_cod_contactado_2026-09-30.xlsx');
    expect(ccPedidosFileName('No contesta', d)).toBe('pedidos_cod_no_contesta_2026-09-30.xlsx');
    expect(ccPedidosFileName('Anulados', d)).toBe('pedidos_cod_anulados_2026-09-30.xlsx');
  });
});

describe('exportCcPedidosExcel — N° externo (FEAT-31)', () => {
  it('exporta el N° externo como texto, vacío si el pedido no lo tiene', async () => {
    const ws = await roundTrip([
      makeOrder({ externalOrderNumber: 'AGPE923190' }),
      makeOrder({ id: 'order-2', externalOrderNumber: null }),
    ]);
    const h = headerMap(ws);

    expect(ws.getRow(2).getCell(h['N° Externo']).value).toBe('AGPE923190');
    expect(ws.getRow(2).getCell(h['N° Externo']).numFmt).toBe('@');
    expect(ws.getRow(3).getCell(h['N° Externo']).value ?? '').toBe('');
  });
});
