import { fireEvent, render, screen, within } from "@testing-library/react";
import { OperationsTabCards, OperationsTabHeading } from "../OperationsTabsHeader";
import type { OperationsCounts } from "@/services/operationsPedidosService";

const counts: OperationsCounts = {
  preparados: 32, preparadosContactados: 24, preparadosNoContactados: 8,
  enCamino: 41, despachados: 18, entregados: 156, anulados: 12, historial: 168, atencion: 3,
};

describe("OperationsTabCards", () => {
  it("muestra una tarjeta por pestaña, en el orden pedido, con su contador", () => {
    render(<OperationsTabCards counts={counts} active="preparados" onSelect={jest.fn()} />);

    const tabs = screen.getAllByRole("tab");
    expect(tabs.map((tab) => tab.getAttribute("data-testid"))).toEqual([
      "tab-card-preparados", "tab-card-camino", "tab-card-despachados", "tab-card-entregados",
      "tab-card-anulados", "tab-card-historial", "tab-card-atencion",
    ]);
    expect(within(screen.getByTestId("tab-card-preparados")).getByText("32")).toBeInTheDocument();
    expect(within(screen.getByTestId("tab-card-camino")).getByText("41")).toBeInTheDocument();
    expect(within(screen.getByTestId("tab-card-historial")).getByText("168")).toBeInTheDocument();
    expect(screen.queryByText("Pendientes")).not.toBeInTheDocument();
  });

  it("Necesita atención dice 'N alertas' en rojo cuando hay y se vuelve neutra sin alertas", () => {
    const { rerender } = render(<OperationsTabCards counts={counts} active="preparados" onSelect={jest.fn()} />);
    const card = screen.getByTestId("tab-card-atencion");
    expect(card).toHaveTextContent("3alertas");
    expect(card.className).toMatch(/bg-red-50/);

    rerender(<OperationsTabCards counts={{ ...counts, atencion: 1 }} active="preparados" onSelect={jest.fn()} />);
    expect(screen.getByTestId("tab-card-atencion")).toHaveTextContent("1alerta");

    rerender(<OperationsTabCards counts={{ ...counts, atencion: 0 }} active="preparados" onSelect={jest.fn()} />);
    expect(screen.getByTestId("tab-card-atencion").className).not.toMatch(/bg-red-50/);
  });

  it("la pestaña activa queda marcada y elegir otra avisa su clave", () => {
    const onSelect = jest.fn();
    render(<OperationsTabCards counts={counts} active="camino" onSelect={onSelect} />);

    expect(screen.getByTestId("tab-card-camino")).toHaveAttribute("aria-selected", "true");
    expect(screen.getByTestId("tab-card-preparados")).toHaveAttribute("aria-selected", "false");
    fireEvent.click(screen.getByTestId("tab-card-despachados"));
    expect(onSelect).toHaveBeenCalledWith("despachados");
  });

  it("mientras no llegan los contadores no inventa números", () => {
    render(<OperationsTabCards active="preparados" onSelect={jest.fn()} />);
    expect(within(screen.getByTestId("tab-card-preparados")).getByText("–")).toBeInTheDocument();
  });
});

describe("OperationsTabHeading", () => {
  it("muestra nombre, 'N pedidos', descripción y la acción principal", () => {
    render(<OperationsTabHeading tab="preparados" total={32} action={<button>+ Asignar a guía de salida</button>} />);

    expect(screen.getByRole("heading", { name: "Preparados" })).toBeInTheDocument();
    expect(screen.getByTestId("tab-total-badge")).toHaveTextContent("32 pedidos");
    expect(screen.getByText(/al asignar la guía, el pedido cambiará a en camino/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "+ Asignar a guía de salida" })).toBeInTheDocument();
  });

  it("no muestra el total mientras carga", () => {
    render(<OperationsTabHeading tab="entregados" />);
    expect(screen.queryByTestId("tab-total-badge")).not.toBeInTheDocument();
  });
});
