import { screen, waitFor, within } from "@testing-library/react";
import { type ApiFalsa, comprasVacias, renderConServidor } from "../../_lib/__tests__/servidor-falso";
import { aDiaKey, diasDelMes } from "../../_lib/periodo";
import { calcularResultados, type Resultados } from "../../_lib/resultados";
import FlujoDeCajaPage from "../page";

const mockAnuales = jest.fn();

jest.mock("@/contexts/AdminPeriodContext", () => ({
  useAdminPeriod: () => ({ fromDate: "2026-11-01", toDate: "2026-11-26" }),
}));
jest.mock("../../_lib/useResultados", () => ({
  useAdminContexto: () => ({ companyId: "c1", token: "t", storeIds: [], igvPct: 18, hoy: "2026-11-26" }),
  useResultadosAnuales: (...args: unknown[]) => mockAnuales(...args),
}));
jest.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ auth: { company: { id: "c1" }, accessToken: "t" } }) }));
jest.mock("@/api/Administracion", () => jest.requireActual("../../_lib/__tests__/servidor-falso").crearApiFalsa());
const servidor = jest.requireMock<ApiFalsa>("@/api/Administracion");
jest.mock("@/components/advertising/AdvertisingCompanySpend", () => ({
  AdvertisingCompanySpend: () => <div>gasto de anuncios embebido</div>,
}));

const PUBLICIDAD = {
  estado: "ok",
  monto: 0,
  porDia: new Map(),
  cobertura: null,
  diasFaltantes: 0,
  provisional: false,
  otrasMonedas: [],
};

function res(v: {
  ventas?: number;
  costo?: number;
  fijos?: number;
  publicidad?: number;
  comisiones?: number;
  envios?: number;
}): Resultados {
  const { ventas = 0, costo = 0, fijos = 0, publicidad = 0, comisiones = 0, envios = 0 } = v;
  return calcularResultados({
    ventas: {
      pedidos: ventas > 0 ? 5 : 0,
      monto: ventas,
      unidades: 0,
      costo,
      comisiones,
      sinCosto: { pedidos: 0, monto: 0 },
      costoDudoso: { pedidos: 0, monto: 0 },
      coberturaCosto: ventas > 0 ? 1 : null,
      ticketPromedio: null,
    },
    gastos: {
      filas: [],
      porCategoria: { PLANILLA: fijos, HERRAMIENTAS: 0, IMPLEMENTOS: 0, PUBLICIDAD: publicidad, COURIER_PROPIO: 0, OTRO: 0, INVERSION: 0 },
      fijos,
      publicidad,
      inversion: 0,
    },
    merma: 0,
    envios,
    publicidadConectada: null,
    igvPct: 18,
  });
}

const gasto = (categoria: string, anio: number, mes: number, monto: number) => ({
  id: `${categoria}-${anio}-${mes}`,
  company_id: "c1",
  categoria,
  descripcion: null,
  monto,
  mes,
  anio,
});

function anual(porMes: Record<number, Resultados>, gastosCrudos: ReturnType<typeof gasto>[]) {
  const hasta = "2026-11-26";
  const meses = Array.from({ length: 12 }, (_, i) => {
    const mes = i + 1;
    const desde = aDiaKey(2026, mes, 1);
    const fin = aDiaKey(2026, mes, diasDelMes(2026, mes));
    const rango = desde > hasta ? null : { desde, hasta: fin < hasta ? fin : hasta };
    return { anio: 2026, mes, rango, resultados: porMes[mes] ?? res({}), tieneDatos: !!porMes[mes] };
  });
  return {
    anio: 2026,
    desde: "2026-01-01",
    hasta,
    meses,
    total: res({}),
    flete: { monto: 0, conFlete: 0, entregas: 0, cobertura: null },
    gastosCrudos,
    publicidad: PUBLICIDAD,
    cargando: false,
    error: null,
  };
}

beforeEach(() => {
  mockAnuales.mockReset();
  servidor.__reiniciar();
});

/** Compras de inventario pagadas en 2026, por mes. */
function comprasPagadas(porMes: Array<{ mes: string; compras: number; monto: number }>) {
  servidor.__ponerCompras({
    ...comprasVacias("2026-01-01", "2026-11-26"),
    pagadas: {
      compras: porMes.reduce((s, m) => s + m.compras, 0),
      monto: porMes.reduce((s, m) => s + m.monto, 0),
      porMes,
    },
  });
}

describe("Flujo de caja", () => {
  it("entradas − salidas (compra de mercadería, fijos, publicidad de Gastos, envíos y comisiones), sin restar el costo", async () => {
    mockAnuales.mockReturnValue(
      anual(
        {
          // enero: 1.000 − (400 compra + 200 fijos + 100 publicidad + 50 envíos + 30 comisiones) = 220
          1: res({ ventas: 1000, costo: 300, fijos: 200, publicidad: 100, envios: 50, comisiones: 30 }),
          // febrero: 2.000 − 200 = 1.800 → acumulado 2.020
          2: res({ ventas: 2000, costo: 900, fijos: 200 }),
        },
        [
          gasto("INVERSION", 2026, 1, 400),
          gasto("INVERSION", 2026, 12, 999), // mes futuro: no cuenta
          gasto("INVERSION", 2025, 1, 777), // otro año
          gasto("PUBLICIDAD", 2026, 1, 100),
        ],
      ),
    );
    renderConServidor(<FlujoDeCajaPage />);

    await screen.findByRole("table", { name: "Flujo de caja estimado por mes de 2026" });
    expect(mockAnuales).toHaveBeenCalledWith(2026);
    const tabla = screen.getByRole("table", { name: "Flujo de caja estimado por mes de 2026" });
    const enero = within(tabla).getByText("enero").closest("tr") as HTMLElement;
    expect(enero).toHaveTextContent("S/ 1,000");
    expect(enero).toHaveTextContent("S/ 400");
    // La publicidad cargada en Gastos ya no se pierde.
    expect(enero).toHaveTextContent("S/ 100");
    expect(enero).toHaveTextContent("S/ 780");
    expect(enero).toHaveTextContent("S/ 220");
    // Si se restara el costo de producto, enero daría −S/ 80.
    expect(screen.queryByText("−S/ 80")).not.toBeInTheDocument();

    const febrero = within(tabla).getByText("febrero").closest("tr") as HTMLElement;
    expect(febrero).toHaveTextContent("S/ 1,800");
    expect(febrero).toHaveTextContent("S/ 2,020");

    expect(screen.getByRole("region", { name: "Entradas" })).toHaveTextContent("S/ 3,000");
    expect(screen.getByRole("region", { name: "Salidas" })).toHaveTextContent("S/ 980");
    expect(screen.getByRole("region", { name: "Neto del año" })).toHaveTextContent("S/ 2,020");
    expect(screen.getByRole("region", { name: "Compra de mercadería" })).toHaveTextContent("S/ 400");
    expect(screen.queryByText("S/ 999")).not.toBeInTheDocument();
    expect(screen.queryByText("S/ 777")).not.toBeInTheDocument();

    const diciembre = within(tabla).getByText("diciembre").closest("tr") as HTMLElement;
    expect(diciembre).toHaveTextContent("(por venir)");
    expect(within(tabla).getByText("noviembre").closest("tr")).toHaveTextContent("(hasta hoy)");

    expect(screen.getByText(/No se resta el costo de lo vendido/)).toBeInTheDocument();
    expect(screen.queryByText("gasto de anuncios embebido")).not.toBeInTheDocument();
  });

  it("los envíos son el flete por pedido y avisa si se conoce en pocas entregas del año", async () => {
    mockAnuales.mockReturnValue({
      ...anual({ 1: res({ ventas: 1000, envios: 50 }) }, []),
      flete: { monto: 50, conFlete: 3, entregas: 50, cobertura: 0.06 },
    });
    renderConServidor(<FlujoDeCajaPage />);
    expect(
      await screen.findByText(
        "Envíos = flete por pedido. Flete conocido en 3 de 50 entregas: el resto no suma envío, así que la utilidad sale sobreestimada.",
      ),
    ).toBeInTheDocument();
  });

  it("la compra de mercadería suma las compras de inventario pagadas (módulo Compras) a lo cargado en Gastos", async () => {
    comprasPagadas([
      { mes: "2026-01", compras: 2, monto: 1500 },
      { mes: "2026-03", compras: 1, monto: 600 },
    ]);
    mockAnuales.mockReturnValue(
      anual({ 1: res({ ventas: 5000 }), 3: res({ ventas: 1000 }) }, [gasto("INVERSION", 2026, 1, 400)]),
    );
    renderConServidor(<FlujoDeCajaPage />);

    const tabla = await screen.findByRole("table", { name: "Flujo de caja estimado por mes de 2026" });
    await waitFor(() =>
      expect(within(tabla).getByText("enero").closest("tr")).toHaveTextContent("S/ 1,900"),
    );
    // enero: 5.000 − (1.500 + 400) = 3.100; marzo: 1.000 − 600 = 400.
    expect(within(tabla).getByText("enero").closest("tr")).toHaveTextContent("S/ 3,100");
    expect(within(tabla).getByText("marzo").closest("tr")).toHaveTextContent("S/ 600");
    const kpi = screen.getByRole("region", { name: "Compra de mercadería" });
    expect(kpi).toHaveTextContent("S/ 2,500");
    expect(kpi).toHaveTextContent("Compras de inventario S/ 2,100 · cargado en Gastos S/ 400");
    expect(servidor.getComprasAdministracion).toHaveBeenCalledWith("2026-01-01", "2026-11-26", expect.anything());
    // Con las dos fuentes, avisa que una compra cargada en los dos lados se cuenta dos veces.
    expect(screen.getByText(/se cuenta dos veces/)).toBeInTheDocument();
    expect(screen.queryByText(/No hay compras de mercadería/)).not.toBeInTheDocument();
  });

  it("si no se pueden leer las compras de inventario, sigue con lo de Gastos y lo avisa", async () => {
    servidor.getComprasAdministracion.mockRejectedValueOnce(new Error("caído"));
    mockAnuales.mockReturnValue(anual({ 1: res({ ventas: 1000 }) }, [gasto("INVERSION", 2026, 1, 400)]));
    renderConServidor(<FlujoDeCajaPage />);
    expect(await screen.findByText(/No se pudieron leer las compras de inventario/)).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Compra de mercadería" })).toHaveTextContent("S/ 400");
  });

  it("no revienta sin datos y avisa que faltan las compras de mercadería", async () => {
    mockAnuales.mockReturnValue(anual({}, []));
    renderConServidor(<FlujoDeCajaPage />);
    expect(await screen.findByText("No hay compras de mercadería en 2026")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Compra de mercadería" })).toHaveTextContent("—");
    expect(screen.getByRole("region", { name: "Neto del año" })).toHaveTextContent("S/ 0");
  });
});
