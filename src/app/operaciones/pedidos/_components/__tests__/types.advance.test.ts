import type { OrderHeader } from "@/interfaces/IOrder";
import { mapOrderToSale } from "../types";

/**
 * El aviso previo al despacho necesita saber CUÁNTO adelanto está sin aprobar y cuánto
 * cobraría el courier; el booleano `hasPendingApprovalPayments` solo decía "sí/no".
 */
function makeOrder(grandTotal: string, payments: Array<{ amount: string; status: string }>): OrderHeader {
  return {
    id: "o-1",
    orderNumber: "ORD-1",
    customer: { id: "c-1", fullName: "Cliente", phoneNumber: "999111222", district: "Lima", address: "Calle 1" },
    deliveryType: "DOMICILIO",
    grandTotal,
    status: "PREPARADO",
    salesRegion: "PROVINCIA",
    items: [],
    payments,
    created_at: "2026-11-12T20:00:00.000Z",
    updated_at: "2026-11-12T20:00:00.000Z",
  } as unknown as OrderHeader;
}

describe("mapOrderToSale · adelanto sin aprobar", () => {
  it("un Yape pendiente de S/ 20 sobre S/ 179: el courier cobraría los 179 completos", () => {
    const sale = mapOrderToSale(makeOrder("179.00", [{ amount: "20.00", status: "PENDING" }]));

    expect(sale.hasPendingApprovalPayments).toBe(true);
    expect(sale.awaitingApprovalAmount).toBe(20);
    expect(sale.collectAmount).toBe(179);
  });

  it("con el adelanto ya aprobado no hay nada por aprobar y el cobro baja", () => {
    const sale = mapOrderToSale(makeOrder("179.00", [{ amount: "20.00", status: "PAID" }]));

    expect(sale.hasPendingApprovalPayments).toBe(false);
    expect(sale.awaitingApprovalAmount).toBe(0);
    expect(sale.collectAmount).toBe(159);
  });

  it("combina un adelanto aprobado y otro pendiente sin mezclarlos", () => {
    const sale = mapOrderToSale(makeOrder("279.00", [
      { amount: "20.00", status: "PAID" },
      { amount: "30.00", status: "PENDING" },
    ]));

    expect(sale.awaitingApprovalAmount).toBe(30);
    expect(sale.collectAmount).toBe(259);
  });

  it("sin pagos no hay adelanto por aprobar", () => {
    const sale = mapOrderToSale(makeOrder("50.00", []));

    expect(sale.awaitingApprovalAmount).toBe(0);
    expect(sale.collectAmount).toBe(50);
  });
});
