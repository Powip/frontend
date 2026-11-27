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

  it("muestra lo vendido en el periodo que todavía no se entregó (ventas en curso), aparte de las ventas", () => {
    escenarioCompleto();
    renderPagina();
    // En curso: c (300) + c2 (300) + d incompleto (80); no los anulados ni los leads.
    const enCurso = seccion("Ventas en curso (sin entregar)");
    expect(within(enCurso).getByText(formatSoles(680))).toBeInTheDocument();
    expect(within(enCurso).getByText(/^3 pedidos creados en el periodo/)).toBeInTheDocument();
    expect(within(enCurso).getByText(/No suman a las ventas ni a la utilidad/)).toBeInTheDocument();
  });

  it("sin entregas pero con pedidos en curso, el aviso dice cuánto hay en curso", () => {
    mockComparados.mockReturnValue({
      actual: datos("2026-11-01", "2026-11-30", pedidosNoviembre.filter((p) => p.status !== "ENTREGADO")),
      anterior: datos("2026-10-01", "2026-10-31", []),
      rangoAnterior: { desde: "2026-10-01", hasta: "2026-10-31" },
    });
    renderPagina();
    expect(screen.getByText("Todavía no hay ventas entregadas en el periodo")).toBeInTheDocument();
    expect(screen.getByText(new RegExp(`3 pedidos en curso por ${formatSoles(680).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`))).toBeInTheDocument();
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
    // 160 ÷ 2 pedidos = S/ 80 = 9 % del ticket (885) → verde; 1770 ÷ 160 = 11,1x → verde; margen 27,1 % sin meta
    // (referencia 20–28 %) → ámbar.
    expect(within(semaforo).getByText(formatSoles(80))).toBeInTheDocument();
    expect(within(semaforo).getByText("· 9 % del ticket")).toBeInTheDocument();
    expect(within(semaforo).getByText(formatVeces(1770 / 160))).toBeInTheDocument();
    expect(within(semaforo).getByText(formatPercent(480 / 1770, 1))).toBeInTheDocument();
    expect(within(semaforo).getByText("1 indicador en alerta")).toBeInTheDocument();
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

// ---- Semáforo contra entrega: umbrales (FEAT-34 punto 5) ---------------------------------------

const RANGO_ANTERIOR = { desde: "2026-10-01", hasta: "2026-10-31" };

/** Venta entregada de `total` con el costo de su única línea (`costo` 0 = sin costo; `precioLista` la marca dudosa). */
const venta = (id: string, total: number, costo: number, precioLista?: number): PedidoAdmin => ({
  id,
  status: "ENTREGADO",
  grandTotal: total,
  created_at: NOV,
  items: [{ lineKind: "PRODUCT", quantity: 1, unitCost: costo || undefined, unitPrice: precioLista }],
});

function renderSemaforo(
  pedidos: PedidoAdmin[],
  opciones: { publicidad?: number; metaMargenPct?: number | null; gastos?: IGastoOperativo[] } = {},
) {
  mockComparados.mockReturnValue({
    actual: datos("2026-11-01", "2026-11-30", pedidos, {
      publicidad: opciones.publicidad ? publicidadOk(opciones.publicidad) : undefined,
      gastos: opciones.gastos,
    }),
    anterior: datos("2026-10-01", "2026-10-31", []),
    rangoAnterior: RANGO_ANTERIOR,
  });
  mockMetas.mockReturnValue([
    { ...SIN_METAS, margenObjetivoPct: opciones.metaMargenPct ?? null },
    jest.fn(),
  ]);
  return renderPagina();
}

function indicador(nombre: string): HTMLElement {
  const fila = screen.getByText(nombre).closest("li");
  if (!fila) throw new Error(`No se encontró el indicador ${nombre}`);
  return fila;
}

describe("Semáforo contra entrega: margen operativo", () => {
  // Una venta de S/ 1.000 sin otros gastos: margen = (1.000 − costo) ÷ 1.000.
  it.each([
    ["en la meta exacta", 800, "Bien"],
    ["a una décima de la meta", 801, "Atención"],
    ["8 puntos por debajo (borde del ámbar)", 880, "Atención"],
    ["más de 8 puntos por debajo", 881, "Alerta"],
  ])("con meta de 20 %%: %s", (_caso, costo, etiqueta) => {
    renderSemaforo([venta("a", 1000, costo)], { metaMargenPct: 20 });
    const fila = indicador("Margen operativo");
    expect(within(fila).getByText(etiqueta)).toBeInTheDocument();
    expect(within(fila).getByText("Verde ≥ 20% · ámbar 12–20% · rojo < 12%")).toBeInTheDocument();
    expect(within(fila).queryByRole("link")).not.toBeInTheDocument();
  });

  it("con meta decimal muestra los umbrales con coma", () => {
    renderSemaforo([venta("a", 1000, 700)], { metaMargenPct: 22.5 });
    expect(
      within(indicador("Margen operativo")).getByText("Verde ≥ 22,5% · ámbar 14,5–22,5% · rojo < 14,5%"),
    ).toBeInTheDocument();
  });

  it.each([
    ["sobre el 28 %", 719, "Bien"],
    ["justo en el 28 % (ámbar)", 720, "Atención"],
    ["justo en el 20 % (ámbar)", 800, "Atención"],
    ["bajo el 20 %", 801, "Alerta"],
  ])("sin meta usa la referencia general: %s", (_caso, costo, etiqueta) => {
    renderSemaforo([venta("a", 1000, costo)]);
    const fila = indicador("Margen operativo");
    expect(within(fila).getByText(etiqueta)).toBeInTheDocument();
    expect(
      within(fila).getByText("Referencia general (28 % / 20 %) · carga tu meta de margen"),
    ).toBeInTheDocument();
    expect(within(fila).getByRole("link", { name: "Cargar meta de margen →" })).toHaveAttribute(
      "href",
      "/administracion/anual",
    );
  });
});

describe("Semáforo contra entrega: retorno de publicidad", () => {
  // Una venta de S/ 1.000: retorno = 1.000 ÷ publicidad. Meta del Panel: 4x, tolerancia 20 % (cerca desde 3,2x).
  it.each([
    ["en la meta (4x)", 250, "4.0x", "Bien"],
    ["sobre la meta", 100, "10.0x", "Bien"],
    ["en el borde de cerca (3,2x)", 312.5, "3.2x", "Atención"],
    ["bajo el borde de cerca", 313, "3.2x", "Alerta"],
  ])("%s", (_caso, publicidad, valor, etiqueta) => {
    renderSemaforo([venta("a", 1000, 500)], { publicidad });
    const fila = indicador("Retorno de publicidad");
    expect(within(fila).getByText(valor)).toBeInTheDocument();
    expect(within(fila).getByText(etiqueta)).toBeInTheDocument();
    expect(within(fila).getByText("Verde ≥ 4x · ámbar 3,2–4x · rojo < 3,2x")).toBeInTheDocument();
  });

  it("sin publicidad no hay retorno que evaluar", () => {
    renderSemaforo([venta("a", 1000, 500)]);
    const fila = indicador("Retorno de publicidad");
    expect(within(fila).getByText("Sin datos")).toBeInTheDocument();
    expect(within(fila).getByText("Sin publicidad registrada en el periodo")).toBeInTheDocument();
  });
});

describe("Semáforo contra entrega: costo de publicidad por venta", () => {
  // Una venta de S/ 1.000: el costo por venta es la publicidad entera y el ticket promedio S/ 1.000.
  it.each([
    ["bajo el 11 %", 109, "Bien", "· 10,9 % del ticket"],
    ["justo en el 11 % (ámbar)", 110, "Atención", "· 11 % del ticket"],
    ["justo en el 14 % (ámbar)", 140, "Atención", "· 14 % del ticket"],
    ["sobre el 14 %", 141, "Alerta", "· 14,1 % del ticket"],
  ])("%s", (_caso, publicidad, etiqueta, extra) => {
    renderSemaforo([venta("a", 1000, 500)], { publicidad });
    const fila = indicador("Costo de publicidad por venta");
    expect(within(fila).getByText(formatSoles(publicidad))).toBeInTheDocument();
    expect(within(fila).getByText(extra)).toBeInTheDocument();
    expect(within(fila).getByText(etiqueta)).toBeInTheDocument();
    expect(
      within(fila).getByText("Verde < 11 % del ticket · ámbar 11–14 % · rojo > 14 %"),
    ).toBeInTheDocument();
  });

  it.each([
    // El % se redondea a 1 decimal, que es lo que se muestra: el nivel sale del mismo valor que el texto.
    ["10,96 % se ve «11 %» y es ámbar, no verde", 109.6, "S/ 110", "· 11 % del ticket", "Atención"],
    ["14,04 % se ve «14 %» y es ámbar, no rojo", 140.4, "S/ 140", "· 14 % del ticket", "Atención"],
    ["10,94 % se ve «10,9 %» y es verde", 109.4, "S/ 109", "· 10,9 % del ticket", "Bien"],
    ["14,06 % se ve «14,1 %» y es rojo", 140.6, "S/ 141", "· 14,1 % del ticket", "Alerta"],
  ])("el nivel y el texto salen del mismo valor redondeado: %s", (_caso, publicidad, soles, extra, etiqueta) => {
    renderSemaforo([venta("a", 1000, 500)], { publicidad });
    const fila = indicador("Costo de publicidad por venta");
    expect(within(fila).getByText(soles)).toBeInTheDocument();
    expect(within(fila).getByText(extra)).toBeInTheDocument();
    expect(within(fila).getByText(etiqueta)).toBeInTheDocument();
  });

  it.each([
    // Con 3 pedidos, (publicidad ÷ 3) ÷ (ventas ÷ 3) da 0,10999… y 0,14000…04: sin redondear, el 11 % exacto caía en
    // verde y el 14 % exacto en rojo.
    ["11 % exacto con 3 pedidos", [100, 100, 200], 44, "· 11 % del ticket"],
    ["14 % exacto con 3 pedidos", [300, 300, 370], 135.8, "· 14 % del ticket"],
  ])("sin ruido de coma flotante en los bordes: %s", (_caso, totales, publicidad, extra) => {
    renderSemaforo(
      totales.map((total, i) => venta(`v${i}`, total, 1)),
      { publicidad },
    );
    const fila = indicador("Costo de publicidad por venta");
    expect(within(fila).getByText(extra)).toBeInTheDocument();
    expect(within(fila).getByText("Atención")).toBeInTheDocument();
    expect(within(fila).queryByText("Bien")).not.toBeInTheDocument();
    expect(within(fila).queryByText("Alerta")).not.toBeInTheDocument();
  });

  it("reparte la publicidad entre los pedidos y la compara con el ticket promedio", () => {
    // 200 ÷ 2 pedidos = S/ 100 por venta; ticket promedio S/ 500 → 20 %.
    renderSemaforo([venta("a", 500, 100), venta("b", 500, 100)], { publicidad: 200 });
    const fila = indicador("Costo de publicidad por venta");
    expect(within(fila).getByText(formatSoles(100))).toBeInTheDocument();
    expect(within(fila).getByText("· 20 % del ticket")).toBeInTheDocument();
    expect(within(fila).getByText("Alerta")).toBeInTheDocument();
  });

  it("con ticket promedio 0 queda sin datos (no divide por cero)", () => {
    renderSemaforo([venta("a", 0, 0)], { publicidad: 50 });
    const fila = indicador("Costo de publicidad por venta");
    expect(within(fila).getByText("Sin datos")).toBeInTheDocument();
    expect(within(fila).queryByText(/^· .* del ticket$/)).not.toBeInTheDocument();
  });

  it("sin publicidad queda sin datos", () => {
    renderSemaforo([venta("a", 1000, 500)]);
    const fila = indicador("Costo de publicidad por venta");
    expect(within(fila).getByText("Sin datos")).toBeInTheDocument();
    expect(within(fila).queryByText(/^· .* del ticket$/)).not.toBeInTheDocument();
  });
});

describe("Semáforo contra entrega: costos dudosos", () => {
  const AYUDA = "Hay ventas con costo igual o mayor que el precio: revisa los costos en Productos";
  /** 1 venta dudosa (costo = precio de lista) y `normales` ventas de S/ 100 con costo `costo` (sin precio de lista). */
  const conDudosa = (normales: number, costo: number, sinCosto = 0): PedidoAdmin[] => [
    venta("dudosa", 100, 100, 100),
    ...Array.from({ length: normales }, (_, i) => venta(`n${i}`, 100, costo)),
    ...Array.from({ length: sinCosto }, (_, i) => venta(`s${i}`, 100, 0)),
  ];

  it("con el 10 % de las ventas dudosas y el margen en rojo pide revisar los costos", () => {
    // 10 ventas con costo, 1 dudosa (10 %): margen (1.000 − 100 − 9 × 90) ÷ 1.000 = 9 % → rojo → ámbar.
    renderSemaforo(conDudosa(9, 90));
    const fila = indicador("Margen operativo");
    expect(within(fila).getByText("Revisar costos")).toBeInTheDocument();
    expect(within(fila).queryByText("Alerta")).not.toBeInTheDocument();
    expect(within(fila).queryByText("Atención")).not.toBeInTheDocument();
    expect(within(fila).getByText(AYUDA)).toBeInTheDocument();
    expect(within(fila).getByRole("link", { name: "Ir a Productos →" })).toHaveAttribute(
      "href",
      "/productos",
    );
    expect(within(fila).queryByRole("link", { name: /Cargar meta/ })).not.toBeInTheDocument();
    // El indicador sigue contando como en alerta (ámbar) en el resumen del semáforo.
    expect(screen.getByText("1 indicador en alerta")).toBeInTheDocument();
  });

  it("también con meta de margen cargada", () => {
    renderSemaforo(conDudosa(9, 90), { metaMargenPct: 30 });
    expect(within(indicador("Margen operativo")).getByText("Revisar costos")).toBeInTheDocument();
  });

  it("el porcentaje es sobre las ventas con costo, no sobre todas", () => {
    // 11 ventas: 2 sin costo, 9 con costo y 1 dudosa → 1 de 9 = 11 % (sobre las 11 sería 9 %).
    // Margen (1.100 − 100 − 8 × 99) ÷ 1.100 = 18,9 % → rojo → «Revisar costos».
    renderSemaforo(conDudosa(8, 99, 2));
    expect(within(indicador("Margen operativo")).getByText("Revisar costos")).toBeInTheDocument();
  });

  it("con menos del 10 % de ventas dudosas el margen en rojo sigue en rojo", () => {
    // 11 ventas con costo, 1 dudosa (9,1 %): margen (1.100 − 100 − 10 × 95) ÷ 1.100 = 4,5 % → rojo.
    renderSemaforo(conDudosa(10, 95));
    const fila = indicador("Margen operativo");
    expect(within(fila).getByText("Alerta")).toBeInTheDocument();
    expect(within(fila).queryByText("Revisar costos")).not.toBeInTheDocument();
    expect(within(fila).queryByText(AYUDA)).not.toBeInTheDocument();
    expect(within(fila).queryByRole("link", { name: "Ir a Productos →" })).not.toBeInTheDocument();
  });

  it("sin ventas con costo no hay dudosos: el margen en rojo sigue en rojo", () => {
    // Todas las ventas sin costo cargado (0 ventas con costo, 0 dudosas) y el margen en rojo por los gastos fijos:
    // sin la guarda de «ventas con costo > 0», 0 × 10 ≥ 0 activaría «Revisar costos».
    renderSemaforo([venta("a", 1000, 0), venta("b", 1000, 0)], { gastos: [gasto({ monto: 3000 })] });
    const fila = indicador("Margen operativo");
    expect(within(fila).getByText("Alerta")).toBeInTheDocument();
    expect(within(fila).queryByText("Revisar costos")).not.toBeInTheDocument();
    expect(within(fila).queryByText(AYUDA)).not.toBeInTheDocument();
    expect(within(fila).queryByRole("link", { name: "Ir a Productos →" })).not.toBeInTheDocument();
  });

  it("con costos dudosos pero margen en ámbar o verde no cambia nada", () => {
    // 10 ventas, 1 dudosa (10 %). Margen (1.000 − 100 − 9 × 70) ÷ 1.000 = 27 % → ámbar (sin meta).
    const { unmount } = renderSemaforo(conDudosa(9, 70));
    let fila = indicador("Margen operativo");
    expect(within(fila).getByText("Atención")).toBeInTheDocument();
    expect(within(fila).queryByText("Revisar costos")).not.toBeInTheDocument();
    expect(within(fila).queryByText(AYUDA)).not.toBeInTheDocument();
    unmount();

    // Margen (1.000 − 100 − 9 × 60) ÷ 1.000 = 36 % → verde.
    renderSemaforo(conDudosa(9, 60));
    fila = indicador("Margen operativo");
    expect(within(fila).getByText("Bien")).toBeInTheDocument();
    expect(within(fila).queryByText("Revisar costos")).not.toBeInTheDocument();
  });
});
