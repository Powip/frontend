import { render, screen } from "@testing-library/react";
import { AvisoCostos } from "../ui";

describe("AvisoCostos", () => {
  it("no muestra nada con todos los costos cargados y razonables", () => {
    const { container } = render(
      <AvisoCostos costo={{ cobertura: 1, sinCostoPedidos: 0, sinCostoMonto: 0, dudosoPedidos: 0, dudosoParte: 0 }} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("avisa las ventas sin costo y las de costo igual o mayor que el precio", () => {
    render(
      <AvisoCostos costo={{ cobertura: 0.9, sinCostoPedidos: 2, sinCostoMonto: 100, dudosoPedidos: 7, dudosoParte: 0.6 }} />,
    );
    expect(screen.getByText(/2 ventas no tienen costo cargado/)).toBeInTheDocument();
    expect(screen.getByText(/En 7 ventas el costo cargado es igual o mayor que el precio/)).toBeInTheDocument();
    expect(screen.getByText(/precio base/)).toBeInTheDocument();
  });
});
