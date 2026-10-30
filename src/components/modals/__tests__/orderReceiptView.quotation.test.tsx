import { render, screen } from "@testing-library/react";
import OrderReceiptView from "../orderReceiptView";

function receipt(amount: number, status = "PENDING") {
  const paid = status === "PAID" ? amount : 0;
  return {
    orderNumber: "ORD-000001", status: "PENDIENTE", customer: { fullName: "María" }, items: [],
    payments: [{ amount, status, reference: "quotation:advance-id" }],
    totals: {
      productsTotal: 100, taxTotal: 0, shippingTotal: 20, discountTotal: 0, grandTotal: 120,
      totalPaid: paid, pendingAmount: Math.max(0, 120 - amount),
      quotationPendingAdvance: status === "PENDING" ? amount : 0,
      totalPendingApproval: status === "PENDING" ? amount : 0,
      pendingPaymentsCount: status === "PENDING" ? 1 : 0,
      approvedPaymentsCount: status === "PAID" ? 1 : 0,
    },
  };
}

describe("quotation sale receipt", () => {
  it("shows the order agency alongside its delivery address", () => {
    render(<OrderReceiptView data={{ ...receipt(120, "PAID"), delivery: { type: "AGENCY", agency: "Shalom Huaraz" } }} />);
    expect(screen.getByText("Retiro en agencia")).toBeInTheDocument();
    expect(screen.getByText("Shalom Huaraz")).toBeInTheDocument();
  });
  it("keeps a pending advance outside the approved balance", () => {
    render(<OrderReceiptView data={receipt(30)} />);
    expect(screen.getByText("Por cobrar S/ 120.00")).toBeInTheDocument();
    expect(screen.getByText("Adelanto por verificar:")).toBeInTheDocument();
    expect(screen.getByText(/Pagos Pendientes de Aprobación/)).toBeInTheDocument();
    expect(screen.queryByText("✓ Adelanto pagado:")).not.toBeInTheDocument();
  });

  it("never labels a full pending report as paid", () => {
    render(<OrderReceiptView data={receipt(120)} />);
    expect(screen.getByText("Por cobrar S/ 120.00")).toBeInTheDocument();
    expect(screen.getByText(/Pagos Pendientes de Aprobación/)).toBeInTheDocument();
    expect(screen.queryByText("Pagado")).not.toBeInTheDocument();
    expect(screen.queryByText("✓ Pagado en su totalidad")).not.toBeInTheDocument();
  });

  it("shows payment as approved only when the sale payment is approved", () => {
    render(<OrderReceiptView data={receipt(120, "PAID")} />);
    expect(screen.getByText("Pagado")).toBeInTheDocument();
    expect(screen.getByText("✓ Pagado en su totalidad")).toBeInTheDocument();
    expect(screen.getByText("✓ Adelanto pagado:")).toBeInTheDocument();
    expect(screen.queryByText("Adelanto por verificar:")).not.toBeInTheDocument();
  });
});


it("shows each selected serial exactly once when a line contains multiple units", () => {
  const data = { ...receipt(120, "PAID"), items: [{ productName: "Phone", quantity: 2, unitPrice: 60, units: [{ id: "a", code: "001234567890123" }, { id: "b", code: "001234567890124" }] }] };
  render(<OrderReceiptView data={data} />);
  expect(screen.getAllByText("IMEI / series: 001234567890123")).toHaveLength(1);
  expect(screen.getAllByText("IMEI / series: 001234567890124")).toHaveLength(1);
});
