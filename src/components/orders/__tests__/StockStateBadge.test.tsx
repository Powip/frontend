import { render, screen } from "@testing-library/react";
import { StockStateBadge } from "../StockStateBadge";
import { mapOrderToSale } from "@/app/operaciones/pedidos/_components/types";
import type { OrderHeader } from "@/interfaces/IOrder";

describe("badge de estado de stock (FEAT-24 H2-F)", () => {
  it.each([
    ["reserved", "Stock: Reservado"],
    ["sin_stock", "Stock: Sin stock"],
    ["sin_reserva", "Stock: Sin reserva"],
    ["por_vincular", "Stock: Por vincular"],
    ["dispatched", "Stock: Despachado"],
    ["delivered", "Stock: Entregado"],
    ["released", "Stock: Liberado"],
    ["returned", "Stock: Devuelto"],
  ])("%s se muestra como «%s» con su explicación", (state, text) => {
    render(<StockStateBadge state={state} />);
    const badge = screen.getByText(text);
    expect(badge).toHaveAttribute("title", expect.stringMatching(/\S/));
  });

  it("sin estado (o uno desconocido) no muestra nada", () => {
    const { container, rerender } = render(<StockStateBadge state={null} />);
    expect(container).toBeEmptyDOMElement();
    rerender(<StockStateBadge />);
    expect(container).toBeEmptyDOMElement();
    rerender(<StockStateBadge state="raro" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("los pedidos de Operaciones conservan el estado que manda el servidor", () => {
    const order = {
      id: "o-1",
      orderNumber: "ORD-1",
      grandTotal: "10",
      payments: [],
      customer: { id: "c-1", fullName: "Ana" },
      status: "PREPARADO",
      stockState: "sin_reserva",
    } as unknown as OrderHeader;
    expect(mapOrderToSale(order).stockState).toBe("sin_reserva");
    expect(mapOrderToSale({ ...order, stockState: undefined } as OrderHeader).stockState).toBeNull();
  });
});
