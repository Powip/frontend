import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { type ApiFalsa, renderConServidor } from "../../_lib/__tests__/servidor-falso";
import { useAdminPeriod } from "@/contexts/AdminPeriodContext";
import { formatSoles, formatSolesDecimales } from "@/features/panel-control/shared/utils/format";
import type { EstadoPublicidad, PublicidadConectada } from "../../_lib/publicidad";
import { datosPeriodoDe } from "../../_lib/__tests__/servidor-fixtures";
import { type DatosPeriodo, useAdminContexto, useResultadosPeriodo } from "../../_lib/useResultados";
import type { PedidoAdmin } from "../../_lib/ventas";
import ControlDiarioPage from "../page";

jest.mock("@/contexts/AdminPeriodContext", () => ({ useAdminPeriod: jest.fn() }));
jest.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ auth: { company: { id: "c1" }, accessToken: "t" } }) }));
jest.mock("@/api/Administracion", () => jest.requireActual("../../_lib/__tests__/servidor-falso").crearApiFalsa());
const servidor = jest.requireMock<ApiFalsa>("@/api/Administracion");
jest.mock("../../_lib/useResultados", () => ({
  useAdminContexto: jest.fn(),
  useResultadosPeriodo: jest.fn(),
}));

const DESDE = "2026-11-10";
const HASTA = "2026-11-12";

const venta = (p: Partial<PedidoAdmin>): PedidoAdmin => ({ status: "ENTREGADO", commercialStage: "SALE", ...p });

const PEDIDOS: PedidoAdmin[] = [
  venta({ id: "1", salesChannel: "WHATSAPP", grandTotal: 300, created_at: "2026-11-10T15:00:00Z", items: [{ quantity: 3 }] }),
  venta({ id: "2", salesChannel: "LIVE TIKTOK", grandTotal: 200, created_at: "2026-11-10T16:00:00Z", items: [{ quantity: 1 }] }),
  venta({
    id: "3",
    salesChannel: "TIKTOK_LIVE",
    grandTotal: 100,
    created_at: "2026-11-11T15:00:00Z",
    items: [{ quantity: 2 }, { quantity: 1, lineKind: "SERVICE" }],
  }),
  // 22:00 del 11 en Lima (03:00 del 12 en UTC): el servidor la cuenta el 11.
  venta({ id: "4", salesChannel: "WEB", grandTotal: 400, created_at: "2026-11-12T03:00:00Z", items: [{ quantity: 1 }] }),
  venta({ id: "5", salesChannel: "FALABELLA", grandTotal: 500, created_at: "2026-11-12T15:00:00Z", items: [{ quantity: 1 }] }),
  venta({ id: "6", status: "PENDIENTE", salesChannel: "WHATSAPP", grandTotal: 999, created_at: "2026-11-12T15:00:00Z" }),
];

function armarDatos(
  opciones: {
    pedidos?: PedidoAdmin[];
    estado?: EstadoPublicidad;
    cargando?: boolean;
    entregasSinHistorial?: number;
  } = {},
): DatosPeriodo {
  const estado = opciones.estado ?? "ok";
  const porDia = new Map(estado === "ok" ? [["2026-11-10", 50], ["2026-11-11", 100]] : []);
  const publicidad: PublicidadConectada = {
    estado,
    monto: estado === "ok" ? 150 : null,
    porDia,
    cobertura: estado === "ok" ? "complete" : null,
    diasFaltantes: 0,
    provisional: false,
    otrasMonedas: [],
  };
  return datosPeriodoDe(DESDE, HASTA, opciones.pedidos ?? PEDIDOS, {
    publicidad,
    cargando: opciones.cargando,
    servidor: { calidad: { entregasSinHistorial: opciones.entregasSinHistorial ?? 0 } },
  });
}

function preparar(opciones: Parameters<typeof armarDatos>[0] = {}) {
  jest.mocked(useAdminPeriod).mockReturnValue({ fromDate: DESDE, toDate: HASTA, setPeriod: jest.fn() });
  jest.mocked(useAdminContexto).mockReturnValue({
    companyId: "c1",
    token: "t",
    storeIds: [],
    igvPct: 18,
    hoy: "2026-11-26",
  });
  jest.mocked(useResultadosPeriodo).mockReturnValue(armarDatos(opciones));
}

const kpi = (nombre: string) => screen.getByRole("region", { name: nombre });
const filaDelDia = (tabla: HTMLElement, dia: string) =>
  within(tabla)
    .getAllByRole("row")
    .find((fila) => (fila.textContent ?? "").startsWith(dia)) as HTMLElement;

beforeEach(() => {
  window.localStorage.clear();
  servidor.__reiniciar();
});
afterEach(() => jest.clearAllMocks());

describe("Control diario", () => {
  it("muestra todos los canales que aparecen en las ventas, con las grafías de TikTok Live juntas", () => {
    preparar();
    renderConServidor(<ControlDiarioPage />);

    const chips = screen.getByRole("group", { name: "Canal" });
    for (const nombre of [
      "Todos los canales (5)",
      "TikTok Live (2)",
      "WhatsApp (1)",
      "Web / Shopify (1)",
      "Falabella (1)",
    ]) {
      expect(within(chips).getByRole("button", { name: nombre })).toBeInTheDocument();
    }
    const porCanal = screen.getByRole("table", { name: "Ventas por canal" });
    expect(within(porCanal).getByText("Llega como LIVE TIKTOK, TIKTOK_LIVE")).toBeInTheDocument();
    expect(within(porCanal).getByText("Marketplace")).toBeInTheDocument();
  });

  it("suma ventas y unidades reales por día de entrega en Lima, con publicidad conectada y costo por venta", () => {
    preparar();
    renderConServidor(<ControlDiarioPage />);

    expect(within(kpi("Ventas")).getByText(formatSoles(1500))).toBeInTheDocument();
    expect(within(kpi("Unidades")).getByText("8")).toBeInTheDocument();
    expect(within(kpi("Unidades")).getByText("1.60 por pedido")).toBeInTheDocument();
    expect(within(kpi("Publicidad")).getByText(formatSoles(150))).toBeInTheDocument();
    expect(within(kpi("Costo de publicidad por venta")).getByText(formatSolesDecimales(30))).toBeInTheDocument();

    const tabla = screen.getByRole("table", { name: "Ventas por día, Todos los canales" });
    const dia11 = filaDelDia(tabla, "11 nov");
    const celdas = within(dia11).getAllByRole("cell").map((c) => c.textContent);
    // día, pedidos, unidades (sin el servicio), ventas, publicidad, costo por venta, objetivo, avance
    expect(celdas).toEqual(["11 nov", "2", "3", formatSoles(500), formatSoles(100), formatSolesDecimales(50), "—", "—"]);
  });

  it("al elegir un canal filtra los días y no inventa publicidad por canal", () => {
    preparar();
    renderConServidor(<ControlDiarioPage />);

    fireEvent.click(within(screen.getByRole("group", { name: "Canal" })).getByRole("button", { name: "TikTok Live (2)" }));
    expect(within(kpi("Ventas")).getByText(formatSoles(300))).toBeInTheDocument();
    expect(within(kpi("Unidades")).getByText("3")).toBeInTheDocument();
    expect(within(kpi("Publicidad")).getByText("No viene separada por canal")).toBeInTheDocument();

    const tabla = screen.getByRole("table", { name: "Ventas por día, TikTok Live" });
    expect(within(tabla).queryByRole("columnheader", { name: /Publicidad/ })).not.toBeInTheDocument();
    const celdas = within(filaDelDia(tabla, "10 nov")).getAllByRole("cell").map((c) => c.textContent);
    expect(celdas).toEqual(["10 nov", "1", "1", formatSoles(200), "—", "—"]);
  });

  it("sin permiso de publicidad lo dice sin alerta roja", () => {
    preparar({ estado: "sin_permiso" });
    renderConServidor(<ControlDiarioPage />);

    expect(screen.getByText(/No tienes permiso para ver la publicidad/)).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(within(kpi("Publicidad")).getByText("—")).toBeInTheDocument();
  });

  it("guarda el objetivo diario en el servidor con la clave de canal normalizada y muestra el avance", async () => {
    preparar();
    renderConServidor(<ControlDiarioPage />);

    expect(within(kpi("Avance vs objetivo")).getByText("Sin objetivo")).toBeInTheDocument();
    expect(screen.getByText("Lo ve todo el equipo con acceso a Finanzas.")).toBeInTheDocument();

    fireEvent.click(await screen.findByRole("button", { name: "Poner objetivo" }));
    fireEvent.change(screen.getByLabelText("Objetivo de ventas por día (S/)"), { target: { value: "400" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar objetivo" }));

    // 1.500 vendidos contra 3 días × 400.
    expect(await within(kpi("Avance vs objetivo")).findByText("125%")).toBeInTheDocument();
    expect(servidor.guardarObjetivoAdministracion).toHaveBeenCalledWith("todos", 400);
    const tabla = screen.getByRole("table", { name: "Ventas por día, Todos los canales" });
    const celdas = within(filaDelDia(tabla, "12 nov")).getAllByRole("cell").map((c) => c.textContent);
    expect(celdas.slice(-2)).toEqual([formatSoles(400), "125%"]);

    fireEvent.click(within(screen.getByRole("group", { name: "Canal" })).getByRole("button", { name: "TikTok Live (2)" }));
    expect(within(kpi("Avance vs objetivo")).getByText("Sin objetivo")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Poner objetivo" }));
    fireEvent.change(screen.getByLabelText("Objetivo de ventas por día (S/)"), { target: { value: "50" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar objetivo" }));
    await waitFor(() => expect(servidor.guardarObjetivoAdministracion).toHaveBeenLastCalledWith("TIKTOK_LIVE", 50));
    expect(window.localStorage.length).toBe(0);
  });

  it("dice que la venta cuenta el día de entrega y avisa las entregas sin historial", () => {
    preparar({ entregasSinHistorial: 2 });
    renderConServidor(<ControlDiarioPage />);
    expect(screen.getByText("Una venta es un pedido entregado y cuenta en el día en que se entregó.")).toBeInTheDocument();
    expect(
      screen.getByText("2 ventas no tienen registrado el día de entrega: se cuentan en el día en que se crearon."),
    ).toBeInTheDocument();
    expect(screen.queryByText(/se creó:|a medida que se entregan/)).not.toBeInTheDocument();
  });

  it("no revienta sin datos ni mientras carga", () => {
    preparar({ pedidos: [], estado: "sin_cuentas" });
    const { unmount } = renderConServidor(<ControlDiarioPage />);
    expect(within(kpi("Ventas")).getByText(formatSoles(0))).toBeInTheDocument();
    expect(screen.getByText("Sin ventas en el periodo")).toBeInTheDocument();
    const tabla = screen.getByRole("table", { name: "Ventas por día, Todos los canales" });
    expect(within(tabla).getAllByRole("row")).toHaveLength(1 + 3 + 1); // encabezado, 3 días, total
    unmount();

    preparar({ cargando: true });
    renderConServidor(<ControlDiarioPage />);
    expect(screen.getByLabelText("Cargando ventas del periodo")).toBeInTheDocument();
  });
});
