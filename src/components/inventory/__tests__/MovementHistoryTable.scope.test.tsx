import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MovementHistoryTable } from "../MovementHistoryTable";
import { getKardex, type KardexRow } from "@/services/inventoryReportsService";
import { resolveOrderNumbers } from "@/services/orderNumbersService";
import { useReconciliationVariantSearch } from "@/hooks/useReconciliationVariantSearch";
import { downloadWorkbook } from "@/lib/reports/excel";

// FEAT-24 H10 — Movimientos (kardex) lee la fachada `GET /inventory-reports/kardex` (JWT) con los filtros
// en la API y paginación del servidor, en vez de la lectura sin guarda de /inventory-movement/company/:id.

let role = "ADMINISTRADOR";
jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ auth: { company: { id: "company-a", name: "KUNCA" }, user: { id: "user-a", role, email: "ana@kunca.pe", name: "Ana" }, accessToken: "test-token" } }),
}));
jest.mock("@/services/inventoryReportsService", () => ({ getKardex: jest.fn() }));
jest.mock("@/services/orderNumbersService", () => ({ resolveOrderNumbers: jest.fn().mockResolvedValue({}) }));
jest.mock("@/hooks/useReconciliationVariantSearch", () => ({ useReconciliationVariantSearch: jest.fn() }));
const pdfDownload = jest.fn();
jest.mock("@/hooks/usePdfDownload", () => ({ usePdfDownload: () => pdfDownload, useReportAuthor: () => "Ana" }));
jest.mock("@/lib/reports/excel", () => ({ ...jest.requireActual("@/lib/reports/excel"), buildReportWorkbook: jest.fn(() => ({})), downloadWorkbook: jest.fn().mockResolvedValue(undefined) }));

const kardex = jest.mocked(getKardex);
const search = jest.mocked(useReconciliationVariantSearch);
const ORDER = "0f8fad5b-d9cb-469f-a165-70867728950e";
const warehouses = [
  { id: "w1", name: "Principal", storeId: "store-a", storeName: "Miraflores" },
  { id: "w2", name: "Secundario", storeId: "store-a", storeName: "Miraflores" },
];

const base: KardexRow = {
  id: "m0", createdAt: "2026-11-17T17:47:00Z", type: "IN", variantId: "v1", inventoryId: "w1", inventoryName: "Principal", quantity: 2,
  physicalDelta: 2, reservedDelta: 0, physicalAfter: 12, reservedAfter: 0, transitDelta: 0,
  unitCost: 10, averageCostAfter: 9.5, value: 20,
  reason: null, referenceType: null, referenceId: null, referenceNumber: null, userEmail: null, userName: null,
  productId: "p1", productName: "Polo", sku: "INT-1", companySku: "POL-M", attributes: { Talla: "M" },
};
const row = (patch: Partial<KardexRow>): KardexRow => ({ ...base, ...patch });
const page = (items: KardexRow[], total = items.length) => ({ items, total, page: 1, limit: 25 });

function setup(props: Partial<React.ComponentProps<typeof MovementHistoryTable>> = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MovementHistoryTable companyId="company-a" scope="business" inventories={warehouses} {...props} />
    </QueryClientProvider>,
  );
}
const lastFilters = () => kardex.mock.calls.at(-1)![0];
const cellsOf = (text: string) => screen.getByText(text).closest("tr")!.querySelectorAll("td");

beforeEach(() => {
  role = "ADMINISTRADOR";
  kardex.mockReset();
  kardex.mockResolvedValue(page([base]));
  search.mockReturnValue({ results: [], isLoading: false, isError: false, error: null, isSearchable: false });
  jest.mocked(resolveOrderNumbers).mockResolvedValue({});
  pdfDownload.mockReset();
});

describe("kardex desde la fachada", () => {
  it("pide la primera página a la fachada, sin filtros, y muestra el saldo", async () => {
    setup();
    await screen.findByText("Polo · Talla: M");
    expect(kardex).toHaveBeenCalledWith({ variantId: undefined, inventoryId: undefined, types: undefined, from: undefined, to: undefined, document: undefined, page: 1, limit: 25 }, expect.anything());
    const cells = cellsOf("Polo · Talla: M");
    expect(cells[4].textContent).toBe("+2saldo 12");
    expect(cells[5].textContent).toBe("—");
    expect(screen.getAllByRole("columnheader").map((cell) => cell.textContent)).toEqual(["Fecha y hora", "Tipo", "Producto / SKU", "Almacén", "Físico", "Reservado", "Referencia", "Usuario", "Motivo"]);
  });

  it("FEAT-24 H5-L: muestra los lotes de cada movimiento debajo del producto", async () => {
    kardex.mockResolvedValue(page([
      row({ id: "con-lote", type: "MERMA", physicalDelta: -4, lots: [{ lotId: "l1", lotNumber: "A117", expiresAt: "2026-10-31", quantity: -3 }, { lotId: null, lotNumber: null, quantity: -1 }] }),
      row({ id: "sin-lote", productName: "Gorra", lots: null }),
    ]));
    setup();
    expect(await screen.findByTestId("kardex-lots-con-lote")).toHaveTextContent("Lotes: A117 −3 · Sin lote −1");
    expect(screen.queryByTestId("kardex-lots-sin-lote")).not.toBeInTheDocument();
  });

  it("los tipos nuevos salen en español", async () => {
    kardex.mockResolvedValue(page([
      row({ id: "a", type: "ENTRADA_COMPRA", reason: "PURCHASE_RECEPTION - OC-0001 - REC-0001", referenceId: "OC-0001", referenceNumber: "REC-0001", productName: "Polo A" }),
      row({ id: "b", type: "DEVOLUCION_EN_CAMINO", reason: "order.cancelled:4", referenceId: ORDER, physicalDelta: 0, transitDelta: -1, productName: "Polo B" }),
      row({ id: "c", type: "TRASLADO_SALIDA", reason: "TRANSFER_OUT - TRA-0004", referenceId: "TRA-0004", productName: "Polo C" }),
      row({ id: "d", type: "MERMA", reason: "SHRINKAGE - Dañado", productName: "Polo D" }),
    ]));
    jest.mocked(resolveOrderNumbers).mockResolvedValue({ [ORDER]: "ORD-150200" });
    setup();
    await screen.findByText("ORD-150200");
    expect(cellsOf("Polo A · Talla: M")[1].textContent).toBe("Entrada por compra");
    expect(cellsOf("Polo A · Talla: M")[6].textContent).toBe("REC-0001");
    expect(cellsOf("Polo B · Talla: M")[1].textContent).toBe("Devolución en camino");
    expect(cellsOf("Polo B · Talla: M")[4].textContent).toContain("en camino -1");
    expect(cellsOf("Polo C · Talla: M")[1].textContent).toBe("Traslado · salida");
    expect(cellsOf("Polo D · Talla: M")[1].textContent).toBe("Merma");
    expect(cellsOf("Polo D · Talla: M")[8].textContent).toBe("Merma (Dañado)");
    expect(screen.queryByText(ORDER)).not.toBeInTheDocument();
  });

  it("sin nombre muestra el email; sin nada, Sistema", async () => {
    kardex.mockResolvedValue(page([row({ id: "a", userEmail: "jefe@x.pe", productName: "Uno" }), row({ id: "b", productName: "Dos" })]));
    setup();
    await screen.findByText("Uno · Talla: M");
    expect(cellsOf("Uno · Talla: M")[7].textContent).toBe("jefe@x.pe");
    expect(cellsOf("Dos · Talla: M")[7].textContent).toBe("Sistema");
  });

  it("manda los filtros a la API: tipo, almacén, fechas y documento", async () => {
    setup();
    await screen.findByText("Polo · Talla: M");
    fireEvent.change(screen.getByLabelText("Tipo"), { target: { value: "MERMA" } });
    await waitFor(() => expect(lastFilters()).toMatchObject({ types: ["MERMA"], page: 1 }));
    fireEvent.change(screen.getByLabelText("Almacén"), { target: { value: "w2" } });
    fireEvent.change(screen.getByLabelText("Desde"), { target: { value: "2026-11-01" } });
    fireEvent.change(screen.getByLabelText("Hasta"), { target: { value: "2026-11-30" } });
    fireEvent.change(screen.getByLabelText("Documento"), { target: { value: " oc-0001 " } });
    fireEvent.click(screen.getByRole("button", { name: "Filtrar" }));
    await waitFor(() => expect(lastFilters()).toMatchObject({ types: ["MERMA"], inventoryId: "w2", from: "2026-11-01", to: "2026-11-30", document: "oc-0001" }));
  });

  it("no consulta con un rango de fechas al revés", async () => {
    setup();
    await screen.findByText("Polo · Talla: M");
    fireEvent.change(screen.getByLabelText("Desde"), { target: { value: "2026-11-30" } });
    fireEvent.change(screen.getByLabelText("Hasta"), { target: { value: "2026-11-01" } });
    expect(await screen.findByText(/no puede ser posterior/)).toBeInTheDocument();
    expect(kardex.mock.calls.some(([filters]) => filters.from === "2026-11-30" && filters.to === "2026-11-01")).toBe(false);
  });

  it("busca un producto con el buscador seguro y filtra por su variante", async () => {
    search.mockImplementation((text: string) => ({
      results: text === "polo" ? [{ variant_id: "v9", product_name: "Polo", sku: "INT-9", company_sku: "POL-L", attribute_values: { Talla: "L" } }] : [],
      isLoading: false, isError: false, error: null, isSearchable: text.length >= 2,
    }));
    setup();
    await screen.findByText("Polo · Talla: M");
    fireEvent.change(screen.getByPlaceholderText("Busca un producto o SKU…"), { target: { value: "polo" } });
    fireEvent.click(await screen.findByRole("option", { name: /Polo · Talla: L/ }));
    await waitFor(() => expect(lastFilters()).toMatchObject({ variantId: "v9" }));
    expect(screen.getByTitle("Polo · Talla: L (POL-L)")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Quitar producto" }));
    await waitFor(() => expect(lastFilters()).toMatchObject({ variantId: undefined }));
  });

  it("desde Stock arranca con la variante; un documento arranca en «Documento»", async () => {
    const { unmount } = setup({ initialVariantId: "v1", initialSearch: "Polo · M" });
    await screen.findByTitle("Polo · M");
    expect(lastFilters()).toMatchObject({ variantId: "v1" });
    unmount();
    setup({ initialSearch: "ORD-150200" });
    await waitFor(() => expect(lastFilters()).toMatchObject({ document: "ORD-150200", variantId: undefined }));
    expect(screen.getByLabelText("Documento")).toHaveValue("ORD-150200");
  });

  it("en una tienda lee un almacén por vez (el primero) y no ofrece «Todos»", async () => {
    setup({ scope: "store" });
    await screen.findByText("Polo · Talla: M");
    expect(lastFilters()).toMatchObject({ inventoryId: "w1" });
    expect(within(screen.getByLabelText("Almacén")).queryByText("Todos mis almacenes")).not.toBeInTheDocument();
  });

  it("la ficha elige entre las variantes del producto", async () => {
    setup({ variants: [{ id: "v1", label: "Talla: M" }, { id: "v2", label: "Talla: L" }] });
    await screen.findByText("Polo · Talla: M");
    expect(lastFilters()).toMatchObject({ variantId: "v1" });
    fireEvent.change(screen.getByLabelText("Producto"), { target: { value: "v2" } });
    await waitFor(() => expect(lastFilters()).toMatchObject({ variantId: "v2" }));
  });

  it("pagina en el servidor", async () => {
    kardex.mockResolvedValue(page([base], 60));
    setup();
    await screen.findByText("Polo · Talla: M");
    expect(screen.getByText(/^Total:/).textContent).toBe("Total: 60 movimientos");
    fireEvent.click(screen.getByRole("button", { name: /Siguiente/ }));
    await waitFor(() => expect(lastFilters()).toMatchObject({ page: 2, limit: 25 }));
  });

  it("muestra el error con Reintentar y se recupera", async () => {
    kardex.mockRejectedValueOnce(new Error("401 Unauthorized")).mockResolvedValueOnce(page([base]));
    setup();
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("401 Unauthorized"));
    expect(screen.getByText("Historial no disponible.")).toHaveAttribute("colspan", "9");
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    await screen.findByText("Polo · Talla: M");
  });

  it("vacío ocupa todas las columnas", async () => {
    kardex.mockResolvedValue(page([]));
    setup();
    expect(await screen.findByText("No se encontraron movimientos con los filtros aplicados.")).toHaveAttribute("colspan", "9");
  });
});

describe("kardex valorizado y exportación", () => {
  it("con permiso, el kardex valorizado agrega costo, valor y costo promedio", async () => {
    kardex.mockResolvedValue(page([base, row({ id: "x", productName: "Sin costo", unitCost: null, value: null, averageCostAfter: null })]));
    setup();
    await screen.findByText("Polo · Talla: M");
    expect(screen.queryByText("Costo unit.")).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Kardex valorizado"));
    expect(screen.getAllByRole("columnheader").map((cell) => cell.textContent)).toContain("Costo prom.");
    const cells = cellsOf("Polo · Talla: M");
    expect([cells[6], cells[7], cells[8]].map((cell) => cell.textContent?.replace(/\s/g, " "))).toEqual(["S/ 10.00", "S/ 20.00", "S/ 9.50"]);
    expect(cellsOf("Sin costo · Talla: M")[7].textContent).toBe("—");
  });

  it("sin rol de costos no hay kardex valorizado", async () => {
    role = "VENTAS";
    setup();
    await screen.findByText("Polo · Talla: M");
    expect(screen.queryByLabelText("Kardex valorizado")).not.toBeInTheDocument();
    expect(screen.queryByText("Valor")).not.toBeInTheDocument();
  });

  it("el Excel pide todas las filas con los mismos filtros", async () => {
    setup();
    await screen.findByText("Polo · Talla: M");
    fireEvent.change(screen.getByLabelText("Tipo"), { target: { value: "MERMA" } });
    await waitFor(() => expect(lastFilters()).toMatchObject({ types: ["MERMA"] }));
    await waitFor(() => expect(screen.getByRole("button", { name: /Descargar Excel/ })).toBeEnabled());
    kardex.mockResolvedValueOnce({ ...page([base]), truncated: false });
    fireEvent.click(screen.getByRole("button", { name: /Descargar Excel/ }));
    await waitFor(() => expect(downloadWorkbook).toHaveBeenCalled());
    expect(kardex).toHaveBeenLastCalledWith(expect.objectContaining({ types: ["MERMA"], all: true }));
    expect(jest.mocked(downloadWorkbook).mock.calls[0][1]).toMatch(/^movimientos-\d{4}-\d{2}-\d{2}$/);
  });

  it("el PDF usa el helper con encabezado común", async () => {
    setup();
    await screen.findByText("Polo · Talla: M");
    fireEvent.click(screen.getByRole("button", { name: /Descargar PDF/ }));
    await waitFor(() => expect(pdfDownload).toHaveBeenCalledWith(expect.objectContaining({ title: "Movimientos de inventario", landscape: true })));
  });
});
