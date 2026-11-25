import { render, screen } from "@testing-library/react";
import { SaleAmounts } from "../SaleAmounts";

// FEAT-33 A4: Total · Adel (solo validado) · «Yape por validar» en morado · Debe, y la etiqueta.
describe("SaleAmounts", () => {
  test("a Yape proof under review never reads «Con saldo»", () => {
    render(
      <SaleAmounts
        total={199}
        advancePayment={0}
        pendingPayment={199}
        awaitingApproval={{ amount: 199, label: "Yape por validar" }}
        status="PENDIENTE"
        currency="PEN"
      />,
    );
    expect(screen.getByText("Adel: S/ 0.00")).toBeInTheDocument();
    expect(screen.getByText("Yape por validar: S/ 199.00")).toHaveClass(
      "text-purple-700",
    );
    expect(screen.getByText("Debe: S/ 199.00")).toBeInTheDocument();
    expect(screen.getByText("Por validar")).toBeInTheDocument();
    expect(screen.queryByText("Con saldo")).not.toBeInTheDocument();
  });

  test("once validated it reads «Pagado» with nothing owed", () => {
    render(
      <SaleAmounts
        total={199}
        advancePayment={199}
        pendingPayment={0}
        awaitingApproval={{ amount: 0, label: null }}
        status="PENDIENTE"
        currency="PEN"
      />,
    );
    expect(screen.getByText("Adel: S/ 199.00")).toBeInTheDocument();
    expect(screen.queryByText(/por validar/)).not.toBeInTheDocument();
    expect(screen.getByText("Pagado")).toBeInTheDocument();
  });

  test("a balance without a pending payment reads «Con saldo»", () => {
    render(
      <SaleAmounts
        total={100}
        advancePayment={30}
        pendingPayment={70}
        awaitingApproval={{ amount: 0, label: null }}
        status="PENDIENTE"
        currency="PEN"
      />,
    );
    expect(screen.getByText("Con saldo")).toBeInTheDocument();
  });
});
