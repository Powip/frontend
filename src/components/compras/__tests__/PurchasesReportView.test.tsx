import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import PurchasesReportView from "../PurchasesReportView";
import { getPurchasesReport, type PurchasesReport } from "@/services/inventoryReportsService";
import { buildReportWorkbook, downloadWorkbook } from "@/lib/reports/excel";

// FEAT-24 H10-D7 — Reporte de compras: rango o periodo, totales por proveedor, producto, marca y categoría,
// serie mensual, tops, Excel y PDF. Sin la clave del monto se ve «••••».

jest.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ auth: { accessToken: "t", company: { id: "c1" }, user: { id: "u1", role: "ADMINISTRADOR" } } }) }));
jest.mock("next/navigation", () => ({ useRouter: () => ({ push: jest.fn() }), usePathname: () => "/compras/reporte" }));
jest.mock("@/components/header/HeaderConfig", () => ({ HeaderConfig: () => null }));
jest.mock("@/services/inventoryReportsService", () => ({ getPurchasesReport: jest.fn() }));
const pdfDownload = jest.fn().mockResolvedValue(undefined);
jest.mock("@/hooks/usePdfDownload", () => ({ usePdfDownload: () => pdfDownload, useReportAuthor: () => "Ana" }));
jest.mock("@/lib/reports/excel", () => ({ ...jest.requireActual("@/lib/reports/excel"), buildReportWorkbook: jest.fn(() => ({})), downloadWorkbook: jest.fn().mockResolvedValue(undefined) }));
// El gráfico necesita medidas reales: en jsdom se reemplaza por su resumen.
jest.mock("recharts", () => {
  const Pass = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  return {
    ResponsiveContainer: Pass,
    BarChart: ({ data, children }: { data: Array<{ label: string; value: number }>; children?: React.ReactNode }) => (
      <div data-testid="grafico">{data.map((datum) => `${datum.label}=${datum.value}`).join(" ")}{children}</div>
    ),
    Bar: () => null, CartesianGrid: () => null, Tooltip: () => null, XAxis: () => null, YAxis: () => null,
  };
});

const REPORT: PurchasesReport = {
  from: "2026-11-01", to: "2026-11-17",
  totals: { amount: 1500, units: 60, orders: 3, suppliers: 2, averageTicket: 500 },
  byMonth: [{ month: "2026-10", amount: 500, units: 20, orders: 1 }, { month: "2026-11", amount: 1000, units: 40, orders: 2 }],
  bySupplier: [
    { supplierId: "s1", supplierName: "Textiles Lima", amount: 1000, units: 40, orders: 2, share: 0.6667, lastDate: "2026-11-10" },
    { supplierId: "s2", supplierName: "Hilos SAC", amount: 500, units: 20, orders: 1, share: 0.3333, lastDate: "2026-10-05" },
  ],
  byVariant: [{ variantId: "v1", sku: "POL-M", productName: "Polo", productId: "p1", units: 40, amount: 1000, averageUnitCost: 25, suppliers: [{ supplierId: "s1", supplierName: "Textiles Lima" }, { supplierId: "s2", supplierName: "Hilos SAC" }] }],
  byProduct: [{ productId: "p1", productName: "Polo", units: 40, amount: 1000, variants: 1, share: 0.6667 }],
  byBrand: [{ brandId: "b1", brandName: "Nike", units: 40, amount: 1000, variants: 1, share: 0.6667 }],
  byCategory: [{ categoryId: null, categoryName: null, units: 60, amount: 1500, variants: 2, share: 1 }],
  topProducts: [{ productId: "p1", productName: "Polo", units: 40, amount: 1000, variants: 1, share: 0.6667 }],
  topSuppliers: [],
  topSupplier: { supplierId: "s1", supplierName: "Textiles Lima", amount: 1000, units: 40, orders: 2, share: 0.6667, lastDate: "2026-11-10" },
  orders: [],
};

/** Lo que manda la fachada a quien no ve costos: sin esas claves. */
const withoutKeys = <T,>(value: T, keys: string[]): T => JSON.parse(JSON.stringify(value, (key, val) => (keys.includes(key) ? undefined : val)));

function renderView() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><PurchasesReportView /></QueryClientProvider>);
}
const norm = (text: string | null | undefined) => (text ?? "").replace(/\s/g, " ");

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(getPurchasesReport).mockResolvedValue(REPORT);
});

it("muestra los totales, la serie mensual y los tops por proveedor, producto, marca y categoría", async () => {
  renderView();
  await screen.findByText("Textiles Lima", { selector: "td" });
  expect(norm(screen.getByText("Total comprado").parentElement!.textContent)).toContain("S/ 1,500.00");
  expect(norm(screen.getByText("Órdenes", { selector: "p" }).parentElement!.textContent)).toContain("Ticket promedio S/ 500.00");
  expect(screen.getByText("Principal: Textiles Lima")).toBeInTheDocument();
  expect(screen.getByTestId("grafico")).toHaveTextContent("oct 2026=500 nov 2026=1000");
  const suppliers = screen.getByRole("table", { name: "Proveedores" });
  expect(within(suppliers).getAllByRole("row")[1]).toHaveTextContent("67%");
  const products = screen.getByRole("table", { name: "Productos más comprados" });
  expect(norm(within(products).getAllByRole("row")[1].textContent)).toBe("Polo40S/ 1,000.00S/ 25.00Hilos SAC, Textiles Lima");
  expect(within(screen.getByRole("table", { name: "Por marca" })).getByText("Nike")).toBeInTheDocument();
  expect(within(screen.getByRole("table", { name: "Por categoría" })).getByText("Sin categoría")).toBeInTheDocument();
});

it("pide el rango del periodo elegido y valida el rango a mano", async () => {
  renderView();
  await screen.findByText("Textiles Lima", { selector: "td" });
  const [first] = jest.mocked(getPurchasesReport).mock.calls[0];
  expect(first).toEqual({ from: expect.stringMatching(/^\d{4}-\d{2}-01$/), to: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) });
  fireEvent.click(screen.getByRole("button", { name: "Elegir fechas" }));
  expect(await screen.findByText("Elige las dos fechas.")).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Desde"), { target: { value: "2026-03-01" } });
  fireEvent.change(screen.getByLabelText("Hasta"), { target: { value: "2026-01-01" } });
  expect(await screen.findByText(/tiene que ser anterior/)).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Hasta"), { target: { value: "2026-03-31" } });
  await waitFor(() => expect(getPurchasesReport).toHaveBeenLastCalledWith({ from: "2026-03-01", to: "2026-03-31" }, expect.anything()));
});

it("sin la clave del monto muestra «••••» y grafica unidades", async () => {
  jest.mocked(getPurchasesReport).mockResolvedValue(withoutKeys(REPORT, ["amount", "averageTicket", "share"]));
  renderView();
  expect(await screen.findByText("Unidades compradas por mes")).toBeInTheDocument();
  expect(screen.getByText("Total comprado").parentElement).toHaveTextContent("••••");
  expect(screen.getByTestId("grafico")).toHaveTextContent("oct 2026=20 nov 2026=40");
});

it("descarga el Excel con el periodo en «Filtros» y el PDF con el encabezado común", async () => {
  renderView();
  await screen.findByText("Textiles Lima", { selector: "td" });
  fireEvent.click(screen.getByRole("button", { name: /Descargar Excel/ }));
  await waitFor(() => expect(downloadWorkbook).toHaveBeenCalledWith(expect.anything(), "reporte-compras-2026-11-01-2026-11-17"));
  expect(jest.mocked(buildReportWorkbook).mock.calls[0][0].filters[0]).toEqual(["Periodo", expect.stringMatching(/\d{4}$/)]);
  fireEvent.click(screen.getByRole("button", { name: /Descargar PDF/ }));
  await waitFor(() => expect(pdfDownload).toHaveBeenCalledWith(expect.objectContaining({ title: "Reporte de compras" })));
});
