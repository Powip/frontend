import { fireEvent, render, screen, within } from "@testing-library/react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { aDiaKey, diasDelMes } from "../../_lib/periodo";
import { calcularResultados, type Resultados } from "../../_lib/resultados";
import ResumenAnualPage from "../page";

const mockPeriodo = { fromDate: "2026-11-01", toDate: "2026-11-26" };
const mockAnuales = jest.fn();

jest.mock("@/contexts/AdminPeriodContext", () => ({
  useAdminPeriod: () => mockPeriodo,
}));
jest.mock("../../_lib/useResultados", () => ({
  useAdminContexto: () => ({ companyId: "empresa-anual", token: "t", storeIds: [], igvPct: 18, hoy: "2026-11-26" }),
  useResultadosAnuales: (...args: unknown[]) => mockAnuales(...args),
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

function res({ ventas = 0, costo = 0, fijos = 0 }: { ventas?: number; costo?: number; fijos?: number }): Resultados {
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

function anual(anio: number, hasta: string, porMes: Record<number, Resultados>, total: Resultados) {
  const meses = Array.from({ length: 12 }, (_, i) => {
    const mes = i + 1;
    const desde = aDiaKey(anio, mes, 1);
    const fin = aDiaKey(anio, mes, diasDelMes(anio, mes));
    const rango = desde > hasta ? null : { desde, hasta: fin < hasta ? fin : hasta };
    return { anio, mes, rango, resultados: porMes[mes] ?? res({}), tieneDatos: !!porMes[mes] && !!rango };
  });
  return {
    anio,
    desde: aDiaKey(anio, 1, 1),
    hasta,
    meses,
    total,
    flete: { monto: 0, conFlete: 0, entregas: 0, cobertura: null },
    gastosCrudos: [],
    publicidad: PUBLICIDAD,
    cargando: false,
    error: null,
  };
}

// 2026: enero 1.000 con 50 % de margen, febrero 9.000 con 10 % → ponderado 14 %, promedio simple 30 %.
const ACTUAL = anual(
  2026,
  "2026-11-26",
  { 1: res({ ventas: 1000, costo: 300, fijos: 200 }), 2: res({ ventas: 9000, costo: 6000, fijos: 2100 }) },
  res({ ventas: 10000, costo: 6300, fijos: 2300 }),
);
const ANTERIOR = anual(
  2025,
  "2025-11-26",
  { 1: res({ ventas: 8000, costo: 5000, fijos: 2000 }) },
  res({ ventas: 8000, costo: 5000, fijos: 2000 }),
);

const renderPage = () =>
  render(
    <TooltipProvider>
      <ResumenAnualPage />
    </TooltipProvider>,
  );

beforeEach(() => {
  window.localStorage.clear();
  mockPeriodo.fromDate = "2026-11-01";
  mockPeriodo.toDate = "2026-11-26";
  mockAnuales.mockReset();
  mockAnuales.mockImplementation((anio: number) => (anio === 2026 ? ACTUAL : ANTERIOR));
});

describe("Resumen anual", () => {
  it("usa el año del «Hasta» y compara año a la fecha contra el año anterior a la misma fecha", () => {
    renderPage();
    expect(mockAnuales).toHaveBeenCalledWith(2026);
    expect(mockAnuales).toHaveBeenCalledWith(2025, { hastaDia: "2025-11-26" });
    expect(screen.getByText("2026", { selector: "span" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Ventas 2026" })).toHaveTextContent("S/ 10,000");
    expect(screen.getByText("2026 contra 2025, a la misma fecha")).toBeInTheDocument();
    expect(screen.getByText("1 ene – 26 nov 2026 contra 1 ene – 26 nov 2025")).toBeInTheDocument();
    // Ventas +25 % en la tabla de comparación.
    const comparacion = screen.getByRole("table", { name: /Año 2026 a la fecha contra 2025/ });
    expect(within(comparacion).getAllByText("+25.0%").length).toBeGreaterThan(0);
  });

  it("el año sale del «Hasta» aunque el periodo empiece el año anterior", () => {
    mockPeriodo.fromDate = "2024-12-15";
    mockPeriodo.toDate = "2025-01-10";
    mockAnuales.mockImplementation((anio: number) => (anio === 2025 ? ANTERIOR : anual(2024, "2024-11-26", {}, res({}))));
    renderPage();
    expect(mockAnuales).toHaveBeenNthCalledWith(1, 2025);
  });

  it("margen del año ponderado (utilidad ÷ ventas), no el promedio de los % mensuales", () => {
    renderPage();
    expect(screen.getByRole("region", { name: "Margen operativo" })).toHaveTextContent("14.0%");
    expect(screen.queryByText("30.0%")).not.toBeInTheDocument();
    // Los márgenes de cada mes sí aparecen en la tabla.
    expect(screen.getByText("50.0%")).toBeInTheDocument();
    expect(screen.getByText("10.0%")).toBeInTheDocument();
  });

  it("proyección = ritmo diario del año a la fecha × días del año", () => {
    renderPage();
    // 10.000 en 330 días (1 ene – 26 nov) × 365 = 11.060,6
    const proyeccion = screen.getByRole("region", { name: "Proyección 2026" });
    expect(proyeccion).toHaveTextContent("S/ 11,061");
    // Utilidad 1.400 × 365 / 330 = 1.548,5
    expect(proyeccion).toHaveTextContent("Utilidad proyectada S/ 1,548");
  });

  it("deja vacíos los meses futuros y rotula el mes en curso", () => {
    renderPage();
    const tabla = screen.getByRole("table", { name: "Resultados por mes del año" });
    const filaDic = within(tabla).getByText("diciembre").closest("tr") as HTMLElement;
    expect(filaDic).toHaveTextContent("(por venir)");
    expect(within(filaDic).getAllByText("—").length).toBeGreaterThan(5);
    const filaNov = within(tabla).getByText("noviembre").closest("tr") as HTMLElement;
    expect(filaNov).toHaveTextContent("(hasta hoy)");
  });

  it("sin metas no hay cumplimiento; al cargarlas aparece el avance y el semáforo", () => {
    renderPage();
    expect(screen.getAllByText("Sin meta")).toHaveLength(3);
    expect(screen.queryByText("Vs meta de ventas")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Editar metas/ }));
    fireEvent.change(screen.getByLabelText("Ventas del año (S/)"), { target: { value: "20000" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar metas" }));

    expect(screen.getByText("50% de la meta")).toBeInTheDocument();
    expect(screen.getByText(/A este ritmo cierra en S\/ 11,061 \(55% de la meta\)/)).toBeInTheDocument();
    expect(screen.getByText("Bajo la meta")).toBeInTheDocument();
    expect(screen.getAllByText("Sin meta")).toHaveLength(2);
    // Enero: 1.000 contra 20.000 ÷ 12 = 60 %.
    expect(screen.getByText("Vs meta de ventas")).toBeInTheDocument();
    expect(screen.getByText("60%")).toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem("powip:admin:metas:empresa-anual:2026") ?? "{}")).toEqual({
      ventasAnual: 20000,
      profitAnual: null,
      margenObjetivoPct: null,
    });
  });

  it("no revienta sin datos", () => {
    mockAnuales.mockImplementation((anio: number) => anual(anio, `${anio}-11-26`, {}, res({})));
    renderPage();
    expect(screen.getByText("Todavía no hay ventas entregadas ni gastos en 2026")).toBeInTheDocument();
    expect(screen.getByText("No hay ventas ni gastos de 2025 hasta esa fecha para comparar.")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Margen operativo" })).toHaveTextContent("—");
  });
});
