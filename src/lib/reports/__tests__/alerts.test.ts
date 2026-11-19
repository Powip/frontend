import { alertBadgeText, alertCounts, alertHref, alertOrderIds, alertRows, upcomingAlerts } from "../alerts";
import type { InventoryAlerts } from "@/services/inventoryReportsService";

const DATA: InventoryAlerts = {
  generatedAt: "2026-11-18T15:00:00Z",
  total: 9,
  alerts: [
    {
      type: "bajo_minimo",
      enabled: true,
      count: 3,
      items: [
        { inventoryId: "w1", inventoryName: "Central", variantId: "v1", physical: 2, reserved: 0, available: 2, minStock: 5, outOfStock: false, productName: "Polo", sku: "POL-M", attributes: { Talla: "M" } },
        { inventoryId: "w1", inventoryName: "Central", variantId: "v2", physical: 1, reserved: 1, available: 0, minStock: 3, outOfStock: true, productName: "Gorra", sku: null, attributes: {} },
      ],
    },
    { type: "sin_stock_con_pedidos", enabled: true, count: 1, items: [{ orderId: "o1", inventoryId: "w2", since: "2026-11-15T00:00:00Z", ageDays: 3, lines: [{ variantId: "v1", quantity: 2 }] }] },
    { type: "reservas_viejas", enabled: true, count: 1, releaseAfterDays: 7, items: [{ orderId: "o2", inventoryId: "w1", reservedAt: "2026-11-11T00:00:00Z", ageDays: 7, releasesAt: "2026-11-18T05:00:00Z" }] },
    { type: "devoluciones_por_recibir", enabled: true, count: 1, items: [{ id: "r1", orderId: "o3", orderNumber: "ORD-150001", inventoryId: "w1", createdAt: "2026-11-01T00:00:00Z", ageDays: 17, units: 2 }] },
    { type: "sku_por_vincular", enabled: true, count: 3, items: [] },
    { type: "lotes_por_vencer", enabled: false, dependsOn: "H5", count: 0, items: [] },
    { type: "packs_bajo_margen", enabled: false, dependsOn: "H9", count: 0, items: [] },
  ],
};

const names: Record<string, string> = { w1: "Central", w2: "Courier Olva" };

describe("alertas de inventario (FEAT-24 H10-D8)", () => {
  it("arma una fila por ítem con su tipo, detalle y la pantalla que la resuelve", () => {
    const rows = alertRows(DATA, { orderNumbers: { o1: "ORD-150100" }, warehouseName: (id) => names[id] });
    expect(rows.map((row) => [row.title, row.tone, row.href])).toEqual([
      ["Bajo mínimo", "amber", "/compras"],
      ["Agotado", "red", "/compras"],
      ["Bajo mínimo", "amber", "/compras"],
      ["Pedido sin stock", "red", "/inventario/pedidos-sin-stock"],
      ["Reserva vieja", "amber", "/operaciones/pedidos"],
      ["Devolución sin recibir", "amber", "/inventario/recepciones"],
      ["SKU por vincular", "slate", "/inventario/unificacion"],
    ]);
    expect(rows[0].description).toBe("Polo · Talla: M (POL-M) en Central: 2 disponible, mínimo 5.");
    expect(rows[2].description).toBe("Y 1 más.");
    expect(rows[3].description).toBe("ORD-150100 en Courier Olva espera 2 und hace 3 días.");
    expect(rows[4].description).toBe("Pedido tiene stock reservado sin despachar hace 7 días. Se libera sola el 18/11/2026.");
    expect(rows[5].description).toBe("ORD-150001 · 2 und por recibir en Central hace 17 días.");
    expect(rows[6].description).toMatch(/^3 SKU de tus canales no están unidos/);
  });

  it("cuenta por tipo, lista las apagadas y los pedidos a numerar", () => {
    expect(alertCounts(DATA).map((item) => `${item.title}: ${item.count}`)).toEqual([
      "Bajo mínimo: 3",
      "Pedido sin stock: 1",
      "Reserva vieja: 1",
      "Devolución sin recibir: 1",
      "SKU por vincular: 3",
    ]);
    expect(upcomingAlerts(DATA)).toEqual(["Lotes por vencer", "Pack bajo margen"]);
    expect(alertOrderIds(DATA)).toEqual(["o1", "o2"]);
    expect(alertBadgeText(7)).toBe("7");
    expect(alertBadgeText(140)).toBe("99+");
  });
});

describe("atajo de la alerta «Bajo mínimo» al pedido sugerido (FEAT-24 H13)", () => {
  it("con la acción `suggested_purchase` todas sus filas (y «Y N más») abren el pedido sugerido con sus parámetros", () => {
    const withAction: InventoryAlerts = {
      ...DATA,
      alerts: DATA.alerts.map((alert) =>
        alert.type === "bajo_minimo" ? { ...alert, action: { type: "suggested_purchase", params: { includeWithoutSales: true } } } : alert,
      ),
    };
    const rows = alertRows(withAction).filter((row) => row.type === "bajo_minimo");
    expect(rows).toHaveLength(3);
    expect(rows.every((row) => row.href === "/compras/sugerido?includeWithoutSales=true" && row.action === "Crear compra")).toBe(true);
  });

  it("sin acción (servidor anterior) sigue yendo a Compras; otra acción no cambia el destino", () => {
    expect(alertHref({ type: "bajo_minimo" })).toBe("/compras");
    expect(alertHref({ type: "reservas_viejas", action: { type: "otra" } })).toBe("/operaciones/pedidos");
  });
});
