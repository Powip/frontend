import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { type ApiFalsa, renderConServidor } from "../../_lib/__tests__/servidor-falso";
import { calcularResultados, type Resultados } from "../../_lib/resultados";
import CapitalRoiPage from "../page";

const mockAnuales = jest.fn();

jest.mock("@/contexts/AdminPeriodContext", () => ({
  useAdminPeriod: () => ({ fromDate: "2026-11-01", toDate: "2026-11-26" }),
}));
jest.mock("../../_lib/useResultados", () => ({
  useAdminContexto: () => ({ companyId: "c-capital", token: "t", storeIds: [], igvPct: 18, hoy: "2026-11-26" }),
  useResultadosAnuales: (...args: unknown[]) => mockAnuales(...args),
}));
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ auth: { company: { id: "c-capital" }, accessToken: "t" } }),
}));
jest.mock("@/api/Administracion", () => jest.requireActual("../../_lib/__tests__/servidor-falso").crearApiFalsa());
const servidor = jest.requireMock<ApiFalsa>("@/api/Administracion");

function res(ventas: number, costo: number, fijos: number): Resultados {
  return calcularResultados({
    ventas: {
      pedidos: ventas > 0 ? 10 : 0,
      monto: ventas,
      unidades: 0,
      costo,
      comisiones: 0,
      sinCosto: { pedidos: 0, monto: 0 },
      costoDudoso: { pedidos: 0, monto: 0 },
      coberturaCosto: ventas > 0 ? 1 : null,
      ticketPromedio: null,
    },
    gastos: {
      filas: [],
      porCategoria: { PLANILLA: fijos, HERRAMIENTAS: 0, PUBLICIDAD: 0, COURIER_PROPIO: 0, OTRO: 0, INVERSION: 0 },
      fijos,
      publicidad: 0,
      inversion: 0,
    },
    merma: 0,
    envios: 0,
    publicidadConectada: null,
    igvPct: 18,
  });
}

const anual = (total: Resultados) => ({
  anio: 2026,
  desde: "2026-01-01",
  hasta: "2026-11-26",
  meses: [],
  total,
  flete: { monto: 0, conFlete: 0, entregas: 0, cobertura: null },
  gastosCrudos: [],
  publicidad: { estado: "ok" },
  cargando: false,
  error: null,
});

async function registrar(datos: Record<string, string>) {
  fireEvent.click(await screen.findByRole("button", { name: /Registrar capital/ }));
  for (const [label, value] of Object.entries(datos)) {
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
  }
  fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
  await waitFor(() => expect(screen.queryByRole("form", { name: "Registrar capital" })).not.toBeInTheDocument());
}

beforeEach(() => {
  window.localStorage.clear();
  servidor.__reiniciar();
  mockAnuales.mockReset();
  // Utilidad operativa 2026 a la fecha: 10.000 − 4.000 − 2.700 = 3.300.
  mockAnuales.mockReturnValue(anual(res(10000, 4000, 2700)));
});

describe("Capital y ROI", () => {
  it("usa la utilidad del año del periodo y no suma la utilidad reinvertida al capital", async () => {
    renderConServidor(<CapitalRoiPage />);
    expect(mockAnuales).toHaveBeenCalledWith(2026);
    expect(screen.getByRole("region", { name: "Utilidad operativa 2026" })).toHaveTextContent("S/ 3,300");
    expect(screen.getByRole("region", { name: "ROI" })).toHaveTextContent("—");

    await registrar({ Descripción: "Aporte inicial", "Monto (S/)": "10000" });
    await registrar({ Tipo: "Utilidad reinvertida", Descripción: "Ganancia 2025", "Monto (S/)": "5000" });

    // Se guarda en el servidor con el tipo del servidor, nunca en el navegador.
    expect(servidor.crearCapital).toHaveBeenCalledWith({
      tipo: "capital_propio",
      descripcion: "Aporte inicial",
      monto: 10000,
      tienda: "Consolidado",
    });
    expect(servidor.__capital().map((c) => c.tipo)).toEqual(["capital_propio", "utilidad_reinvertida"]);
    expect(window.localStorage.length).toBe(0);
    expect(screen.getByRole("region", { name: "Capital invertido" })).toHaveTextContent("S/ 10,000");
    expect(screen.getByRole("region", { name: "ROI" })).toHaveTextContent("33.0%");
    expect(screen.getByText("Utilidad reinvertida: S/ 5,000")).toBeInTheDocument();
  });

  it("préstamo con TEA: tasa mensual compuesta, cuotas desde el día local y una tabla por préstamo", async () => {
    renderConServidor(<CapitalRoiPage />);
    await registrar({
      Tipo: "Préstamo",
      Descripción: "BCP",
      "Monto (S/)": "12000",
      "TEA % (tasa efectiva anual)": "12.68",
      "Plazo (cuotas mensuales)": "12",
      "Cuota mensual (S/)": "1066.18",
      "Fecha del desembolso": "2026-01-31",
    });
    const tabla = screen.getByRole("table", { name: "Cuotas del préstamo BCP" });
    const primera = within(tabla).getByText("28 feb 2026").closest("tr") as HTMLElement;
    expect(primera).toHaveTextContent("S/ 119.98");
    expect(within(tabla).getByText("31 mar 2026")).toBeInTheDocument();
    expect(within(tabla).getAllByRole("row")).toHaveLength(13);

    await registrar({
      Tipo: "Préstamo",
      Descripción: "Caja Piura",
      "Monto (S/)": "6000",
      "TEA % (tasa efectiva anual)": "20",
      "Plazo (cuotas mensuales)": "6",
      "Cuota mensual (S/)": "1100",
      "Fecha del desembolso": "2026-03-15",
    });
    expect(screen.getByRole("table", { name: "Cuotas del préstamo Caja Piura" })).toBeInTheDocument();
    expect(screen.getByRole("table", { name: "Cuotas del préstamo BCP" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Capital invertido" })).toHaveTextContent("S/ 18,000");

    fireEvent.click(screen.getAllByRole("button", { name: /Pagar cuota 1/ })[0]);
    await waitFor(() => expect(within(screen.getByRole("table", { name: "Cuotas del préstamo BCP" })).getByText("Pagada")).toBeInTheDocument());
    const bcp = servidor.__capital().find((c) => c.descripcion === "BCP");
    expect(bcp).toMatchObject({ tipo: "prestamo", teaPct: 12.68, plazoCuotas: 12, fechaInicio: "2026-01-31", cuotasPagadas: 1 });
    expect(servidor.actualizarCapital).toHaveBeenCalledWith(bcp?.id, { cuotasPagadas: 1 });
  });

  it("muestra lo que otro usuario ya registró (viene del servidor)", async () => {
    servidor.__ponerCapital([
      {
        id: "x1",
        tipo: "aumento_capital",
        descripcion: "Socio nuevo",
        monto: 4000,
        tienda: null,
        teaPct: null,
        plazoCuotas: null,
        cuotaMensual: null,
        fechaInicio: null,
        cuotasPagadas: 0,
        creadoEn: "2026-11-20T10:00:00",
      },
    ]);
    renderConServidor(<CapitalRoiPage />);
    expect(await screen.findByText("Aumento de capital")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Capital invertido" })).toHaveTextContent("S/ 4,000");
    fireEvent.click(screen.getByRole("button", { name: "Eliminar Aumento de capital: Socio nuevo" }));
    await waitFor(() => expect(servidor.__capital()).toHaveLength(0));
  });

  it("no revienta sin datos", async () => {
    mockAnuales.mockReturnValue(anual(res(0, 0, 0)));
    renderConServidor(<CapitalRoiPage />);
    expect(await screen.findByText("Todavía no registraste capital")).toBeInTheDocument();
    expect(screen.getByText("Sin préstamos registrados")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Tiempo de recupero" })).toHaveTextContent("—");
  });
});
