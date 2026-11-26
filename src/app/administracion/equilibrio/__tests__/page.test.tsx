import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  formatNumber,
  formatPercent,
  formatSoles,
} from "@/features/panel-control/shared/utils/format";
import type { IGastoOperativo } from "@/interfaces/IAdmin";
import type { PublicidadConectada } from "../../_lib/publicidad";
import { calcularResultados, prorratearGastos } from "../../_lib/resultados";
import type { DatosPeriodo } from "../../_lib/useResultados";
import { type PedidoAdmin, resumirVentas } from "../../_lib/ventas";
import EquilibrioPage from "../page";

jest.mock("@/contexts/AdminPeriodContext", () => ({
  useAdminPeriod: () => ({ fromDate: "2026-11-01", toDate: "2026-11-30", setPeriod: jest.fn() }),
}));

const mockPeriodo = jest.fn();
jest.mock("../../_lib/useResultados", () => ({
  useResultadosPeriodo: (...args: unknown[]) => mockPeriodo(...args),
}));

const DESDE = "2026-11-01";
const HASTA = "2026-11-30";

const gasto = (extra: Partial<IGastoOperativo>): IGastoOperativo => ({
  id: "g",
  company_id: "c1",
  categoria: "PLANILLA",
  descripcion: null,
  monto: 600,
  mes: 11,
  anio: 2026,
  created_at: "",
  updated_at: "",
  ...extra,
});

function datos(
  pedidos: PedidoAdmin[],
  opciones: { gastos?: IGastoOperativo[]; envios?: number; publicidad?: number } = {},
): DatosPeriodo {
  const gastosCrudos = opciones.gastos ?? [];
  const ventas = resumirVentas(pedidos);
  const gastos = prorratearGastos(gastosCrudos, DESDE, HASTA);
  const publicidad: PublicidadConectada = {
    estado: "ok",
    monto: opciones.publicidad ?? 0,
    porDia: new Map(),
    cobertura: "complete",
    diasFaltantes: 0,
    provisional: false,
    otrasMonedas: [],
  };
  return {
    desde: DESDE,
    hasta: HASTA,
    cargando: false,
    error: null,
    pedidos,
    ventas,
    gastos,
    gastosCrudos,
    merma: { unidades: 0, costo: 0 },
    envios: opciones.envios ?? 0,
    publicidad,
    resultados: calcularResultados({
      ventas,
      gastos,
      merma: 0,
      envios: opciones.envios ?? 0,
      publicidadConectada: publicidad.monto,
      igvPct: 18,
    }),
  };
}

const NOV = "2026-11-10T15:00:00Z";
// 2 pedidos, 5 unidades: antes se contaba 1 «unidad» por pedido.
const pedidos: PedidoAdmin[] = [
  {
    id: "a",
    status: "ENTREGADO",
    grandTotal: 600,
    channelFee: 30,
    created_at: NOV,
    items: [{ lineKind: "PRODUCT", quantity: 3, unitCost: 60 }],
  },
  {
    id: "b",
    status: "ENTREGADO",
    grandTotal: 400,
    created_at: NOV,
    items: [
      { lineKind: "PRODUCT", quantity: 2, unitCost: 60 },
      { lineKind: "SERVICE", quantity: 1, unitCost: 0 },
    ],
  },
];

function seccion(titulo: string | RegExp): HTMLElement {
  const el = screen.getByRole("heading", { name: titulo }).closest("section");
  if (!el) throw new Error(`No se encontró la sección ${String(titulo)}`);
  return el;
}

function renderPagina() {
  return render(
    <TooltipProvider>
      <EquilibrioPage />
    </TooltipProvider>,
  );
}

const kpi = (nombre: string) => screen.getByRole("region", { name: nombre });

beforeEach(() => mockPeriodo.mockReset());

describe("Punto de equilibrio", () => {
  it("separa fijos de variables y calcula en ventas y en unidades reales", () => {
    // Ventas 1000; variables = costo 300 + comisión 30 + envíos 50 + publicidad 120 = 500 → margen 50 %.
    // Fijos: planilla 600 (los envíos y la publicidad NO cuentan como fijos).
    const d = datos(pedidos, { gastos: [gasto({})], envios: 50, publicidad: 120 });
    mockPeriodo.mockReturnValue(d);
    renderPagina();

    expect(d.resultados.margenContribucion).toBeCloseTo(0.5);
    expect(within(kpi("Gastos fijos del periodo")).getByText(formatSoles(600))).toBeInTheDocument();
    expect(
      within(kpi("Margen de contribución")).getByText(formatPercent(0.5, 1)),
    ).toBeInTheDocument();
    // 600 ÷ 0,5 = 1200; contribución por unidad 500 ÷ 5 = 100 → 6 unidades.
    expect(within(kpi("Punto de equilibrio")).getByText(formatSoles(1200))).toBeInTheDocument();
    expect(within(kpi("Punto de equilibrio")).getByText("≈ 6 unidades")).toBeInTheDocument();
    // (1000 − 1200) ÷ 1000 = −20 %.
    expect(
      within(kpi("Margen de seguridad")).getByText(formatPercent(-0.2, 1)),
    ).toBeInTheDocument();

    const avance = seccion("Avance hacia el punto de equilibrio");
    expect(within(avance).getByText("Por debajo")).toBeInTheDocument();
    expect(within(avance).getByText(formatNumber(5))).toBeInTheDocument();
    expect(
      within(avance).getByRole("progressbar", { name: "Ventas sobre el punto de equilibrio" }),
    ).toHaveAttribute("aria-valuenow", "83");

    const variables = screen.getByRole("table", { name: "Costos variables del periodo" });
    expect(
      within(variables).getByRole("rowheader", { name: "Total variables" }).closest("tr"),
    ).toHaveTextContent(formatSoles(500));
    const fijos = screen.getByRole("table", { name: "Gastos fijos del periodo" });
    expect(
      within(fijos).getByRole("rowheader", { name: "Total fijos" }).closest("tr"),
    ).toHaveTextContent(formatSoles(600));
  });

  it("sin gastos fijos avisa y no inventa un punto de equilibrio", () => {
    mockPeriodo.mockReturnValue(datos(pedidos));
    renderPagina();
    expect(screen.getByText("Sin gastos fijos cargados en este periodo")).toBeInTheDocument();
    expect(within(kpi("Gastos fijos del periodo")).getByText("—")).toBeInTheDocument();
    expect(within(kpi("Punto de equilibrio")).getByText("—")).toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    // El simulador no rellena gastos fijos inventados.
    expect(screen.getByLabelText("Gastos fijos (S/)")).toHaveValue("");
    expect(screen.getByText("Completa los tres campos para calcular.")).toBeInTheDocument();
  });

  it("el simulador arranca con los datos del periodo, se puede tipear y una recarga no pisa lo editado", async () => {
    const user = userEvent.setup();
    mockPeriodo.mockReturnValue(
      datos(pedidos, { gastos: [gasto({})], envios: 50, publicidad: 120 }),
    );
    const { rerender } = renderPagina();

    const ticket = screen.getByLabelText("Ticket promedio (S/)");
    const variables = screen.getByLabelText("Costos variables (% de la venta)");
    const fijos = screen.getByLabelText("Gastos fijos (S/)");
    expect(ticket).toHaveValue("500.00");
    expect(variables).toHaveValue("50.00");
    expect(fijos).toHaveValue("600.00");

    const simulador = seccion("Simulador");
    // Con los datos del periodo da lo mismo que el punto de equilibrio: 1200 → 3 pedidos → ≈ 8 unidades (2,5 por pedido).
    expect(within(simulador).getByText(formatSoles(1200))).toBeInTheDocument();
    expect(within(simulador).getByText("3")).toBeInTheDocument();
    expect(within(simulador).getByText("≈ 8")).toBeInTheDocument();

    // Tipear libremente (con coma decimal), sin que el campo se reformatee.
    await user.clear(fijos);
    await user.type(fijos, "3000,5");
    expect(fijos).toHaveValue("3000,5");
    // 3000,5 ÷ 0,5 = 6001 → 13 pedidos de S/ 500.
    expect(within(simulador).getByText(formatSoles(6001))).toBeInTheDocument();
    expect(within(simulador).getByText("13")).toBeInTheDocument();

    // Llegan datos nuevos (refetch): el campo editado se respeta, los demás se actualizan.
    mockPeriodo.mockReturnValue(
      datos([...pedidos, { ...pedidos[0], id: "c" }], {
        gastos: [gasto({ monto: 900 })],
        envios: 50,
        publicidad: 120,
      }),
    );
    rerender(
      <TooltipProvider>
        <EquilibrioPage />
      </TooltipProvider>,
    );
    expect(screen.getByLabelText("Gastos fijos (S/)")).toHaveValue("3000,5");
    expect(screen.getByLabelText("Ticket promedio (S/)")).toHaveValue("533.33");

    // Volver a los datos del periodo descarta lo editado.
    await user.click(within(simulador).getByRole("button", { name: "Usar los datos del periodo" }));
    expect(screen.getByLabelText("Gastos fijos (S/)")).toHaveValue("900.00");
  });

  it("explica por qué no calcula con costos variables de 100 % o más", async () => {
    const user = userEvent.setup();
    mockPeriodo.mockReturnValue(datos(pedidos, { gastos: [gasto({})] }));
    renderPagina();
    const variables = screen.getByLabelText("Costos variables (% de la venta)");
    await user.clear(variables);
    await user.type(variables, "100");
    expect(screen.getByRole("alert")).toHaveTextContent("ninguna venta cubre los gastos fijos");
  });

  it("no revienta sin datos", () => {
    mockPeriodo.mockReturnValue(datos([]));
    renderPagina();
    expect(within(kpi("Margen de contribución")).getByText("—")).toBeInTheDocument();
    expect(within(kpi("Margen de seguridad")).getByText("—")).toBeInTheDocument();
    expect(screen.getByLabelText("Ticket promedio (S/)")).toHaveValue("");
  });
});
