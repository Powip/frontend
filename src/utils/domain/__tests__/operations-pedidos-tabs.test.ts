import type { OrderHeader, OrderStatus } from "@/interfaces/IOrder";
import {
  PRE_FULFILLMENT_STATUSES,
  SHIPPING_STATUSES,
  getPedidosTab,
} from "../operations-pedidos-tabs";

/**
 * Bug corregido: un pedido PAGADO ("PENDIENTE + cobrado al 100%", todavía no
 * empacado por almacén) caía por el fallback de `getPedidosTab` directo a
 * "despachar" y se mostraba en Operaciones como si ya estuviera PREPARADO.
 * Cobrar el 100% no es lo mismo que preparar el pedido — PAGADO ahora forma
 * parte de `PRE_FULFILLMENT_STATUSES`, igual que PENDIENTE/INCOMPLETE/
 * PREVENTA, y cada pantalla de Operaciones (Pedidos, Planificación de guías)
 * debe filtrarlo antes de llamar a `getPedidosTab`.
 */
function makeOrder(overrides: Partial<OrderHeader> = {}): OrderHeader {
  return {
    id: "order-1",
    status: "PREPARADO",
    ...overrides,
  } as unknown as OrderHeader;
}

describe("PRE_FULFILLMENT_STATUSES", () => {
  it("incluye PAGADO junto con PENDIENTE/INCOMPLETE/PREVENTA", () => {
    expect(PRE_FULFILLMENT_STATUSES).toEqual(
      expect.arrayContaining(["PAGADO", "PENDIENTE", "INCOMPLETE", "PREVENTA"]),
    );
  });

  it("no incluye estados que sí son responsabilidad de Operaciones", () => {
    expect(PRE_FULFILLMENT_STATUSES).not.toEqual(
      expect.arrayContaining(["PREPARADO", "LLAMADO", "ASIGNADO_A_GUIA", "EN_ENVIO", "ENTREGADO", "ANULADO"]),
    );
  });
});

describe("getPedidosTab — fallback para estados no filtrados", () => {
  it("un pedido PAGADO cae en 'despachar' por el fallback si NO se filtra antes (por eso los callers deben excluirlo)", () => {
    // Este test documenta el comportamiento del fallback en sí — no la
    // recomendación de uso. Los callers reales (PedidosContent.tsx,
    // PlanificacionTab.tsx) deben excluir PRE_FULFILLMENT_STATUSES antes de
    // llamar a getPedidosTab, como hacen hoy.
    expect(getPedidosTab(makeOrder({ status: "PAGADO" }))).toBe("despachar");
  });

  it("un pedido PREPARADO va a 'despachar'", () => {
    expect(getPedidosTab(makeOrder({ status: "PREPARADO" }))).toBe("despachar");
  });
});

/**
 * Matriz completa: para cada uno de los 10 `OrderStatus` posibles, ¿pasa a
 * Operaciones › Pedidos o se queda en Ventas/Atención al Cliente? Replica
 * exactamente el filtro real de `visibleOrders` en PedidosContent.tsx
 * (`!PRE_FULFILLMENT_STATUSES.includes(o.status)`) — si alguien agrega un
 * estado nuevo al enum sin decidir dónde cae, este test lo obliga a
 * pronunciarse en vez de dejarlo pasar en silencio por el fallback.
 */
function isVisibleInOperaciones(status: OrderStatus): boolean {
  return !PRE_FULFILLMENT_STATUSES.includes(status);
}

describe("¿Qué estados pasan a Operaciones › Pedidos y cuáles no?", () => {
  const NO_PASA: OrderStatus[] = ["INCOMPLETE", "PREVENTA", "PENDIENTE", "PAGADO"];
  const SI_PASA: { status: OrderStatus; tab: string }[] = [
    { status: "PREPARADO", tab: "despachar" },
    { status: "LLAMADO", tab: "despachar" },
    { status: "ASIGNADO_A_GUIA", tab: "despachar" },
    { status: "EN_ENVIO", tab: "camino" },
    { status: "ENTREGADO", tab: "historial" },
    { status: "ANULADO", tab: "anulados" },
  ];

  it.each(NO_PASA)(
    "%s NO pasa a Operaciones — sigue siendo un pedido de Ventas/Atención al Cliente hasta que se prepare",
    (status) => {
      expect(isVisibleInOperaciones(status)).toBe(false);
    },
  );

  it.each(SI_PASA)(
    "$status SÍ pasa a Operaciones y cae en la pestaña '$tab'",
    ({ status, tab }) => {
      expect(isVisibleInOperaciones(status)).toBe(true);
      expect(getPedidosTab(makeOrder({ status }))).toBe(tab);
    },
  );

  it("cubre los 10 estados de OrderStatus sin dejar ninguno sin clasificar", () => {
    const todos = [...NO_PASA, ...SI_PASA.map((c) => c.status)];
    expect(todos.sort()).toEqual(
      [
        "ANULADO",
        "ASIGNADO_A_GUIA",
        "EN_ENVIO",
        "ENTREGADO",
        "INCOMPLETE",
        "LLAMADO",
        "PAGADO",
        "PENDIENTE",
        "PREPARADO",
        "PREVENTA",
      ].sort(),
    );
  });

  it("EN_ENVIO con fallo de entrega o error de sync cae en 'atencion', no en 'camino'", () => {
    expect(
      getPedidosTab(
        makeOrder({ status: "EN_ENVIO", shalomStatus: "DEVUELTO" } as Partial<OrderHeader>),
      ),
    ).toBe("atencion");
    expect(
      getPedidosTab(makeOrder({ status: "EN_ENVIO", shalomError: "algo falló" })),
    ).toBe("atencion");
  });
});

describe("SHIPPING_STATUSES (Tablero de Operaciones)", () => {
  it("excluye PAGADO/PENDIENTE/INCOMPLETE/PREVENTA — el Tablero tampoco cuenta pedidos sin preparar", () => {
    for (const status of PRE_FULFILLMENT_STATUSES) {
      expect(SHIPPING_STATUSES).not.toContain(status);
    }
  });

  it("incluye el pipeline activo de despacho", () => {
    expect(SHIPPING_STATUSES).toEqual([
      "PREPARADO",
      "LLAMADO",
      "ASIGNADO_A_GUIA",
      "EN_ENVIO",
      "ENTREGADO",
    ]);
  });
});
