import { fireEvent, render, screen, within } from "@testing-library/react";
import { useAdminPeriod } from "@/contexts/AdminPeriodContext";
import { formatSoles, formatSolesDecimales } from "@/features/panel-control/shared/utils/format";
import type { IGastoOperativo } from "@/interfaces/IAdmin";
import { METAS_VACIAS, useMetasAnuales } from "../../_lib/metasStorage";
import type { EstadoPublicidad, PublicidadConectada } from "../../_lib/publicidad";
import { calcularResultados, prorratearGastos } from "../../_lib/resultados";
import {
  type DatosPeriodo,
  useAdminContexto,
  usePedidosEnTransito,
  useResultadosPeriodo,
} from "../../_lib/useResultados";
import { type PedidoAdmin, resumirVentas } from "../../_lib/ventas";
import ReporteRapidoPage from "../page";

jest.mock("@/contexts/AdminPeriodContext", () => ({ useAdminPeriod: jest.fn() }));
jest.mock("../../_lib/useResultados", () => ({
  useAdminContexto: jest.fn(),
  useResultadosPeriodo: jest.fn(),
  usePedidosEnTransito: jest.fn(),
}));
jest.mock("../../_lib/metasStorage", () => ({
  ...jest.requireActual("../../_lib/metasStorage"),
  useMetasAnuales: jest.fn(),
}));
jest.mock("@/components/advertising/AdvertisingBusinessMetricsPanel", () => ({
  AdvertisingBusinessMetricsPanel: ({ from, to }: { from: string; to: string }) =>
    jest.requireActual<typeof import("react")>("react").createElement("div", { "data-testid": "publicidad-modulo" }, `${from}|${to}`),
}));
jest.mock("@tanstack/react-query", () => ({
  useQuery: jest.fn(() => ({ data: { collections: [] }, isError: false, isPending: false })),
}));
jest.mock("@/services/courierSettlementsService", () => ({
  getCourierSettlements: jest.fn(),
  settlementMoney: (monto: number, moneda: string) => `${moneda} ${monto.toFixed(2)}`,
}));
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

const HOY = "2026-11-26";

const pedido = (p: Partial<PedidoAdmin>): PedidoAdmin => ({
  status: "ENTREGADO",
  commercialStage: "SALE",
  created_at: "2026-11-10T15:00:00Z",
  ...p,
});

const PEDIDOS: PedidoAdmin[] = [
  pedido({ id: "a", grandTotal: 1000, salesChannel: "WHATSAPP", items: [{ quantity: 2, unitCost: 200 }] }),
  pedido({ id: "b", grandTotal: 500, channelFee: 25, salesChannel: "WEB", items: [{ quantity: 1, unitCost: 0 }] }),
  pedido({ id: "c", status: "PENDIENTE", grandTotal: 900, items: [{ quantity: 1, unitCost: 100 }] }),
];

const gasto = (categoria: IGastoOperativo["categoria"], monto: number): IGastoOperativo => ({
  id: categoria,
  company_id: "c1",
  categoria,
  descripcion: null,
  monto,
  mes: 11,
  anio: 2026,
});

function armarDatos(
  desde: string,
  hasta: string,
  opciones: {
    pedidos?: PedidoAdmin[];
    gastos?: IGastoOperativo[];
    envios?: number;
    conectada?: number;
    estado?: EstadoPublicidad;
    cargando?: boolean;
  } = {},
): DatosPeriodo {
  const pedidos = opciones.pedidos ?? PEDIDOS;
  const gastosCrudos = opciones.gastos ?? [gasto("PLANILLA", 300), gasto("PUBLICIDAD", 300)];
  const envios = opciones.envios ?? 60;
  const estado = opciones.estado ?? "ok";
  const publicidad: PublicidadConectada = {
    estado,
    monto: estado === "ok" ? (opciones.conectada ?? 140) : null,
    porDia: new Map(),
    cobertura: null,
    diasFaltantes: 0,
    provisional: false,
    otrasMonedas: [],
  };
  const ventas = resumirVentas(pedidos);
  const gastos = prorratearGastos(gastosCrudos, desde, hasta);
  return {
    desde,
    hasta,
    cargando: opciones.cargando ?? false,
    error: null,
    pedidos,
    ventas,
    gastos,
    gastosCrudos,
    merma: { unidades: 0, costo: 0 },
    envios,
    publicidad,
    resultados: calcularResultados({
      ventas,
      gastos,
      merma: 0,
      envios,
      publicidadConectada: publicidad.monto,
      igvPct: 18,
    }),
  };
}

function preparar(
  desde: string,
  hasta: string,
  opciones: Parameters<typeof armarDatos>[2] = {},
  metas = { ventasAnual: 24000, profitAnual: null, margenObjetivoPct: null },
) {
  jest.mocked(useAdminPeriod).mockReturnValue({ fromDate: desde, toDate: hasta, setPeriod: jest.fn() });
  jest.mocked(useAdminContexto).mockReturnValue({ companyId: "c1", token: "t", storeIds: [], igvPct: 18, hoy: HOY });
  jest.mocked(useResultadosPeriodo).mockReturnValue(armarDatos(desde, hasta, opciones));
  jest.mocked(useMetasAnuales).mockReturnValue([metas, jest.fn()]);
  jest.mocked(usePedidosEnTransito).mockReturnValue({
    cargando: false,
    error: null,
    desde: "2026-08-29",
    hasta: HOY,
    saldo: 500,
    pedidos: [
      pedido({ id: "t1", status: "EN_ENVIO", grandTotal: 200, created_at: "2026-11-20T15:00:00Z" }),
      pedido({ id: "t2", status: "ASIGNADO_A_GUIA", grandTotal: 100, created_at: "2026-11-25T15:00:00Z" }),
      pedido({
        id: "t3",
        status: "DESPACHADO",
        grandTotal: 300,
        payments: [{ status: "PAID", amount: 100 }],
        created_at: "2026-09-01T15:00:00Z",
      }),
    ],
  });
}

const kpi = (nombre: string) => screen.getByRole("region", { name: nombre });
const parrafoCon = (texto: string) =>
  screen.getByText((_, el) => el?.tagName === "P" && (el.textContent ?? "").includes(texto));

// Ventas 1.500 − costo 400 − comisiones 25 − envíos 60 − publicidad (140 conectada + 260 de Gastos) − fijos 260 = 355
// (los gastos de noviembre se reparten 26/30 del 1 al 26).
const UTILIDAD = 355;

afterEach(() => jest.clearAllMocks());

describe("Reporte rápido", () => {
  it("muestra la utilidad operativa de la cuenta compartida (no una ganancia propia)", () => {
    preparar("2026-11-01", HOY);
    render(<ReporteRapidoPage />);

    expect(within(kpi("Ventas")).getByText(formatSoles(1500))).toBeInTheDocument();
    expect(within(kpi("Ventas")).getByText("2 pedidos · 3 unidades")).toBeInTheDocument();
    expect(within(kpi("Costo de producto")).getByText(formatSoles(400))).toBeInTheDocument();
    expect(within(kpi("Publicidad")).getByText(formatSoles(400))).toBeInTheDocument();
    expect(within(kpi("Envíos")).getByText(formatSoles(60))).toBeInTheDocument();
    expect(within(kpi("Gastos fijos")).getByText(formatSoles(260))).toBeInTheDocument();
    expect(within(kpi("Utilidad operativa")).getByText(formatSoles(UTILIDAD))).toBeInTheDocument();

    const cascada = screen.getByRole("table", { name: "Reporte de 1–26 nov 2026" });
    const fila = within(cascada).getByRole("row", { name: /Utilidad operativa/ });
    expect(within(fila).getByText(formatSoles(UTILIDAD))).toBeInTheDocument();
    expect(screen.queryByText(/GANANCIA/)).not.toBeInTheDocument();
    // AvisoCostos: la venta de la web no tiene costo.
    expect(screen.getByText(/1 venta no tiene costo cargado/)).toBeInTheDocument();
  });

  it("proyecta el mes en curso al ritmo diario con la misma cuenta y compara con la meta del mes", () => {
    preparar("2026-11-01", HOY);
    render(<ReporteRapidoPage />);

    expect(screen.getByRole("heading", { name: "Proyección del mes" })).toBeInTheDocument();
    expect(screen.getByText(formatSoles((1500 * 30) / 26))).toBeInTheDocument();
    expect(screen.getByText(formatSoles((UTILIDAD * 30) / 26))).toBeInTheDocument();
    // Meta anual 24.000 → 2.000 en el mes; la de utilidad no está cargada.
    expect(screen.getByText(`${formatSoles((1500 * 30) / 26)} de ${formatSoles(2000)} ·`, { exact: false })).toBeInTheDocument();
    expect(screen.getByText("Sin meta")).toBeInTheDocument();
    expect(useMetasAnuales).toHaveBeenCalledWith("c1", 2026);
  });

  it("sin metas dice «Sin meta» y no inventa números; usa las metas del año del periodo", () => {
    preparar("2025-12-01", "2025-12-31", { gastos: [] }, METAS_VACIAS);
    render(<ReporteRapidoPage />);

    expect(useMetasAnuales).toHaveBeenCalledWith("c1", 2025);
    expect(screen.getByRole("heading", { name: "Meta del periodo" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Proyección del mes" })).not.toBeInTheDocument();
    expect(screen.getAllByText("Sin meta")).toHaveLength(2);
    expect(screen.getByRole("link", { name: "Resultados › Resumen anual" })).toBeInTheDocument();
  });

  it("muestra el saldo contra entrega en calle de los últimos 90 días, con todos los estados", () => {
    preparar("2026-11-01", HOY);
    render(<ReporteRapidoPage />);

    expect(screen.getByText(/Pedidos en calle de los últimos 90 días/)).toBeInTheDocument();
    const lista = screen.getByRole("list", { name: "Pedidos en calle por estado" });
    expect(within(lista).getByText("En envío")).toBeInTheDocument();
    expect(within(lista).getByText("Con guía asignada")).toBeInTheDocument();
    const enEnvio = within(lista).getByText("En envío").closest("li") as HTMLElement;
    expect(within(enEnvio).getByText(`1 · ${formatSoles(200)}`)).toBeInTheDocument();
    const conGuia = within(lista).getByText("Con guía asignada").closest("li") as HTMLElement;
    expect(within(conGuia).getByText(`1 · ${formatSoles(100)}`)).toBeInTheDocument();
    expect(screen.getAllByText(formatSoles(500)).length).toBeGreaterThan(0);
    // El despachado de setiembre lleva más de 30 días en calle.
    expect(screen.getByText(/1 pedido sigue en calle después de 30 días/)).toBeInTheDocument();
  });

  it("simulador: con todo en cero da la utilidad real y usa el envío por pedido del periodo", () => {
    preparar("2026-11-01", HOY);
    render(<ReporteRapidoPage />);

    const estimada = screen.getByText("Utilidad operativa estimada").parentElement as HTMLElement;
    expect(within(estimada).getByText(formatSoles(UTILIDAD))).toBeInTheDocument();
    expect(parrafoCon(`envío ${formatSolesDecimales(30)} por pedido`)).toBeInTheDocument();
    expect(screen.getByLabelText(/por cada 10 % más de publicidad/)).toHaveValue(4);

    // +10 % de precio: ventas 1.650, comisiones 27,5, sin doble conteo de publicidad → 502,5.
    fireEvent.change(screen.getByLabelText(/Precio de venta/), { target: { value: "10" } });
    expect(within(estimada).getByText(formatSoles(502.5))).toBeInTheDocument();
  });

  it("publicidad del módulo: corta en ayer cuando el periodo llega a hoy", () => {
    preparar("2026-11-01", HOY);
    render(<ReporteRapidoPage />);
    expect(screen.getByTestId("publicidad-modulo")).toHaveTextContent("2026-11-01|2026-11-25");
    expect(screen.getByText(/Llega hasta ayer/)).toBeInTheDocument();
  });

  it("publicidad del módulo: con un periodo cerrado pasa el rango tal cual", () => {
    preparar("2026-10-01", "2026-10-31", { gastos: [] });
    render(<ReporteRapidoPage />);
    expect(screen.getByTestId("publicidad-modulo")).toHaveTextContent("2026-10-01|2026-10-31");
    expect(screen.queryByText(/Llega hasta ayer/)).not.toBeInTheDocument();
  });

  it("publicidad del módulo: con «Hoy» no se monta y explica por qué", () => {
    preparar(HOY, HOY);
    render(<ReporteRapidoPage />);
    expect(screen.queryByTestId("publicidad-modulo")).not.toBeInTheDocument();
    expect(
      screen.getByText("Los cocientes de publicidad salen con días cerrados: elige un periodo que termine ayer."),
    ).toBeInTheDocument();
  });

  it("publicidad del módulo: sin permiso no se monta ni muestra una alerta roja", () => {
    preparar("2026-10-01", "2026-10-31", { estado: "sin_permiso" });
    render(<ReporteRapidoPage />);
    expect(screen.queryByTestId("publicidad-modulo")).not.toBeInTheDocument();
    expect(screen.getByText("No tienes permiso para ver la publicidad de la empresa.")).toBeInTheDocument();
    const alertasPublicidad = screen
      .queryAllByRole("alert")
      .filter((el) => /publicidad|permiso/i.test(el.textContent ?? ""));
    expect(alertasPublicidad).toHaveLength(0);
  });

  it("no revienta sin datos ni mientras carga", () => {
    preparar("2026-11-01", HOY, { pedidos: [], gastos: [], envios: 0, conectada: 0 });
    const { unmount } = render(<ReporteRapidoPage />);
    expect(within(kpi("Utilidad operativa")).getByText(formatSoles(0))).toBeInTheDocument();
    expect(screen.getByText("Sin ventas en el periodo: no hay con qué simular.")).toBeInTheDocument();
    unmount();

    preparar("2026-11-01", HOY, { cargando: true });
    render(<ReporteRapidoPage />);
    expect(screen.getByLabelText("Cargando resultados del periodo")).toBeInTheDocument();
  });
});
