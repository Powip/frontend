import { applyFilters, emptySalesFilters } from "../SalesTableFilters";
import type { OrderStatus } from "@/interfaces/IOrder";
const row = (orderNumber: string, status: OrderStatus, pendingPayment: number) => ({
  orderNumber, status, pendingPayment, clientName: "Cliente", phoneNumber: "999999999", date: "23/10/2026",
  paymentMethod: "YAPE", salesRegion: "LIMA" as const, deliveryType: "DOMICILIO",
});

it("filters payment independently from the operational stage", () => {
  const rows = [row("pending-paid", "PENDIENTE", 0), row("prepared-debt", "PREPARADO", 100), row("shipping-paid", "EN_ENVIO", 0), row("one-cent", "EN_ENVIO", 0.01)];
  expect(applyFilters(rows, { ...emptySalesFilters, hasPendingBalance: "no" }).map((item) => item.orderNumber)).toEqual(["pending-paid", "shipping-paid"]);
  expect(applyFilters(rows, { ...emptySalesFilters, hasPendingBalance: "yes" }).map((item) => item.orderNumber)).toEqual(["prepared-debt", "one-cent"]);
});

it("normalizes the legacy PAGADO alias in the operational filter", () => {
  const rows = [row("legacy", "PAGADO", 0), row("pending", "PENDIENTE", 100), row("prepared", "PREPARADO", 0)];
  expect(applyFilters(rows, { ...emptySalesFilters, status: "PENDIENTE" }).map((item) => item.orderNumber)).toEqual(["legacy", "pending"]);
});

it("never includes unknown balance in the paid filter", () => {
  expect(applyFilters([row("unknown", "PREPARADO", Number.NaN)], { ...emptySalesFilters, hasPendingBalance: "no" })).toEqual([]);
});
