import { render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  formatPercent,
  formatSoles,
  formatVeces,
} from "@/features/panel-control/shared/utils/format";
import type { IGastoOperativo } from "@/interfaces/IAdmin";
import type { MetasAnuales } from "../../_lib/metasStorage";
import type { PublicidadConectada } from "../../_lib/publicidad";
import { datosPeriodoDe } from "../../_lib/__tests__/servidor-fixtures";
import type { DatosPeriodo } from "../../_lib/useResultados";
import type { PedidoAdmin } from "../../_lib/ventas";
import ResumenAdminPage from "../page";

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

jest.mock("@/contexts/AdminPeriodContext", () => ({
  useAdminPeriod: () => ({ fromDate: "2026-11-01", toDate: "2026-11-30", setPeriod: jest.fn() }),
}));

const mockComparados = jest.fn();
jest.mock("../../_lib/useResultados", () => ({
  useAdminContexto: () => ({
    companyId: "c1",
    token: "t",
    storeIds: ["s1"],
    igvPct: 18,
    hoy: "2026-11-30",
  }),
  useResultadosComparados: (...args: unknown[]) => mockComparados(...args),
}));

const mockMetas = jest.fn();
jest.mock("../../_lib/metasStorage", () => ({
  ...jest.requireActual("../../_lib/metasStorage"),
  useMetasAnuales: (...args: unknown[]) => mockMetas(...args),
}));

const SIN_METAS: MetasAnuales = { ventasAnual: null, profitAnual: null, margenObjetivoPct: null };

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

const publicidadOk = (
  monto: number | null,
  extra: Partial<PublicidadConectada> = {},
): PublicidadConectada => ({
  estado: "ok",
  monto,
  porDia: new Map(),
  cobertura: "complete",
  diasFaltantes: 0,
  provisional: false,
  otrasMonedas: [],
  ...extra,
});

function datos(
  desde: string,
  hasta: string,
  pedidos: PedidoAdmin[],
  opciones: {
    gastos?: IGastoOperativo[];
    merma?: number;
    envios?: number;
    fleteConocido?: number;
    publicidad?: PublicidadConectada;
    cargando?: boolean;
    entregasSinHistorial?: number;
  } = {},
): DatosPeriodo {
  return datosPeriodoDe(desde, hasta, pedidos, {
    ...opciones,
    publicidad: opciones.publicidad ?? publicidadOk(0, { estado: "sin_cuentas" }),
    servidor: { calidad: { entregasSinHistorial: opciones.entregasSinHistorial ?? 0 } },
  });
}

const NOV = "2026-11-10T15:00:00Z";
const pedidosNoviembre: PedidoAdmin[] = [
  {
    id: "a",
    status: "ENTREGADO",
    grandTotal: 1180,
    channelFee: 50,
    created_at: NOV,
    items: [{ lineKind: "PRODUCT", quantity: 2, unitCost: 200 }],
    payments: [{ status: "PAID", amount: 1180 }],
  },
  // Venta sin costo cargado.
  {
    id: "b",
    status: "ENTREGADO",
    grandTotal: 590,
    created_at: NOV,
    items: [{ lineKind: "PRODUCT", quantity: 1 }],
  },
  // Adelanto que sí cuenta.
  {
    id: "c",
    status: "PENDIENTE",
    grandTotal: 300,
    created_at: NOV,
    payments: [{ status: "PAID", amount: 100 }],
  },
  // Pago pendiente: no es adelanto.
  {
    id: "c2",
    status: "EN_ENVIO",
    grandTotal: 300,
    created_at: NOV,
    payments: [{ status: "PENDING", amount: 40 }],
  },
  // Estos pagos no cuentan como adelanto.
  {
    id: "d",
    status: "INCOMPLETE",
    grandTotal: 80,
    created_at: NOV,
    payments: [{ status: "PAID", amount: 80 }],
  },
  {
    id: "e",
    status: "ANULADO",
    grandTotal: 50,
    created_at: NOV,
    payments: [{ status: "PAID", amount: 50 }],
  },
  {
    id: "f",
    status: "PENDIENTE",
    commercialStage: "LEAD",
    grandTotal: 70,
    created_at: NOV,
    payments: [{ status: "PAID", amount: 70 }],
  },
];

const OCT = "2026-10-10T15:00:00Z";
const pedidosOctubre: PedidoAdmin[] = [
  {
    id: "o1",
    status: "ENTREGADO",
    grandTotal: 885,
    created_at: OCT,
    items: [{ lineKind: "PRODUCT", quantity: 1, unitCost: 100 }],
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
      <ResumenAdminPage />
    </TooltipProvider>,
  );
}

function escenarioCompleto() {
  const actual = datos("2026-11-01", "2026-11-30", pedidosNoviembre, {
    gastos: [gasto({}), gasto({ id: "p", categoria: "PUBLICIDAD", monto: 60 })],
    merma: 30,
    envios: 50,
    publicidad: publicidadOk(100, { provisional: true }),
  });
  const anterior = datos("2026-10-01", "2026-10-31", pedidosOctubre, {
    gastos: [gasto({ mes: 10 })],
  });
  mockComparados.mockReturnValue({
    actual,
    anterior,
    rangoAnterior: { desde: "2026-10-01", hasta: "2026-10-31" },
  });
  return actual.resultados;
}

beforeEach(() => {
  mockComparados.mockReset();
  mockMetas.mockReset();
  mockMetas.mockReturnValue([SIN_METAS, jest.fn()]);
});

describe("Resumen de Administración", () => {
  it("arma la cascada con la cuenta única y sin IGV/IR ni comisión Powip", () => {
    const r = escenarioCompleto();
    // Ventas 1770 − costo 400 − merma 30 = 1340; − comisión 50 − envíos 50 − publicidad (100 + 60) = 1080;
    // − fijos 600 = 480.
    expect(r.utilidadBruta).toBe(1340);
    expect(r.contribucion).toBe(1080);
    expect(r.utilidadOperativa).toBe(480);

    renderPagina();
    const tabla = screen.getByRole("table", { name: "Estado de resultados del periodo" });
    const fila = (nombre: string) => {
      const tr = within(tabla)
        .getByRole("rowheader", { name: new RegExp(nombre) })
        .closest("tr");
      if (!tr) throw new Error(`No se encontró la fila ${nombre}`);
      return tr;
    };

    expect(within(fila("Ventas \\(con IGV\\)")).getByText(formatSoles(1770))).toBeInTheDocument();
    expect(within(fila("Ventas sin IGV")).getByText(formatSoles(1500))).toBeInTheDocument();
    expect(within(fila("IGV incluido")).getByText(formatSoles(270))).toBeInTheDocument();
    expect(within(fila("Costo de producto")).getByText(formatSoles(400))).toBeInTheDocument();
    expect(
      within(fila("Costo de producto")).getByText(/1 venta sin costo cargado/),
    ).toBeInTheDocument();
    expect(within(fila("Utilidad bruta")).getByText(formatSoles(1340))).toBeInTheDocument();
    expect(within(fila("Publicidad")).getByText(formatSoles(160))).toBeInTheDocument();
    expect(
      within(fila("Publicidad")).getByText(/Conectada S\/ 100 \+ Gastos › Publicidad S\/ 60/),
    ).toBeInTheDocument();
    expect(within(fila("Publicidad")).getByText(/incluye hoy/)).toBeInTheDocument();
    expect(within(fila("Contribución")).getByText(formatSoles(1080))).toBeInTheDocument();
    expect(
      within(fila("Gastos fijos")).getByText(/Gasto mensual × días del periodo ÷ días del mes/),
    ).toBeInTheDocument();
    expect(within(fila("Utilidad operativa")).getByText(formatSoles(480))).toBeInTheDocument();

    expect(screen.queryByText(/IGV \/ IR/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Powip/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/inversión manual/i)).not.toBeInTheDocument();
  });

  it("muestra KPIs con variación contra el mismo tramo del mes anterior", () => {
    escenarioCompleto();
    renderPagina();
    expect(screen.getByText("octubre 2026")).toBeInTheDocument();
    const ventas = screen.getByRole("region", { name: "Ventas" });
    expect(within(ventas).getByText(formatSoles(1770))).toBeInTheDocument();
    // 1770 vs 885 → +100 %.
    expect(within(ventas).getByText("▲ 100%")).toBeInTheDocument();
    const pedidos = screen.getByRole("region", { name: "Pedidos entregados" });
    expect(within(pedidos).getByText("2")).toBeInTheDocument();
    expect(
      within(pedidos).getByText(new RegExp(`Ticket promedio ${formatSoles(885)}`)),
    ).toBeInTheDocument();
    const operativa = screen.getByRole("region", { name: "Utilidad operativa" });
    expect(
      within(operativa).getByText(`Margen ${formatPercent(480 / 1770, 1)}`),
    ).toBeInTheDocument();
  });

  it("avisa las ventas sin costo y suma solo los adelantos de pedidos que todavía no son venta", () => {
    escenarioCompleto();
    renderPagina();
    expect(screen.getByText(/1 venta no tiene costo cargado/)).toBeInTheDocument();
    const adelantos = seccion("Adelantos de pedidos aún no entregados");
    expect(within(adelantos).getByText(formatSoles(100))).toBeInTheDocument();
    expect(within(adelantos).getByText(/^1 pedido ·/)).toBeInTheDocument();
  });

  it("los envíos son el flete por pedido, con su cobertura y la nota de las entregas sin historial", () => {
    mockComparados.mockReturnValue({
      actual: datos("2026-11-01", "2026-11-30", pedidosNoviembre, {
        envios: 30,
        fleteConocido: 1,
        entregasSinHistorial: 1,
      }),
      anterior: datos("2026-10-01", "2026-10-31", pedidosOctubre),
      rangoAnterior: { desde: "2026-10-01", hasta: "2026-10-31" },
    });
    renderPagina();
    const tabla = screen.getByRole("table", { name: "Estado de resultados del periodo" });
    const envios = within(tabla)
      .getByRole("rowheader", { name: /Envíos \(flete por pedido\)/ })
      .closest("tr") as HTMLElement;
    expect(within(envios).getByText(formatSoles(30))).toBeInTheDocument();
    // 1 de 2 entregas con flete: el resultado está sobreestimado.
    expect(
      within(envios).getByText(/Flete conocido en 1 de 2 entregas: el resto no suma envío/),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Shalom/)).not.toBeInTheDocument();
    expect(
      screen.getByText("1 venta no tiene registrado el día de entrega: se cuenta en el día en que se creó."),
    ).toBeInTheDocument();
  });

  it("pinta el semáforo con publicidad de una sola fuente", () => {
    escenarioCompleto();
    renderPagina();
    const semaforo = seccion(/Semáforo contra entrega/);
    // 160 ÷ 2 pedidos = S/ 80 → rojo; 1770 ÷ 160 = 11,1x → verde; margen 27,1 % → ámbar.
    expect(within(semaforo).getByText(formatSoles(80))).toBeInTheDocument();
    expect(within(semaforo).getByText(formatVeces(1770 / 160))).toBeInTheDocument();
    expect(within(semaforo).getByText(formatPercent(480 / 1770, 1))).toBeInTheDocument();
    expect(within(semaforo).getByText("2 indicadores en alerta")).toBeInTheDocument();
  });

  it("dice «Superado» solo si las ventas pasan el punto de equilibrio", () => {
    escenarioCompleto();
    renderPagina();
    const pe = seccion("Punto de equilibrio");
    expect(within(pe).getByText("Superado")).toBeInTheDocument();
    // 600 ÷ (1080 / 1770) = 983,33.
    expect(within(pe).getByText(formatSoles(600 / (1080 / 1770)))).toBeInTheDocument();
  });

  it("dice «Por debajo» cuando las ventas no cubren los gastos fijos", () => {
    const actual = datos("2026-11-01", "2026-11-30", pedidosNoviembre, {
      gastos: [gasto({ monto: 3000 })],
    });
    mockComparados.mockReturnValue({
      actual,
      anterior: datos("2026-10-01", "2026-10-31", []),
      rangoAnterior: { desde: "2026-10-01", hasta: "2026-10-31" },
    });
    renderPagina();
    const pe = seccion("Punto de equilibrio");
    expect(within(pe).getByText("Por debajo")).toBeInTheDocument();
    expect(within(pe).queryByText("Superado")).not.toBeInTheDocument();
  });

  it("compara contra la meta solo si está cargada", () => {
    escenarioCompleto();
    mockMetas.mockReturnValue([
      { ventasAnual: 36000, profitAnual: null, margenObjetivoPct: null },
      jest.fn(),
    ]);
    renderPagina();
    expect(mockMetas).toHaveBeenCalledWith("c1", 2026);
    const avance = seccion("Avance de noviembre");
    // Meta mensual 36000 ÷ 12 = 3000; vendido 1770.
    expect(
      within(avance).getByText(
        `${formatSoles(1770)} de ${formatSoles(3000)} (${formatPercent(1770 / 3000)})`,
      ),
    ).toBeInTheDocument();
    expect(within(avance).getByText(`Faltan ${formatSoles(1230)}`)).toBeInTheDocument();
  });

  it("no revienta sin datos y no inventa números", () => {
    mockComparados.mockReturnValue({
      actual: datos("2026-11-01", "2026-11-30", [], {
        publicidad: publicidadOk(null, { estado: "sin_permiso" }),
      }),
      anterior: datos("2026-10-01", "2026-10-31", []),
      rangoAnterior: { desde: "2026-10-01", hasta: "2026-10-31" },
    });
    renderPagina();
    expect(screen.getByText("Sin meta")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Resultados › Resumen anual" })).toHaveAttribute(
      "href",
      "/administracion/anual",
    );
    expect(screen.getByText("Sin datos suficientes")).toBeInTheDocument();
    expect(screen.getAllByText("Sin datos")).toHaveLength(3);
    expect(
      screen.getByText(/No tienes permiso para ver las cuentas conectadas/),
    ).toBeInTheDocument();
    expect(screen.getByText(/Sin gastos fijos cargados en el periodo/)).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("muestra el esqueleto mientras carga", () => {
    mockComparados.mockReturnValue({
      actual: datos("2026-11-01", "2026-11-30", [], { cargando: true }),
      anterior: datos("2026-10-01", "2026-10-31", [], { cargando: true }),
      rangoAnterior: { desde: "2026-10-01", hasta: "2026-10-31" },
    });
    renderPagina();
    expect(
      screen.getByRole("status", { name: "Cargando indicadores del periodo" }),
    ).toBeInTheDocument();
  });
});
