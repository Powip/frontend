import {
  extractSizeAndColor,
  buildDetailedSalesExportRows,
  detectPossibleDuplicates,
} from '../exportDetailedSalesReport';
import type {
  OrderResponseDto,
  OrderItemResponseDto,
} from '@/features/sales/dto/order.dto';
import { exportSalesToExcel } from '../exportSalesExcel';

function makeItem(overrides: Partial<OrderItemResponseDto> = {}): OrderItemResponseDto {
  return {
    id: 'item-1',
    productVariantId: null,
    sku: 'SKU-1',
    productName: 'Producto genérico',
    attributes: undefined,
    quantity: 1,
    unitPrice: '10.00',
    subtotal: '10.00',
    discountType: 'NONE' as unknown as OrderItemResponseDto['discountType'],
    discountAmount: '0',
    isPromoItem: false,
    addedByUserId: null,
    addedAt: null,
    brandId: null,
    brandName: null,
    categoryId: null,
    categoryName: null,
    externalData: null,
    imageUrl: null,
    created_at: '2026-08-01T00:00:00.000Z',
    updated_at: '2026-08-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeOrder(overrides: Partial<OrderResponseDto> = {}): OrderResponseDto {
  return {
    id: 'order-1',
    receiptType: 'BOLETA' as unknown as OrderResponseDto['receiptType'],
    orderType: 'NORMAL' as unknown as OrderResponseDto['orderType'],
    orderNumber: '#1001',
    storeId: 'store-1',
    customer: {
      id: 'customer-1',
      companyId: 'company-1',
      documentType: 'DNI' as unknown as OrderResponseDto['customer']['documentType'],
      documentNumber: '12345678',
      fullName: 'Juan Pérez',
      phoneNumber: '999888777',
      email: null,
      clientType: 'NATURAL' as unknown as OrderResponseDto['customer']['clientType'],
      province: 'Lima',
      city: 'Lima',
      district: 'Miraflores',
      address: 'Av. Siempre Viva 123',
      reference: 'Zona A',
      zone: 'Zona A',
      latitude: null,
      longitude: null,
      googleMapsUrl: null,
      isActive: true,
      createdAt: '2026-08-01T00:00:00.000Z',
      updatedAt: '2026-08-01T00:00:00.000Z',
    },
    salesChannel: 'WEB' as unknown as OrderResponseDto['salesChannel'],
    closingChannel: 'WEB' as unknown as OrderResponseDto['closingChannel'],
    deliveryType: 'DELIVERY' as unknown as OrderResponseDto['deliveryType'],
    courierId: null,
    courier: 'Shalom',
    guideNumber: 'G-001',
    subtotal: '10.00',
    taxTotal: '0',
    shippingTotal: '0',
    discountTotal: '0',
    grandTotal: '10.00',
    status: 'PENDIENTE' as unknown as OrderResponseDto['status'],
    salesRegion: 'Lima Metropolitana',
    cancellationReason: null,
    notes: '',
    taxMode: 'INAFECTO' as unknown as OrderResponseDto['taxMode'],
    callStatus: null,
    callAttempts: 0,
    callbackAt: null,
    sellerId: 'seller-1',
    sellerName: 'Ana Vendedora',
    externalTrackingNumber: null,
    shippingKey: null,
    trackingUrl: null,
    shippingOffice: null,
    shippingCode: null,
    shippingProofUrl: null,
    carrierShippingCost: '0',
    costAmount: '0',
    channelFee: '0',
    items: [],
    payments: [],
    logs: [],
    externalSource: null,
    externalData: null,
    syncErrors: null,
    shalomStatus: null,
    shalomError: null,
    shalomSerie: null,
    shalomOriginAgency: null,
    shalomDestinationAgency: null,
    shalomRecipientDoc: null,
    shalomRecipientPhone: null,
    shalomContent: null,
    canalOrigen: null,
    subEstadoCc: null,
    ccAgenteId: null,
    ccConfirmadoAt: null,
    ccConfirmadoBy: null,
    datosCompletos: true,
    dniCliente: null,
    referenciaEntrega: null,
    horarioEntregaLima: null,
    metaPubliId: null,
    aliclikDispatchStatus: null,
    aliclikSyncedAt: null,
    sunatStatus: null,
    sunatSerie: null,
    sunatCorrelativo: null,
    sunatCode: null,
    sunatDescription: null,
    sunatObservations: null,
    sunatError: null,
    created_at: '2026-08-01T00:00:00.000Z',
    updated_at: '2026-08-01T00:00:00.000Z',
    hasStockIssue: false,
    shopifyOrderId: null,
    shopifyOrderNumber: null,
    discountCodes: [],
    ...overrides,
  };
}

describe('extractSizeAndColor', () => {
  it('extrae Talla y Color con las claves canónicas "Talla"/"Color"', () => {
    const result = extractSizeAndColor({ Talla: 'M', Color: 'Negro' });
    expect(result).toEqual({ size: 'M', color: 'Negro' });
  });

  it('matchea claves alternativas para talla: "talle" (minúsculas)', () => {
    const result = extractSizeAndColor({ talle: 'L' });
    expect(result.size).toBe('L');
  });

  it('matchea claves alternativas para talla: "SIZE" (mayúsculas)', () => {
    const result = extractSizeAndColor({ SIZE: 'XL' });
    expect(result.size).toBe('XL');
  });

  it('matchea "color" en minúsculas y con espacios alrededor de la clave', () => {
    const result = extractSizeAndColor({ ' color ': 'Azul' });
    expect(result.color).toBe('Azul');
  });

  it('devuelve "-" para size y color cuando attributes es null', () => {
    expect(extractSizeAndColor(null)).toEqual({ size: '-', color: '-' });
  });

  it('devuelve "-" para size y color cuando attributes es undefined', () => {
    expect(extractSizeAndColor(undefined)).toEqual({ size: '-', color: '-' });
  });

  it('devuelve "-" para size y color cuando attributes es un objeto vacío', () => {
    expect(extractSizeAndColor({})).toEqual({ size: '-', color: '-' });
  });

  it('devuelve "-" solo para la clave ausente cuando attributes tiene una sola de las dos', () => {
    expect(extractSizeAndColor({ Talla: 'M' })).toEqual({ size: 'M', color: '-' });
    expect(extractSizeAndColor({ Color: 'Rojo' })).toEqual({ size: '-', color: 'Rojo' });
  });

  it('devuelve el valor tal cual cuando es "" o "0" en vez de tratarlo como ausente', () => {
    expect(extractSizeAndColor({ Talla: '0' })).toEqual({ size: '0', color: '-' });
    expect(extractSizeAndColor({ Color: '' })).toEqual({ size: '-', color: '' });
  });

  it('usa attributes directo (sin fallback al nombre) cuando ya trae talla/color, aunque el nombre también matchee el patrón', () => {
    const result = extractSizeAndColor(
      { Talla: 'M', Color: 'Negro' },
      'CHOMPA OVEJERA KUNCA - S / Arena',
    );
    expect(result).toEqual({ size: 'M', color: 'Negro' });
  });

  it('con attributes vacío, hace fallback parseando "Talla / Color" del nombre — talla primero', () => {
    const result = extractSizeAndColor({}, 'CHOMPA OVEJERA KUNCA - S / Arena');
    expect(result).toEqual({ size: 'S', color: 'Arena' });
  });

  it('con attributes null, hace fallback parseando "Color / Talla" del nombre — talla segundo', () => {
    const result = extractSizeAndColor(null, 'CHOMPA OVEJERA UNISEX - Negro / M');
    expect(result).toEqual({ size: 'M', color: 'Negro' });
  });

  it('con attributes undefined, hace fallback parseando el nombre', () => {
    const result = extractSizeAndColor(undefined, 'POLERA BASICA - XL / Blanco');
    expect(result).toEqual({ size: 'XL', color: 'Blanco' });
  });

  it('nombre sin el patrón "- seg1 / seg2" esperado devuelve "-"/"-" (sin fallback posible)', () => {
    const result = extractSizeAndColor({}, 'Producto genérico sin variante');
    expect(result).toEqual({ size: '-', color: '-' });
  });

  it('sin nombre de producto (undefined) y attributes vacío devuelve "-"/"-"', () => {
    expect(extractSizeAndColor({})).toEqual({ size: '-', color: '-' });
  });
});

describe('buildDetailedSalesExportRows', () => {
  it('genera 1 fila por item: un pedido con 3 items produce 3 filas', () => {
    const order = makeOrder({
      orderNumber: '#1001',
      items: [
        makeItem({ id: 'item-1', productName: 'Polo Negro', quantity: 2, unitPrice: '50.00' }),
        makeItem({ id: 'item-2', productName: 'Jean Azul', quantity: 1, unitPrice: '120.00' }),
        makeItem({ id: 'item-3', productName: 'Gorra Roja', quantity: 3, unitPrice: '20.00' }),
      ],
    });

    const rows = buildDetailedSalesExportRows([order]);

    expect(rows).toHaveLength(3);
  });

  it('repite los datos de cabecera del pedido en cada fila', () => {
    const order = makeOrder({
      orderNumber: '#1001',
      courier: 'Shalom',
      sellerName: 'Ana Vendedora',
      salesRegion: 'Lima Metropolitana',
      customer: {
        ...makeOrder().customer,
        fullName: 'Juan Pérez',
        province: 'Lima',
        city: 'Lima',
        district: 'Miraflores',
      },
      items: [
        makeItem({ id: 'item-1', productName: 'Polo Negro' }),
        makeItem({ id: 'item-2', productName: 'Jean Azul' }),
        makeItem({ id: 'item-3', productName: 'Gorra Roja' }),
      ],
    });

    const rows = buildDetailedSalesExportRows([order]);

    for (const row of rows) {
      expect(row.orderNumber).toBe('#1001');
      expect(row.clientName).toBe('Juan Pérez');
      expect(row.province).toBe('Lima');
      expect(row.city).toBe('Lima');
      expect(row.district).toBe('Miraflores');
      expect(row.courier).toBe('Shalom');
      expect(row.sellerName).toBe('Ana Vendedora');
      expect(row.salesRegion).toBe('Lima Metropolitana');
    }
  });

  it('mantiene datos propios del item (producto, cantidad, precio) distintos entre filas', () => {
    const order = makeOrder({
      items: [
        makeItem({ id: 'item-1', productName: 'Polo Negro', quantity: 2, unitPrice: '50.00' }),
        makeItem({ id: 'item-2', productName: 'Jean Azul', quantity: 1, unitPrice: '120.00' }),
        makeItem({ id: 'item-3', productName: 'Gorra Roja', quantity: 3, unitPrice: '20.00' }),
      ],
    });

    const rows = buildDetailedSalesExportRows([order]);

    expect(rows[0]).toMatchObject({ productName: 'Polo Negro', quantity: 2, unitPrice: 50 });
    expect(rows[1]).toMatchObject({ productName: 'Jean Azul', quantity: 1, unitPrice: 120 });
    expect(rows[2]).toMatchObject({ productName: 'Gorra Roja', quantity: 3, unitPrice: 20 });
  });

  it('mapea Meta ID, LINK MAPS, Latitud y Longitud a cada fila', () => {
    const order = makeOrder({
      metaPubliId: 'meta-123',
      customer: {
        ...makeOrder().customer,
        googleMapsUrl: 'https://maps.google.com/?q=-12.1,-77.0',
        latitude: -12.1,
        longitude: -77.0,
      },
      items: [makeItem({ id: 'item-1' }), makeItem({ id: 'item-2' })],
    });

    const rows = buildDetailedSalesExportRows([order]);

    for (const row of rows) {
      expect(row.metaId).toBe('meta-123');
      expect(row.mapsLink).toBe('https://maps.google.com/?q=-12.1,-77.0');
      expect(row.latitude).toBe(-12.1);
      expect(row.longitude).toBe(-77.0);
    }
  });

  it('no rompe cuando googleMapsUrl es null (cliente creado antes del fix de backend) y usa un placeholder consistente', () => {
    const order = makeOrder({
      customer: {
        ...makeOrder().customer,
        googleMapsUrl: null,
      },
      items: [makeItem({ id: 'item-1' })],
    });

    const rows = buildDetailedSalesExportRows([order]);

    expect(rows).toHaveLength(1);
    expect(rows[0].mapsLink).toBe('-');
  });

  it('un pedido con items vacío ([]) no rompe y no genera filas para ese pedido', () => {
    const orderSinItems = makeOrder({ orderNumber: '#2001', items: [] });
    const orderConItems = makeOrder({
      orderNumber: '#2002',
      items: [makeItem({ id: 'item-1' })],
    });

    const rows = buildDetailedSalesExportRows([orderSinItems, orderConItems]);

    expect(rows).toHaveLength(1);
    expect(rows[0].orderNumber).toBe('#2002');
  });

  it('un pedido con items null no rompe (el código usa `order.items || []`)', () => {
    const orderConItemsNull = makeOrder({
      orderNumber: '#3001',
      items: null as unknown as OrderItemResponseDto[],
    });

    expect(() => buildDetailedSalesExportRows([orderConItemsNull])).not.toThrow();
    expect(buildDetailedSalesExportRows([orderConItemsNull])).toHaveLength(0);
  });

  it('devuelve un array vacío cuando la lista de pedidos está vacía', () => {
    expect(buildDetailedSalesExportRows([])).toEqual([]);
  });
});

describe('detectPossibleDuplicates', () => {
  it('marca mutuamente 2 pedidos con el mismo teléfono (distinto formato), producto en común y <24h', () => {
    const orderA = makeOrder({
      id: 'order-a',
      orderNumber: '#3001',
      customer: { ...makeOrder().customer, phoneNumber: '+51987654321' },
      items: [makeItem({ id: 'item-a', productName: 'Polo Negro' })],
      created_at: '2026-08-01T10:00:00.000Z',
    });
    const orderB = makeOrder({
      id: 'order-b',
      orderNumber: '#3002',
      customer: { ...makeOrder().customer, phoneNumber: '987654321' },
      items: [makeItem({ id: 'item-b', productName: 'Polo Negro' })],
      created_at: '2026-08-01T15:00:00.000Z', // 5h después
    });

    const result = detectPossibleDuplicates([orderA, orderB]);

    expect(result.get('order-a')).toEqual(['#3002']);
    expect(result.get('order-b')).toEqual(['#3001']);
  });

  it('NO marca pedidos con teléfonos distintos aunque compartan producto y sean cercanos en el tiempo', () => {
    const orderA = makeOrder({
      id: 'order-a',
      orderNumber: '#3001',
      customer: { ...makeOrder().customer, phoneNumber: '987654321' },
      items: [makeItem({ productName: 'Polo Negro' })],
      created_at: '2026-08-01T10:00:00.000Z',
    });
    const orderB = makeOrder({
      id: 'order-b',
      orderNumber: '#3002',
      customer: { ...makeOrder().customer, phoneNumber: '912345678' },
      items: [makeItem({ productName: 'Polo Negro' })],
      created_at: '2026-08-01T11:00:00.000Z',
    });

    const result = detectPossibleDuplicates([orderA, orderB]);

    expect(result.size).toBe(0);
  });

  it('NO marca pedidos con el mismo teléfono si no comparten ningún producto', () => {
    const orderA = makeOrder({
      id: 'order-a',
      orderNumber: '#3001',
      customer: { ...makeOrder().customer, phoneNumber: '987654321' },
      items: [makeItem({ productName: 'Polo Negro' })],
      created_at: '2026-08-01T10:00:00.000Z',
    });
    const orderB = makeOrder({
      id: 'order-b',
      orderNumber: '#3002',
      customer: { ...makeOrder().customer, phoneNumber: '987654321' },
      items: [makeItem({ productName: 'Jean Azul' })],
      created_at: '2026-08-01T11:00:00.000Z',
    });

    const result = detectPossibleDuplicates([orderA, orderB]);

    expect(result.size).toBe(0);
  });

  it('NO marca pedidos con el mismo teléfono y producto si difieren en 24h o más', () => {
    const orderA = makeOrder({
      id: 'order-a',
      orderNumber: '#3001',
      customer: { ...makeOrder().customer, phoneNumber: '987654321' },
      items: [makeItem({ productName: 'Polo Negro' })],
      created_at: '2026-08-01T00:00:00.000Z',
    });
    const orderB = makeOrder({
      id: 'order-b',
      orderNumber: '#3002',
      customer: { ...makeOrder().customer, phoneNumber: '987654321' },
      items: [makeItem({ productName: 'Polo Negro' })],
      created_at: '2026-08-02T01:00:00.000Z', // 25h después
    });

    const result = detectPossibleDuplicates([orderA, orderB]);

    expect(result.size).toBe(0);
  });

  it('devuelve un Map vacío cuando no hay pedidos', () => {
    expect(detectPossibleDuplicates([]).size).toBe(0);
  });
});

describe('buildDetailedSalesExportRows — columnas "Posible Duplicado" / "Pedidos Relacionados"', () => {
  it('marca possibleDuplicate=true y relatedOrders con el otro pedido, en TODAS las filas de ambos pedidos duplicados', () => {
    const orderA = makeOrder({
      id: 'order-a',
      orderNumber: '#4001',
      customer: { ...makeOrder().customer, phoneNumber: '987654321' },
      items: [
        makeItem({ id: 'item-a1', productName: 'Polo Negro' }),
        makeItem({ id: 'item-a2', productName: 'Gorra Roja' }),
      ],
      created_at: '2026-08-01T10:00:00.000Z',
    });
    const orderB = makeOrder({
      id: 'order-b',
      orderNumber: '#4002',
      customer: { ...makeOrder().customer, phoneNumber: '987654321' },
      items: [makeItem({ id: 'item-b1', productName: 'Polo Negro' })],
      created_at: '2026-08-01T12:00:00.000Z',
    });

    const rows = buildDetailedSalesExportRows([orderA, orderB]);
    const rowsA = rows.filter((r) => r.orderNumber === '#4001');
    const rowsB = rows.filter((r) => r.orderNumber === '#4002');

    expect(rowsA).toHaveLength(2);
    for (const row of rowsA) {
      expect(row.possibleDuplicate).toBe(true);
      expect(row.relatedOrders).toBe('#4002');
    }
    expect(rowsB).toHaveLength(1);
    expect(rowsB[0].possibleDuplicate).toBe(true);
    expect(rowsB[0].relatedOrders).toBe('#4001');
  });

  it('un pedido sin duplicados tiene possibleDuplicate=false y relatedOrders=""', () => {
    const order = makeOrder({
      orderNumber: '#5001',
      customer: { ...makeOrder().customer, phoneNumber: '900000000' },
      items: [makeItem({ productName: 'Polo Negro' })],
    });

    const rows = buildDetailedSalesExportRows([order]);

    expect(rows[0].possibleDuplicate).toBe(false);
    expect(rows[0].relatedOrders).toBe('');
  });
});

describe('regresión — exportSalesExcel.ts no se ve afectado por este cambio', () => {
  it('sigue exportando exportSalesToExcel (interfaz SaleExportData intacta) sin romper el import', () => {
    expect(typeof exportSalesToExcel).toBe('function');
  });
});
