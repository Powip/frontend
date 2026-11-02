import type { OrderHeader } from "@/interfaces/IOrder";
import { buildGuiasPorLiquidar } from "../utils";

const delivered = { id: "order-1", orderNumber: "ORD-1", status: "ENTREGADO", courier: "Shalom",
  grandTotal: "100", payments: [], created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z" } as unknown as OrderHeader;

it("does not turn an old delivered unpaid order into collected or overdue courier debt", () => {
  const rows = buildGuiasPorLiquidar([delivered], new Set());
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({ estado: "POR_VERIFICAR", saldoPendiente: 100, vencido: false });
  expect(delivered.payments).toEqual([]);
});

it("does not claim a courier settlement from a customer's approved payment", () => {
  const paid = { ...delivered, payments: [{ status: "PAID", amount: "100" }] } as OrderHeader;
  expect(buildGuiasPorLiquidar([paid], new Set())).toEqual([]);
});

it("keeps missing payment information visible as unknown instead of falsely paid", () => {
  const unknown = { ...delivered, payments: undefined } as unknown as OrderHeader;
  const [row] = buildGuiasPorLiquidar([unknown], new Set());
  expect(row.estado).toBe("POR_VERIFICAR");
  expect(row.saldoPendiente).toBeNaN();
});

it("does not include an order that has only been dispatched", () => {
  expect(buildGuiasPorLiquidar([{ ...delivered, status: "DESPACHADO" }], new Set())).toEqual([]);
});
