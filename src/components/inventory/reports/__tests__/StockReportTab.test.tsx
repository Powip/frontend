import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import StockReportTab from "../StockReportTab";
import { getStockReport, getValuation, type StockReportData, type ValuationData } from "@/services/inventoryReportsService";
import { buildReportWorkbook, downloadWorkbook } from "@/lib/reports/excel";

// FEAT-24 H10 — Reporte general: variantes × almacenes a una fecha con el valorizado arriba; «sin historial»
// antes del corte; sin rol de costos no hay columnas de valor.

let role = "ADMINISTRADOR";
jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ auth: { accessToken: "t", company: { id: "c1", name: "KUNCA" }, user: { id: "u1", role, email: "ana@kunca.pe" } } }),
}));
jest.mock("@/services/inventoryReportsService", () => ({ getStockReport: jest.fn(), getValuation: jest.fn() }));
jest.mock("@/hooks/useCompanyWarehouses", () => ({
  useCompanyWarehouses: () => ({
    warehouses: [{ id: "w1", name: "Central", status: true }, { id: "w2", name: "Olva", status: true }],
    nameOf: (id: string) => ({ w1: "Central", w2: "Olva" })[id] ?? "su almacén",
  }),
}));
// FEAT-24 H6: el filtro de almacén ofrece solo los que el usuario ve.
jest.mock("@/hooks/useMyWarehouses");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { __setMyWarehouses } = require("@/hooks/useMyWarehouses") as typeof import("@/hooks/__mocks__/useMyWarehouses");
const pdfDownload = jest.fn();
jest.mock("@/hooks/usePdfDownload", () => ({ usePdfDownload: () => pdfDownload, useReportAuthor: () => "Ana" }));
jest.mock("@/lib/reports/excel", () => ({ ...jest.requireActual("@/lib/reports/excel"), buildReportWorkbook: jest.fn(() => ({})), downloadWorkbook: jest.fn().mockResolvedValue(undefined) }));

const stock = jest.mocked(getStockReport);
const valuation = jest.mocked(getValuation);

const REPORT: StockReportData = {
  available: true, date: "2026-11-18", asOf: "2026-11-18T15:00:00Z", source: "live", closePeriod: null, cutoffAt: "2026-09-01T05:00:00Z",
  warehouses: [{ id: "w1", name: "Central" }, { id: "w2", name: "Olva" }],
  items: [{
    variantId: "v1", physical: 12, reserved: 2, available: 10, inTransit: 3, pendingReturn: 1, averageCost: 25.5, value: 306,
    warehouses: [{ inventoryId: "w1", physical: 10, reserved: 2, available: 8, value: 255 }, { inventoryId: "w2", physical: 2, reserved: 0, available: 2, value: 51 }],
    productId: "p1", productName: "Polo", sku: "INT-1", companySku: "POL-M", attributes: { Talla: "M" }, brandName: "Nike", categoryName: "Polos",
  }],
  totals: { variants: 1, physical: 12, reserved: 2, available: 10, value: 306, withoutCost: { variants: 0, units: 0 } },
  total: 1, page: 1, limit: 50,
};
const VALUATION: ValuationData = {
  available: true, date: "2026-11-18", asOf: null, source: "live", closePeriod: null, cutoffAt: null,
  warehouses: [
    { inventoryId: "w1", name: "Central", items: 1, units: 10, value: 255, withoutCost: { items: 0, units: 0 } },
    { inventoryId: "w2", name: "Olva", items: 1, units: 2, value: 51, withoutCost: { items: 0, units: 0 } },
  ],
  totals: { items: 2, variants: 1, units: 12, value: 306, withoutCost: { items: 1, units: 4, variants: 1 } },
};

/** Lo que manda la fachada a quien no ve costos: sin las claves de valor. */
const masked = <T,>(value: T): T =>
  JSON.parse(JSON.stringify(value, (key, val) => (["value", "averageCost", "totalValue"].includes(key) ? undefined : val)));

function renderTab() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><StockReportTab /></QueryClientProvider>);
}
const headers = () => within(screen.getByRole("table", { name: "Stock por variante y almacén" })).getAllByRole("columnheader").map((cell) => cell.textContent);
const norm = (text: string | null | undefined) => (text ?? "").replace(/\s/g, " ");

beforeEach(() => {
  role = "ADMINISTRADOR";
  jest.clearAllMocks();
  __setMyWarehouses(null);
  stock.mockResolvedValue(REPORT);
  valuation.mockResolvedValue(VALUATION);
});

it("muestra variantes × almacenes con totales, tránsito y valor para quien ve costos", async () => {
  renderTab();
  const row = (await screen.findByText("Polo · Talla: M")).closest("tr")!;
  expect(headers()).toEqual(["Producto", "SKU", "Marca", "Categoría", "Central", "Olva", "Físico", "Reservado", "Disponible", "Tránsito", "Por recibir", "Costo prom.", "Valor"]);
  expect(within(row).getAllByRole("cell").map((cell) => norm(cell.textContent))).toEqual(["Polo · Talla: M", "POL-M", "Nike", "Polos", "8", "2", "12", "2", "10", "3", "1", "S/ 25.50", "S/ 306.00"]);
  expect(norm(screen.getByText(/^Total ·/).closest("tr")!.textContent)).toContain("S/ 306.00");
  expect(stock).toHaveBeenCalledWith({ date: undefined, inventoryId: undefined, q: undefined, onlyWithStock: false, page: 1, limit: 50 }, expect.anything());
  // Valorizado: total, por almacén y lo sin costo aparte.
  const card = screen.getByRole("region", { name: "Valorizado" });
  expect(norm(card.textContent)).toContain("S/ 306.00");
  expect(within(card).getAllByText("Sin costo")).toHaveLength(2);
  expect(norm(card.textContent)).toContain("variantes (4 und) que no suman al valor");
  expect(within(card).getAllByRole("row")).toHaveLength(3);
});

it("sin rol de costos no hay columnas de valor y el valorizado sale enmascarado", async () => {
  role = "VENTAS";
  stock.mockResolvedValue(masked(REPORT));
  valuation.mockResolvedValue(masked(VALUATION));
  renderTab();
  await screen.findByText("Polo · Talla: M");
  expect(headers()).not.toContain("Valor");
  expect(headers()).not.toContain("Costo prom.");
  const card = screen.getByRole("region", { name: "Valorizado" });
  expect(within(card).getAllByText("••••").length).toBeGreaterThan(0);
  expect(screen.getByText(/solo los ven el Administrador y Operaciones/)).toBeInTheDocument();
});

it("antes del corte del libro avisa «sin historial» en vez de mostrar una tabla vacía", async () => {
  renderTab();
  await screen.findByText("Polo · Talla: M");
  const unavailable = { available: false as const, reason: "sin_historial", message: "No hay historial de stock antes del 01/09/2026.", cutoffAt: "2026-09-01T05:00:00Z" };
  stock.mockResolvedValue(unavailable);
  valuation.mockResolvedValue(unavailable);
  fireEvent.change(screen.getByLabelText("Stock al"), { target: { value: "2026-08-15" } });
  expect(await screen.findByText("Sin historial antes del corte")).toBeInTheDocument();
  expect(screen.getByText("No hay historial de stock antes del 01/09/2026.")).toBeInTheDocument();
  expect(screen.getByText(/empieza el 01\/09\/2026/)).toBeInTheDocument();
  expect(screen.queryByRole("table", { name: "Stock por variante y almacén" })).not.toBeInTheDocument();
  expect(stock).toHaveBeenLastCalledWith(expect.objectContaining({ date: "2026-08-15" }), expect.anything());
  expect(screen.getByRole("button", { name: /Descargar Excel/ })).toBeDisabled();
});

it("una fecha pasada dice de dónde sale y no tiene tránsito", async () => {
  stock.mockResolvedValue({ ...REPORT, source: "close", closePeriod: "2026-10", date: "2026-10-31" });
  renderTab();
  expect(await screen.findByText("Foto del cierre de Octubre 2026")).toBeInTheDocument();
  expect(headers()).not.toContain("Tránsito");
});

it("manda los filtros a la API y el Excel lleva los mismos en la hoja «Filtros»", async () => {
  renderTab();
  await screen.findByText("Polo · Talla: M");
  fireEvent.change(screen.getByLabelText("Almacén"), { target: { value: "w2" } });
  fireEvent.click(screen.getByLabelText("Solo con stock"));
  fireEvent.change(screen.getByLabelText("Buscar"), { target: { value: "polo" } });
  await waitFor(() => expect(stock).toHaveBeenLastCalledWith({ date: undefined, inventoryId: "w2", q: "polo", onlyWithStock: true, page: 1, limit: 50 }, expect.anything()));
  expect(valuation).toHaveBeenLastCalledWith({ date: undefined, inventoryId: "w2" }, expect.anything());
  await waitFor(() => expect(screen.getByRole("button", { name: /Descargar Excel/ })).toBeEnabled());
  fireEvent.click(screen.getByRole("button", { name: /Descargar Excel/ }));
  await waitFor(() => expect(downloadWorkbook).toHaveBeenCalled());
  expect(stock).toHaveBeenLastCalledWith({ date: undefined, inventoryId: "w2", q: "polo", onlyWithStock: true, all: true });
  expect(jest.mocked(buildReportWorkbook).mock.calls[0][0].filters).toEqual([["Fecha", "Hoy"], ["Almacén", "Olva"], ["Búsqueda", "polo"], ["Solo con stock", "Sí"]]);
});

it("el filtro de almacén ofrece solo los almacenes que el usuario ve (FEAT-24 H6)", async () => {
  __setMyWarehouses({ all: false, inventoryIds: ["w2"], operableIds: [] });
  renderTab();
  await screen.findByText("Polo · Talla: M");
  const options = within(screen.getByLabelText("Almacén")).getAllByRole("option").map((option) => option.textContent);
  expect(options).toEqual(["Todos los almacenes", "Olva"]);
});

it("el PDF usa el helper con el encabezado común", async () => {
  renderTab();
  await screen.findByText("Polo · Talla: M");
  fireEvent.click(screen.getByRole("button", { name: /Descargar PDF/ }));
  await waitFor(() => expect(pdfDownload).toHaveBeenCalledWith(expect.objectContaining({ title: "Reporte general de inventario", landscape: true })));
});
