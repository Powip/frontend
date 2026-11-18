import * as XLSX from "xlsx";
import type { OrderHeader } from "@/interfaces/IOrder";
import {
  REPORTE_VENTAS_COLUMNAS,
  buildReporteVentasFilas,
  buildReporteVentasLibro,
  canalDelPanel,
  nombreReporteVentas,
} from "../reporte-ventas.service";

function pedido(overrides: Partial<OrderHeader> = {}): OrderHeader {
  return {
    id: "o-1",
    orderNumber: "ORD-000101",
    externalOrderNumber: null,
    storeId: "store-1",
    status: "EN_ENVIO",
    created_at: "2026-11-09T15:00:00.000Z",
    updated_at: "2026-11-10T15:00:00.000Z",
    sellerName: "Vendedora Demo",
    salesChannel: "whatsapp",
    grandTotal: "139.00",
    courier: "Shalom",
    carrierShippingCost: "12.5",
    externalTrackingNumber: "95000001",
    shippingCode: "AB1C",
    shippingOffice: "Cayma",
    shippingKey: "1234",
    customer: {
      fullName: "Cliente Demo",
      phoneNumber: "900000000",
      city: "Arequipa",
      province: "Arequipa",
      district: "Cayma",
    },
    items: [
      { productName: "PRODUCTO DEMO A", attributes: { talla: "M", color: "Negro" }, quantity: 1, brandName: "Kunca" },
      { productName: "PRODUCTO DEMO B", attributes: {}, quantity: 2, brandName: "Kunca" },
    ],
    payments: [
      { amount: "50.00", status: "PAID" },
      { amount: "30.00", status: "PENDING" },
    ],
    ...overrides,
  } as unknown as OrderHeader;
}

describe("reporte de ventas del panel", () => {
  it("arma una fila por pedido con las 26 columnas del formato del cliente", () => {
    const [fila] = buildReporteVentasFilas([pedido()], {
      verCostos: true,
      tiendas: new Map([["store-1", "Tienda Demo"]]),
      baseRastreo: "https://www.powip.lat/",
    });

    expect(Object.keys(fila)).toEqual([...REPORTE_VENTAS_COLUMNAS]);
    expect(fila).toMatchObject({
      "N° Pedido": "ORD-000101",
      "NRO ORDEN EXTERNA": "",
      "Fecha de venta": "9/11/2026",
      Despacho: "-",
      Vendedora: "Vendedora Demo",
      "Canal de venta": "WHATSAPP",
      TIENDA: "Tienda Demo",
      MARCA: "Kunca",
      Cliente: "Cliente Demo",
      Teléfono: "900000000",
      Ciudad: "Arequipa",
      Distrito: "Cayma",
      Pedidos: 2,
      "UND PRODUCTO": 3,
      Productos: "PRODUCTO DEMO A - M / Negro x1; PRODUCTO DEMO B x2",
      VENTA: 139,
      ADELANTO: 50,
      "Saldo de deuda": 89,
      Courier: "Shalom",
      "Costo de envío": 12.5,
      "Número de tracking": "95000001",
      "Código de envío": "AB1C",
      Oficina: "Cayma",
      "Clave de envío": "1234",
      "Link de rastreo": "https://www.powip.lat/rastreo/ORD-000101",
    });
  });

  it("marca la clave como Bloqueada cuando existe pero el servidor no la entrega (pedido con saldo)", () => {
    const [bloqueada, sinClave] = buildReporteVentasFilas(
      [
        pedido({ shippingKey: null, hasShippingKey: true } as Partial<OrderHeader>),
        pedido({ shippingKey: null }),
      ],
      { verCostos: true },
    );
    expect(bloqueada["Clave de envío"]).toBe("Bloqueada");
    expect(sinClave["Clave de envío"]).toBe("-");
  });

  it("pone la talla antes que el color aunque el jsonb llegue con color primero", () => {
    const [fila] = buildReporteVentasFilas(
      [pedido({ items: [{ productName: "CHOMPA", attributes: { color: "Negro", talla: "M" }, quantity: 1 }] } as Partial<OrderHeader>)],
      { verCostos: true },
    );
    expect(fila.Productos).toBe("CHOMPA - M / Negro x1");
  });

  it("llena Despacho con la fecha de salida en hora de Lima", () => {
    const [despachado, sinSalir] = buildReporteVentasFilas(
      [
        pedido({ dispatchedAt: "2026-11-11T03:30:00.000Z" } as Partial<OrderHeader>),
        pedido({ dispatchedAt: null } as Partial<OrderHeader>),
      ],
      { verCostos: true },
    );
    // 03:30 UTC del 11 = 22:30 del 10 en Lima.
    expect(despachado.Despacho).toBe("10/11/2026");
    expect(sinSalir.Despacho).toBe("-");
  });

  it("reconoce el canal como el panel: ficha por canal de origen o de venta, si no txt:<slug>", () => {
    const fichas = [
      { id: "ficha-wa", canalNombre: "WhatsApp" },
      { id: "ficha-tt", canalNombre: "tiktok_live" },
    ];
    expect(canalDelPanel({ salesChannel: "WHATSAPP", canalOrigen: null }, fichas)).toBe("ficha-wa");
    expect(canalDelPanel({ salesChannel: "WEB", canalOrigen: " whatsapp" }, fichas)).toBe("ficha-wa");
    expect(canalDelPanel({ salesChannel: "Tiktok_live" } as never, fichas)).toBe("ficha-tt");
    expect(canalDelPanel({ salesChannel: "Tienda Física", canalOrigen: null }, fichas)).toBe("txt:tienda_fisica");
    expect(canalDelPanel({ salesChannel: "  ", canalOrigen: null } as never, fichas)).toBeNull();
  });

  it("oculta el costo de envío sin la capacidad ver_costos", () => {
    const [fila] = buildReporteVentasFilas([pedido()], { verCostos: false });
    expect(fila["Costo de envío"]).toBe("-");
  });

  it("prefiere el destino del pedido y cae a la guía cuando no hay tracking externo", () => {
    const [fila] = buildReporteVentasFilas(
      [
        pedido({
          externalTrackingNumber: null,
          guideNumber: "G-77",
          shippingOffice: null,
          deliverySnapshot: {
            version: 1,
            type: "AGENCY",
            department: "Cusco",
            province: "Cusco",
            district: "Wanchaq",
            address: "",
            agency: "WANCHAQ",
            reference: null,
            latitude: null,
            longitude: null,
            googleMapsUrl: null,
            zone: null,
          },
        }),
      ],
      { verCostos: true },
    );
    expect(fila).toMatchObject({
      Ciudad: "Cusco",
      Distrito: "Wanchaq",
      Oficina: "WANCHAQ",
      "Número de tracking": "G-77",
    });
  });

  it("escribe montos como número con formato S/ y nombra el archivo por periodo", () => {
    const filas = buildReporteVentasFilas([pedido()], { verCostos: true });
    const libro = buildReporteVentasLibro(filas);
    const hoja = libro.Sheets.Ventas;
    const venta = hoja[XLSX.utils.encode_cell({ r: 1, c: REPORTE_VENTAS_COLUMNAS.indexOf("VENTA") })];

    expect(libro.SheetNames).toEqual(["Ventas"]);
    expect(hoja.A1.v).toBe("N° Pedido");
    expect(venta).toMatchObject({ t: "n", v: 139, z: '"S/ "#,##0.00' });
    expect(nombreReporteVentas("2026-11-01", "2026-11-18")).toBe(
      "reporte_ventas_2026-11-01_2026-11-18.xlsx",
    );
  });
});
