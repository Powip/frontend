import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { VentaDiaria } from "@/features/panel-control/resumen/models/resumen.model";
import { VentasDiariasChart } from "../charts/VentasDiariasChart";

const DIAS: VentaDiaria[] = [
  {
    dia: "2026-11-05",
    facturacion: 1000,
    ventas: 1,
    unidades: 2,
    diaAnterior: "2026-10-29",
    facturacionAnterior: 800,
  },
  {
    dia: "2026-11-06",
    facturacion: 300,
    ventas: 3,
    unidades: 5,
    diaAnterior: "2026-10-30",
    facturacionAnterior: 500,
  },
  {
    dia: "2026-11-07",
    facturacion: 0,
    ventas: 0,
    unidades: 0,
    diaAnterior: null,
    facturacionAnterior: null,
  },
];

const montar = (over: Partial<Parameters<typeof VentasDiariasChart>[0]> = {}) => {
  const onSelectDia = jest.fn();
  render(
    <VentasDiariasChart
      dias={DIAS}
      ariaLabel="Ventas diarias del periodo"
      conComparacion={false}
      onSelectDia={onSelectDia}
      {...over}
    />,
  );
  return { onSelectDia };
};

describe("VentasDiariasChart", () => {
  it("arranca en Facturación y ofrece las cuatro métricas", () => {
    montar();
    for (const nombre of ["Facturación", "Pedidos", "Unidades", "Ticket promedio"]) {
      expect(screen.getByRole("button", { name: nombre })).toBeInTheDocument();
    }
    expect(screen.getByRole("button", { name: "Facturación" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByText("Ventas diarias del periodo · Facturación")).toBeInTheDocument();
  });

  it("el selector cambia la métrica del gráfico sin perder la barra de cada día", async () => {
    const user = userEvent.setup();
    montar();
    await user.click(screen.getByRole("button", { name: "Unidades" }));
    expect(screen.getByRole("button", { name: "Unidades" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Facturación" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(screen.getByText("Ventas diarias del periodo · Unidades")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Ticket promedio" }));
    expect(screen.getByText("Ventas diarias del periodo · Ticket promedio")).toBeInTheDocument();
  });

  it("cada barra describe las cuatro cifras del día sea cual sea la métrica elegida", async () => {
    const user = userEvent.setup();
    montar();
    await user.click(screen.getByRole("button", { name: "Pedidos" }));
    const barra = screen.getByRole("button", {
      name: /^6 nov: .*3 ventas · 5 unidades · ticket S\/ 100/,
    });
    expect(barra).toBeInTheDocument();
    // El día sin ventas no inventa un ticket.
    expect(
      screen.getByRole("button", { name: /^7 nov: .*0 ventas · 0 unidades · ticket —/ }),
    ).toBeInTheDocument();
  });

  it("el clic en una barra abre los pedidos de ese día", async () => {
    const user = userEvent.setup();
    const { onSelectDia } = montar();
    await user.click(screen.getByRole("button", { name: /^6 nov:/ }));
    expect(onSelectDia).toHaveBeenCalledWith("2026-11-06");
  });

  it("el total del periodo trae pedidos, unidades y el ticket de los totales", () => {
    montar();
    expect(screen.getByText(/4 ventas · 7 unidades · ticket S\/ 325/)).toBeInTheDocument();
  });

  it("la línea del periodo anterior solo existe para facturación y avisa por qué desaparece", async () => {
    const user = userEvent.setup();
    montar({ conComparacion: true });
    expect(screen.getByText("Periodo anterior (misma antigüedad)")).toBeInTheDocument();
    expect(screen.queryByRole("note")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Unidades" }));
    expect(screen.queryByText("Periodo anterior (misma antigüedad)")).not.toBeInTheDocument();
    expect(screen.getByRole("note")).toHaveTextContent(
      "La línea del periodo anterior solo existe para facturación.",
    );
  });
});
