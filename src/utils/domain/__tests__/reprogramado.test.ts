import { shouldShowReprogramado } from "../reprogramado";
import type { OrderStatus } from "@/interfaces/IOrder";

/**
 * Chip "🔁 fecha" de /ventas (ORD-156702): el pedido ya estaba EN_ENVIO y la
 * lista seguía mostrando "14-nov" porque la programación (callStatus SCHEDULED +
 * callbackAt) queda guardada aunque el pedido avance. El chip solo informa
 * mientras el pedido no haya pasado LLAMADO — mismo criterio que el cron de
 * ms-ventas, que a esos estados solo les limpia la programación.
 */
const scheduled = { callStatus: "SCHEDULED" as const, callbackAt: "2026-11-14T20:00:00.000Z" };

describe("shouldShowReprogramado", () => {
  it.each<OrderStatus>(["PENDIENTE", "PREPARADO", "LLAMADO"])(
    "muestra el chip en un pedido %s reprogramado",
    (status) => {
      expect(shouldShowReprogramado({ ...scheduled, status })).toBe(true);
    },
  );

  it.each<OrderStatus>(["ASIGNADO_A_GUIA", "EN_ENVIO", "DESPACHADO", "ENTREGADO", "ANULADO"])(
    "oculta el chip cuando el pedido ya está %s",
    (status) => {
      expect(shouldShowReprogramado({ ...scheduled, status })).toBe(false);
    },
  );

  it("oculta el chip si no está SCHEDULED", () => {
    expect(
      shouldShowReprogramado({ status: "PREPARADO", callStatus: "CONFIRMED", callbackAt: scheduled.callbackAt }),
    ).toBe(false);
    expect(shouldShowReprogramado({ status: "PREPARADO", callStatus: null, callbackAt: null })).toBe(false);
  });

  it("oculta el chip si falta la fecha", () => {
    expect(shouldShowReprogramado({ status: "PREPARADO", callStatus: "SCHEDULED", callbackAt: null })).toBe(false);
  });
});
