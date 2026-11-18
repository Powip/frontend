import { formatMoney } from "@/lib/purchaseOrders";
import type { InventoryAlerts } from "@/services/inventoryReportsService";
import { alertCounts, alertHref, alertRows, couriersHref, upcomingAlerts } from "../alerts";

// FEAT-24 H8 — alertas del courier compartido: `conciliacion_courier_pendiente` (reemplaza a la apagada
// `conciliacion_con_diferencia`) y `reclamos_abiertos_viejos`. Cada fila lleva a Inventario › Couriers con
// el almacén (y el reclamo) de la alerta.

const DATA: InventoryAlerts = {
  generatedAt: "2026-11-18T15:00:00Z",
  total: 4,
  alerts: [
    {
      type: "conciliacion_courier_pendiente",
      enabled: true,
      count: 2,
      items: [
        { id: "rec-1", number: "CON-0001", inventoryId: "w-3", courierProvider: "aliclik", createdAt: "2026-11-10T15:00:00Z", ageDays: 8, unexplainedLines: 2, shortageUnits: 3, shortageValue: 97.2, surplusUnits: 1 },
      ],
    },
    {
      type: "reclamos_abiertos_viejos",
      enabled: true,
      count: 1,
      thresholdDays: 15,
      items: [{ id: "cl-1", number: "RCL-0002", inventoryId: "w-4", courierProvider: "olva", status: "aceptado", units: 3, value: 97.2, createdAt: "2026-10-30T15:00:00Z", ageDays: 19 }],
    },
    { type: "packs_bajo_margen", enabled: false, dependsOn: "H9", count: 0, items: [] },
  ],
};

const names: Record<string, string> = { "w-3": "Aliclik Lima", "w-4": "Olva Cusco" };

describe("alertas del courier (FEAT-24 H8)", () => {
  it("una fila por conciliación pendiente y por reclamo viejo, con enlace a Couriers", () => {
    const rows = alertRows(DATA, { warehouseName: (id) => names[id] });
    expect(rows.map((row) => [row.title, row.tone, row.action, row.href])).toEqual([
      ["Courier no cuadra", "amber", "Conciliar", "/inventario/couriers?almacen=w-3"],
      ["Courier no cuadra", "amber", "Conciliar", "/inventario/couriers"],
      ["Reclamo al courier sin cobrar", "amber", "Ver reclamo", "/inventario/couriers?almacen=w-4&reclamo=cl-1"],
    ]);
    expect(rows[0].description).toBe("CON-0001 en Aliclik Lima: 2 SKU sin explicar (faltan 3 und, sobran 1), abierta hace 8 días.");
    expect(rows[1].description).toBe("Y 1 más.");
    expect(rows[2].description).toBe(`RCL-0002 (aceptado) en Olva Cusco: 3 und por ${formatMoney(97.2)} sin cobrar hace 19 días.`);
  });

  it("sin rol de costos (la API omite el monto) el reclamo sale sin monto", () => {
    const masked: InventoryAlerts = {
      ...DATA,
      alerts: [{ type: "reclamos_abiertos_viejos", enabled: true, count: 1, items: [{ id: "cl-1", number: "RCL-0002", inventoryId: "w-4", courierProvider: "olva", status: "abierto", units: 3, createdAt: null, ageDays: null }] }],
    };
    expect(alertRows(masked, { warehouseName: (id) => names[id] })[0].description).toBe("RCL-0002 (abierto) en Olva Cusco: 3 und sin cobrar.");
  });

  it("los chips y el destino por tipo usan los nombres nuevos; la vieja ya no existe", () => {
    expect(alertCounts(DATA).map((item) => `${item.title}: ${item.count}`)).toEqual(["Courier no cuadra: 2", "Reclamo al courier sin cobrar: 1"]);
    expect(upcomingAlerts(DATA)).toEqual(["Pack bajo margen"]);
    expect(alertHref({ type: "conciliacion_courier_pendiente" })).toBe("/inventario/couriers");
    expect(alertHref({ type: "reclamos_abiertos_viejos" })).toBe("/inventario/couriers");
    expect(alertHref({ type: "conciliacion_con_diferencia" })).toBe("/inventario/stock");
    expect(couriersHref()).toBe("/inventario/couriers");
  });
});
