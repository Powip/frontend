import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TooltipProvider } from "@/components/ui/tooltip";
import { METAS_INDICADORES_ESPECIFICACION } from "@/features/panel-control/shared/config/panel-goals.defaults";
import { evaluarMeta } from "@/features/panel-control/shared/utils/semaforo";
import { BarChart } from "../charts/BarChart";
import { HBarList } from "../charts/HBarList";
import { KpiCard } from "../KpiCard";

describe("BarChart", () => {
  it("permite abrir el detalle de una barra con teclado", async () => {
    const user = userEvent.setup();
    const onSelect = jest.fn();
    render(
      <BarChart
        ariaLabel="Ventas diarias"
        formatAxis={String}
        data={[
          { key: "1", label: "1", value: 10, description: "1 set: S/ 10", onSelect },
          { key: "2", label: "2", value: 20, description: "2 set: S/ 20" },
        ]}
      />,
    );
    const barra = screen.getByRole("button", { name: "1 set: S/ 10. Ver pedidos" });
    barra.focus();
    await user.keyboard("{Enter}");
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(screen.getAllByRole("button")).toHaveLength(1);
    expect(screen.getByText("Ver datos del gráfico")).toBeInTheDocument();
  });
});

describe("HBarList", () => {
  it("muestra participación y usa botones solo cuando hay detalle", () => {
    render(
      <HBarList
        ariaLabel="Canales"
        formatValue={String}
        rows={[
          { key: "a", label: "A", value: 75, onSelect: jest.fn() },
          { key: "b", label: "B", value: 25 },
        ]}
      />,
    );
    expect(screen.getByRole("button", { name: /A: 75 \(75%\)\. Ver pedidos/ })).toBeInTheDocument();
    expect(screen.getAllByRole("button")).toHaveLength(1);
  });
});

describe("KpiCard", () => {
  it("muestra meta, origen demo y acción de detalle accesibles", async () => {
    const user = userEvent.setup();
    const onDrill = jest.fn();
    render(
      <TooltipProvider>
        <KpiCard
          label="Confirmados"
          value="60%"
          glosario="confirmacion"
          meta={evaluarMeta(0.6, METAS_INDICADORES_ESPECIFICACION.confirmacion)}
          origin={{
            kind: "demo",
            contractId: "callcenter",
            endpoint: "GET /panel/callcenter",
            detalle: "Demo",
          }}
          onDrill={onDrill}
        />
      </TooltipProvider>,
    );
    expect(screen.getByRole("region", { name: "Confirmados" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Cerca · Meta ≥ 65%/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Demo:/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Qué significa Confirmación" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /ver pedidos/i }));
    expect(onDrill).toHaveBeenCalled();
  });

  it("no pinta verde si no hay datos", () => {
    render(
      <TooltipProvider>
        <KpiCard
          label="Confirmados"
          value="—"
          meta={evaluarMeta(null, METAS_INDICADORES_ESPECIFICACION.confirmacion)}
        />
      </TooltipProvider>,
    );
    expect(screen.getByRole("button", { name: "Sin datos" })).toBeInTheDocument();
  });
});
