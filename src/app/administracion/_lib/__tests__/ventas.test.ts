import {
  costoDudosoPedido,
  costoPedido,
  delPeriodo,
  esVenta,
  estaEnTransito,
  type PedidoAdmin,
  resumirVentas,
  saldoPedido,
  unidadesPedido,
  ventasPorCanal,
  ventasPorDia,
} from "../ventas";

const pedido = (extra: Partial<PedidoAdmin> = {}): PedidoAdmin => ({
  id: "p",
  status: "ENTREGADO",
  commercialStage: "SALE",
  grandTotal: "118.00",
  costAmount: "0.00",
  channelFee: "0.00",
  salesChannel: "WHATSAPP",
  created_at: "2026-11-10T15:00:00.000Z",
  items: [{ lineKind: "PRODUCT", quantity: 2, unitCost: "20.00" }],
  payments: [],
  ...extra,
});

describe("ventas", () => {
  it("una venta es ENTREGADO y no LEAD", () => {
    expect(esVenta(pedido())).toBe(true);
    expect(esVenta(pedido({ status: "EN_ENVIO" }))).toBe(false);
    expect(esVenta(pedido({ commercialStage: "LEAD" }))).toBe(false);
  });

  it("cuenta unidades, no pedidos ni líneas, y deja afuera los servicios", () => {
    expect(
      unidadesPedido(
        pedido({
          items: [
            { lineKind: "PRODUCT", quantity: 3 },
            { lineKind: "PRODUCT", quantity: 1 },
            { lineKind: "SERVICE", quantity: 1 },
          ],
        }),
      ),
    ).toBe(4);
  });

  it("toma el costo de las líneas y si falta el de la cabecera", () => {
    expect(costoPedido(pedido())).toBe(40);
    expect(
      costoPedido(pedido({ costAmount: "35.00", items: [{ lineKind: "PRODUCT", quantity: 2, unitCost: null }] })),
    ).toBe(35);
    expect(costoPedido(pedido({ items: [{ lineKind: "PRODUCT", quantity: 2, unitCost: null }] }))).toBeNull();
  });

  it("con costo parcial en las líneas queda sin costo (la cabecera es la suma parcial)", () => {
    expect(
      costoPedido(
        pedido({
          costAmount: "30.00",
          items: [
            { lineKind: "PRODUCT", quantity: 1, unitCost: 30 },
            { lineKind: "PRODUCT", quantity: 1, unitCost: null },
          ],
        }),
      ),
    ).toBeNull();
  });

  it("en tránsito incluye EN_ENVIO y ASIGNADO_A_GUIA", () => {
    expect(estaEnTransito(pedido({ status: "EN_ENVIO" }))).toBe(true);
    expect(estaEnTransito(pedido({ status: "ASIGNADO_A_GUIA" }))).toBe(true);
    expect(estaEnTransito(pedido({ status: "DESPACHADO" }))).toBe(true);
    expect(estaEnTransito(pedido({ status: "PENDIENTE" }))).toBe(false);
  });

  it("el saldo descuenta lo pagado y nunca es negativo", () => {
    expect(saldoPedido(pedido({ payments: [{ status: "PAID", amount: "50" }, { status: "PENDING", amount: "10" }] }))).toBe(68);
    expect(saldoPedido(pedido({ payments: [{ status: "PAID", amount: "200" }] }))).toBe(0);
  });

  it("filtra por día de Lima, no por día UTC", () => {
    const tarde = pedido({ created_at: "2026-11-26T03:00:00.000Z" }); // 25-nov 22:00 en Lima
    expect(delPeriodo([tarde], "2026-11-25", "2026-11-25")).toHaveLength(1);
    expect(delPeriodo([tarde], "2026-11-26", "2026-11-26")).toHaveLength(0);
  });

  it("resume ventas con cobertura de costo", () => {
    const resumen = resumirVentas([
      pedido(),
      pedido({ grandTotal: 82, items: [{ lineKind: "PRODUCT", quantity: 1, unitCost: null }] }),
      pedido({ status: "ANULADO" }),
    ]);
    expect(resumen).toMatchObject({
      pedidos: 2,
      monto: 200,
      unidades: 3,
      costo: 40,
      sinCosto: { pedidos: 1, monto: 82 },
      ticketPromedio: 100,
    });
    expect(resumen.coberturaCosto).toBeCloseTo(0.59);
    expect(resumirVentas([]).coberturaCosto).toBeNull();
  });

  it("agrupa por canal normalizado y por día", () => {
    const porCanal = ventasPorCanal([
      pedido({ salesChannel: "LIVE TIKTOK" }),
      pedido({ salesChannel: "TIKTOK_LIVE" }),
      pedido({ salesChannel: "WEB" }),
    ]);
    expect(porCanal.get("TIKTOK_LIVE")?.pedidos).toBe(2);
    expect(porCanal.get("WEB")?.pedidos).toBe(1);
    const porDia = ventasPorDia([pedido(), pedido({ created_at: "2026-11-11T15:00:00.000Z" })]);
    expect([...porDia.keys()].sort()).toEqual(["2026-11-10", "2026-11-11"]);
  });
});

describe("costo dudoso", () => {
  it("marca la venta cuyo costo de línea es igual o mayor que el precio", () => {
    const r = resumirVentas([
      { status: "ENTREGADO", grandTotal: 100, items: [{ lineKind: "PRODUCT", quantity: 1, unitPrice: 100, unitCost: 100 }] },
      { status: "ENTREGADO", grandTotal: 100, items: [{ lineKind: "PRODUCT", quantity: 1, unitPrice: 100, unitCost: 40 }] },
      { status: "ENTREGADO", grandTotal: 50, items: [{ lineKind: "PRODUCT", quantity: 1, unitPrice: 50 }] },
    ]);
    expect(r.costoDudoso).toEqual({ pedidos: 1, monto: 100 });
    expect(r.costo).toBe(140);
    expect(r.sinCosto.pedidos).toBe(1);
  });

  it("con costo de cabecera compara contra el total del pedido", () => {
    expect(costoDudosoPedido({ status: "ENTREGADO", grandTotal: 80, costAmount: 90, items: [] })).toBe(true);
    expect(costoDudosoPedido({ status: "ENTREGADO", grandTotal: 80, costAmount: 30, items: [] })).toBe(false);
  });
});
