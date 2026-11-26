import { render, screen, within } from "@testing-library/react";
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
      coberturaCosto: ventas > 0 ? 1 : null,
      ticketPromedio: null,
    },
    gastos: {
      filas: [],
      porCategoria: { PLANILLA: fijos, HERRAMIENTAS: 0, PUBLICIDAD: publicidad, COURIER_PROPIO: 0, OTRO: 0, INVERSION: 0 },
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
    pedidos: [],
    gastosCrudos,
    publicidad: PUBLICIDAD,
    cargando: false,
    error: null,
  };
}

beforeEach(() => mockAnuales.mockReset());

describe("Flujo de caja", () => {
  it("entradas − salidas (compra de mercadería, fijos, publicidad de Gastos, envíos y comisiones), sin restar el costo", () => {
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
    render(<FlujoDeCajaPage />);

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

  it("no revienta sin datos y avisa que faltan las compras de mercadería", () => {
    mockAnuales.mockReturnValue(anual({}, []));
    render(<FlujoDeCajaPage />);
    expect(screen.getByText("No hay compras de mercadería cargadas en 2026")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Compra de mercadería" })).toHaveTextContent("—");
    expect(screen.getByRole("region", { name: "Neto del año" })).toHaveTextContent("S/ 0");
  });
});
