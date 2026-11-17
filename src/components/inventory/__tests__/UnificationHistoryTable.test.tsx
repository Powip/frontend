/**
 * Tests: UnificationHistoryTable (FEAT-24 H11 — Historial)
 *
 * Tabla paginada de `GET /reconciliation-tasks/history`: quién, cuándo, vía,
 * ganadora, perdedoras y modo de stock; filtro por estado; marca «Detalle
 * reconstruido» para las tareas anteriores a H11; sin «deshacer»; el costo
 * solo para quien ve costos. Filtros por fecha (días de Lima), correo y vía, y
 * «Exportar CSV» con los mismos filtros (hasta 500 filas, avisa si hay más).
 */
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

jest.mock("@/contexts/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("@/services/unification.service", () => ({ listUnificationHistory: jest.fn(), UNIFICATION_HISTORY_EXPORT_LIMIT: 500 }));
jest.mock("@/utils/http/download-file", () => ({ downloadFile: jest.fn() }));
jest.mock("sonner", () => ({ toast: { success: jest.fn(), warning: jest.fn(), info: jest.fn(), error: jest.fn() } }));

import { toast } from "sonner";
import { downloadFile } from "@/utils/http/download-file";
import { useAuth } from "@/contexts/AuthContext";
import { listUnificationHistory, type UnificationHistoryItem, type UnificationHistoryPage } from "@/services/unification.service";
import { UnificationHistoryTable } from "../UnificationHistoryTable";

const mockList = jest.mocked(listUnificationHistory);

const item = (overrides: Partial<UnificationHistoryItem>): UnificationHistoryItem => ({
  id: "t-1", type: "manual", status: "confirmed", via: "union_manual", action: "merge",
  created_at: "2026-11-17T15:00:00.000Z", resolved_at: "2026-11-17T15:00:00.000Z",
  resolved_by: { user_id: "u-1", email: "ana@fixture.invalid" },
  winner: { variant_id: "v-1", product_id: "p-1", product_name: "Polo Azul", sku: "INT-1", company_sku: "POL-M", attribute_values: { Talla: "M" }, is_active: true },
  losers: [{ variant_id: "v-2", product_id: "p-2", product_name: "Polo azul Shopify", sku: "SHP-1", company_sku: "SHP-M", attribute_values: { Talla: "M" }, is_active: false }],
  stock_mode: "count", counted_quantity: 12, price_base: 20, derived: false, items: [],
  ...overrides,
});

const PAGE: UnificationHistoryPage = {
  data: [
    item({}),
    item({
      id: "t-2", type: "duplicate_cluster", via: "bandeja", resolved_by: { user_id: "u-9", email: null }, stock_mode: null,
      counted_quantity: null, price_base: null, derived: true,
      winner: { variant_id: "v-5", product_id: "p-5", product_name: "Gorra", sku: "GOR", company_sku: null, attribute_values: {}, is_active: true },
      losers: [{ variant_id: "v-6", product_id: "p-6", product_name: "Gorra vieja", sku: "GOR-2", company_sku: null, attribute_values: {}, is_active: false }],
    }),
    item({
      id: "t-3", type: "duplicate_cluster", status: "rejected", via: "bandeja", action: "reject", winner: null, losers: [],
      stock_mode: null, counted_quantity: null, price_base: null,
      items: [
        { variant_id: "v-7", product_id: "p-7", variant_name: "Short negro", sku: null, company_sku: null, external_id: null, source: null, confidence: 0.8 },
        { variant_id: "v-8", product_id: "p-8", variant_name: "Short azul", sku: null, company_sku: null, external_id: null, source: null, confidence: 0.8 },
      ],
    }),
  ],
  meta: { page: 1, limit: 10, total: 23, totalPages: 3 },
};

function mockAuth(role: string) {
  jest.mocked(useAuth).mockReturnValue({
    auth: { accessToken: "t", user: { id: "u-1", role, permissions: [] }, company: { id: "c-1", stores: [] } },
  } as unknown as ReturnType<typeof useAuth>);
}

function renderTable() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  render(<UnificationHistoryTable companyId="c-1" />, { wrapper });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockAuth("ADMINISTRADOR");
  mockList.mockResolvedValue(PAGE);
});

describe("UnificationHistoryTable (FEAT-24 H11)", () => {
  it("muestra quién, cuándo, vía, la madre, las que se unieron y el modo de stock, sin «deshacer»", async () => {
    renderTable();
    const row = await screen.findByTestId("history-row-t-1");
    expect(mockList).toHaveBeenCalledWith({ page: 1, limit: 10 });
    expect(within(row).getByText("ana@fixture.invalid")).toBeInTheDocument();
    expect(within(row).getByText("Unificación")).toBeInTheDocument();
    expect(within(row).getByText("Unión manual")).toBeInTheDocument();
    expect(within(row).getByText("Polo Azul")).toBeInTheDocument();
    expect(within(row).getByText("Polo azul Shopify")).toBeInTheDocument();
    expect(within(row).getByText("Conteo físico: 12")).toBeInTheDocument();
    expect(within(row).getByText(/17\/11\/(20)?26/)).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Vía" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /deshacer|revertir/i })).not.toBeInTheDocument();
    expect(screen.getByText(/El historial no se puede borrar ni editar/)).toBeInTheDocument();
  });

  it("marca las tareas anteriores a H11 como «Detalle reconstruido» y sin modo de stock", async () => {
    renderTable();
    const row = await screen.findByTestId("history-row-t-2");
    expect(within(row).getByText("Detalle reconstruido")).toHaveAttribute("title", expect.stringMatching(/antes del historial detallado/));
    expect(within(row).getByText("Bandeja")).toBeInTheDocument();
    expect(within(row).getByText("Sin detalle")).toBeInTheDocument();
    expect(within(row).getByText("—", { selector: "td" })).toBeInTheDocument();
    expect(within(screen.getByTestId("history-row-t-1")).queryByText("Detalle reconstruido")).not.toBeInTheDocument();
  });

  it("una rechazada muestra lo que no se unió", async () => {
    renderTable();
    const row = await screen.findByTestId("history-row-t-3");
    expect(within(row).getByText("Rechazada")).toBeInTheDocument();
    expect(within(row).getByText("No se unió: Short negro · Short azul")).toBeInTheDocument();
  });

  it("filtra por estado y vuelve a la página 1; pagina", async () => {
    const user = userEvent.setup();
    renderTable();
    await screen.findByTestId("history-row-t-1");
    await user.click(screen.getByRole("button", { name: /^2$/ }));
    await waitFor(() => expect(mockList).toHaveBeenLastCalledWith({ page: 2, limit: 10 }));
    await user.click(screen.getByRole("button", { name: "Rechazadas" }));
    await waitFor(() => expect(mockList).toHaveBeenLastCalledWith({ page: 1, limit: 10, status: "rejected" }));
    expect(screen.getByRole("button", { name: "Rechazadas" })).toHaveAttribute("aria-pressed", "true");
  });

  it("el costo fijado al unir solo lo ve quien ve costos", async () => {
    renderTable();
    const row = await screen.findByTestId("history-row-t-1");
    expect(within(row).getByText(/Costo S\/\s*20\.00/)).toBeInTheDocument();
  });

  it("oculta el costo a un rol que no ve costos", async () => {
    mockAuth("VENTAS");
    renderTable();
    await screen.findByTestId("history-row-t-1");
    expect(screen.queryByText(/Costo/)).not.toBeInTheDocument();
  });

  it("filtra por vía, por correo (al dejar de escribir) y por un rango de días de Lima, y vuelve a la página 1", async () => {
    const user = userEvent.setup();
    renderTable();
    await screen.findByTestId("history-row-t-1");
    await user.click(screen.getByRole("button", { name: /^2$/ }));
    await waitFor(() => expect(mockList).toHaveBeenLastCalledWith({ page: 2, limit: 10 }));

    await user.selectOptions(screen.getByLabelText("Vía"), "union_manual");
    await waitFor(() => expect(mockList).toHaveBeenLastCalledWith({ page: 1, limit: 10, via: "union_manual" }));

    await user.type(screen.getByLabelText("Correo del usuario"), " Ana@Fixture.invalid ");
    await waitFor(() =>
      expect(mockList).toHaveBeenLastCalledWith({ page: 1, limit: 10, via: "union_manual", resolvedBy: "Ana@Fixture.invalid" }),
    );

    await user.selectOptions(screen.getByLabelText("Fecha"), "range");
    fireEvent.change(screen.getByLabelText("Desde"), { target: { value: "2026-11-01" } });
    fireEvent.change(screen.getByLabelText("Hasta"), { target: { value: "2026-11-17" } });
    await waitFor(() =>
      expect(mockList).toHaveBeenLastCalledWith({
        page: 1,
        limit: 10,
        via: "union_manual",
        resolvedBy: "Ana@Fixture.invalid",
        from: "2026-11-01T05:00:00.000Z",
        to: "2026-11-18T04:59:59.999Z",
      }),
    );

    await user.click(screen.getByRole("button", { name: "Limpiar filtros" }));
    await waitFor(() => expect(mockList).toHaveBeenLastCalledWith({ page: 1, limit: 10 }));
    expect(screen.getByLabelText("Correo del usuario")).toHaveValue("");
  });

  it("un rango con «desde» después de «hasta» no consulta y no deja exportar", async () => {
    const user = userEvent.setup();
    renderTable();
    await screen.findByTestId("history-row-t-1");
    await user.selectOptions(screen.getByLabelText("Fecha"), "range");
    fireEvent.change(screen.getByLabelText("Desde"), { target: { value: "2026-11-17" } });
    fireEvent.change(screen.getByLabelText("Hasta"), { target: { value: "2026-11-01" } });

    expect(await screen.findByRole("alert")).toHaveTextContent("La fecha «desde» es posterior a la fecha «hasta».");
    expect(screen.queryByTestId("history-row-t-1")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Exportar CSV/ })).toBeDisabled();
    for (const [params] of mockList.mock.calls) expect(params).not.toHaveProperty("to");
  });

  it("«Exportar CSV» pide hasta 500 filas con los filtros actuales, descarga el archivo y avisa si hay más", async () => {
    const user = userEvent.setup();
    renderTable();
    await screen.findByTestId("history-row-t-1");
    await user.click(screen.getByRole("button", { name: "Rechazadas" }));
    await user.selectOptions(screen.getByLabelText("Vía"), "bandeja");
    await waitFor(() => expect(mockList).toHaveBeenLastCalledWith({ page: 1, limit: 10, status: "rejected", via: "bandeja" }));

    await user.click(screen.getByRole("button", { name: /Exportar CSV/ }));

    await waitFor(() => expect(downloadFile).toHaveBeenCalledTimes(1));
    expect(mockList).toHaveBeenLastCalledWith({ page: 1, limit: 500, status: "rejected", via: "bandeja" });
    const [{ blob, filename }] = jest.mocked(downloadFile).mock.calls[0];
    expect(filename).toMatch(/^powip_historial_unificacion_\d{4}-\d{2}-\d{2}\.csv$/);
    expect(blob.type).toBe("text/csv;charset=utf-8");
    const notice = await screen.findByRole("status");
    expect(notice).toHaveTextContent("Se exportaron los 3 registros más recientes de 23. Acota las fechas para exportar el resto.");
    expect(toast.warning).toHaveBeenCalledWith(expect.stringContaining("de 23"));
  });

  it("«Exportar CSV» con todo dentro del tope no avisa; sin filas no descarga", async () => {
    const user = userEvent.setup();
    renderTable();
    await screen.findByTestId("history-row-t-1");
    mockList.mockResolvedValueOnce({ ...PAGE, meta: { page: 1, limit: 500, total: 3, totalPages: 1 } });
    await user.click(screen.getByRole("button", { name: /Exportar CSV/ }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Se exportaron 3 registros."));
    expect(downloadFile).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();

    mockList.mockResolvedValueOnce({ data: [], meta: { page: 1, limit: 500, total: 0, totalPages: 0 } });
    await user.click(screen.getByRole("button", { name: /Exportar CSV/ }));
    expect(await screen.findByRole("status")).toHaveTextContent("No hay registros para exportar con estos filtros.");
    expect(downloadFile).toHaveBeenCalledTimes(1);
  });
});
