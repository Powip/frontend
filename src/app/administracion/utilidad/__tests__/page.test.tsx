import { render, screen, within } from "@testing-library/react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { formatPercent, formatSoles } from "@/features/panel-control/shared/utils/format";
import type { IGastoOperativo } from "@/interfaces/IAdmin";
import type { PublicidadConectada } from "../../_lib/publicidad";
import { calcularResultados, prorratearGastos } from "../../_lib/resultados";
import type { DatosPeriodo } from "../../_lib/useResultados";
import { type PedidoAdmin, resumirVentas } from "../../_lib/ventas";
import UtilidadPage from "../page";

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
  opciones: {
    gastos?: IGastoOperativo[];
    merma?: number;
    envios?: number;
    publicidad?: number | null;
  } = {},
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
    merma: { unidades: 0, costo: opciones.merma ?? 0 },
    envios: opciones.envios ?? 0,
    publicidad,
    resultados: calcularResultados({
      ventas,
      gastos,
      merma: opciones.merma ?? 0,
      envios: opciones.envios ?? 0,
      publicidadConectada: publicidad.monto,
      igvPct: 18,
    }),
  };
}

const NOV = "2026-11-10T15:00:00Z";
const pedidos: PedidoAdmin[] = [
  {
    id: "w1",
    status: "ENTREGADO",
    salesChannel: "WHATSAPP",
    grandTotal: 1000,
    channelFee: 0,
    created_at: NOV,
    items: [{ lineKind: "PRODUCT", quantity: 2, unitCost: 200 }],
  },
  {
    id: "f1",
    status: "ENTREGADO",
    salesChannel: "FALABELLA",
    grandTotal: 500,
    channelFee: 75,
    created_at: NOV,
    items: [{ lineKind: "PRODUCT", quantity: 1, unitCost: 250 }],
  },
  // Grafía distinta del mismo canal y sin costo cargado.
  {
    id: "w2",
    status: "ENTREGADO",
    salesChannel: "Whats App",
    grandTotal: 200,
    created_at: NOV,
    items: [{ lineKind: "PRODUCT", quantity: 1 }],
  },
  // No es venta: no entra a la tabla.
  { id: "p1", status: "PENDIENTE", salesChannel: "TIKTOK", grandTotal: 999, created_at: NOV },
];

function renderPagina() {
  return render(
    <TooltipProvider>
      <UtilidadPage />
    </TooltipProvider>,
  );
}

beforeEach(() => mockPeriodo.mockReset());

describe("Utilidad y margen", () => {
  it("muestra los márgenes como fracción de las ventas", () => {
    const d = datos(pedidos, {
      gastos: [gasto({}), gasto({ id: "h", categoria: "HERRAMIENTAS", monto: 100 })],
      merma: 20,
      envios: 60,
      publicidad: 90,
    });
    mockPeriodo.mockReturnValue(d);
    renderPagina();
    const r = d.resultados;
    // Ventas 1700; bruta 1700 − 650 − 20 = 1030; contribución 1030 − 75 − 60 − 90 = 805; operativa 805 − 700 = 105.
    expect(r.utilidadBruta).toBe(1030);
    expect(r.contribucion).toBe(805);
    expect(r.utilidadOperativa).toBe(105);
    expect(
      within(screen.getByRole("region", { name: "Margen bruto" })).getByText(
        formatPercent(1030 / 1700, 1),
      ),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole("region", { name: "Margen de contribución" })).getByText(
        formatPercent(805 / 1700, 1),
      ),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole("region", { name: "Margen operativo" })).getByText(
        formatPercent(105 / 1700, 1),
      ),
    ).toBeInTheDocument();
    // No repite la cascada de Resumen.
    expect(
      screen.queryByRole("table", { name: "Estado de resultados del periodo" }),
    ).not.toBeInTheDocument();
  });

  it("arma la estructura de costos con los fijos por categoría", () => {
    mockPeriodo.mockReturnValue(
      datos(pedidos, {
        gastos: [gasto({}), gasto({ id: "h", categoria: "HERRAMIENTAS", monto: 100 })],
        envios: 60,
        publicidad: 90,
      }),
    );
    renderPagina();
    const variables = screen.getByRole("list", {
      name: "Costos variables como porcentaje de las ventas",
    });
    expect(within(variables).getByText("Costo de producto")).toBeInTheDocument();
    expect(within(variables).getByText("Publicidad")).toBeInTheDocument();
    const fijos = screen.getByRole("list", {
      name: "Gastos fijos por categoría como porcentaje de las ventas",
    });
    expect(within(fijos).getByText("Planilla")).toBeInTheDocument();
    expect(within(fijos).getByText("Herramientas")).toBeInTheDocument();
    // Sin monto, la categoría no se lista.
    expect(within(fijos).queryByText("Courier propio")).not.toBeInTheDocument();
    expect(within(fijos).getByText(formatSoles(600))).toBeInTheDocument();
  });

  it("calcula el margen por canal con los canales de los datos", () => {
    mockPeriodo.mockReturnValue(datos(pedidos));
    renderPagina();
    const tabla = screen.getByRole("table", { name: "Margen por canal" });
    const filas = within(tabla).getAllByRole("row");
    // Encabezado + WhatsApp + Falabella + total.
    expect(filas).toHaveLength(4);

    const whatsapp = filas[1];
    expect(within(whatsapp).getByText("WhatsApp")).toBeInTheDocument();
    expect(within(whatsapp).getByText(formatSoles(1200))).toBeInTheDocument();
    expect(within(whatsapp).getByText("(1 sin costo)")).toBeInTheDocument();
    // (1200 − 400) ÷ 1200, con «≤» porque hay una venta sin costo.
    expect(within(whatsapp).getAllByText(`≤ ${formatPercent(800 / 1200, 1)}`)).toHaveLength(2);

    const falabella = filas[2];
    expect(within(falabella).getByText("Falabella")).toBeInTheDocument();
    expect(within(falabella).getByText(formatPercent(250 / 500, 1))).toBeInTheDocument();
    expect(within(falabella).getByText(formatPercent(175 / 500, 1))).toBeInTheDocument();

    expect(screen.queryByText("TikTok")).not.toBeInTheDocument();
    expect(screen.getByText(/no se reparten por canal/)).toBeInTheDocument();
    expect(screen.getByText(/1 venta no tiene costo cargado/)).toBeInTheDocument();
  });

  it("no revienta sin datos", () => {
    mockPeriodo.mockReturnValue(datos([]));
    renderPagina();
    expect(screen.getByText("Sin ventas en el periodo")).toBeInTheDocument();
    expect(screen.getByText(/Sin gastos fijos cargados en el periodo/)).toBeInTheDocument();
    expect(
      within(screen.getByRole("region", { name: "Margen bruto" })).getByText("—"),
    ).toBeInTheDocument();
  });
});
