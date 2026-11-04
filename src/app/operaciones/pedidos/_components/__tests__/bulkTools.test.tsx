/**
 * Selección, exportación y acciones masivas con paginación en servidor (useBulkTools).
 *
 * - "Seleccionar los N pedidos del filtro" baja todo el filtro con progreso (tope 2.000).
 * - Exportar Excel sin selección exporta TODO el filtro paginando por dentro, con progreso y cancelación
 *   (tope 10.000); con selección exporta lo seleccionado que sigue visible. Nunca corta en silencio.
 * - Cambiar estado y WhatsApp masivo piden confirmación con la cantidad real cuando superan una página;
 *   WhatsApp abre máximo 50 ventanas por clic y quita las atendidas de la selección.
 */
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import axios from "@/lib/axiosAuth";
import { toast } from "sonner";
import { OrderDetailModalProvider } from "@/components/orders/OrderDetailModal";
import { PreparadosTab } from "../PreparadosTab";
import { ClosedTab } from "../ClosedTab";
import { emptyTabState, type OperationsTabData } from "../tabState";
import { mapOrderToSale, type PedidosActions, type Sale } from "../types";
import type { OrderHeader } from "@/interfaces/IOrder";

jest.mock("@/lib/axiosAuth", () => ({ __esModule: true, default: { get: jest.fn() } }));
jest.mock("sonner", () => ({ toast: { info: jest.fn(), error: jest.fn(), success: jest.fn(), warning: jest.fn() } }));
jest.mock("@/contexts/BusinessScopeContext", () => ({ useBusinessScope: () => ({ storeIds: ["store-a"], canFetch: true }) }));
jest.mock("@/hooks/useOperationsPedidos", () => ({
  ...jest.requireActual("@/hooks/useOperationsPedidos"),
  useVisibleSelection: () => ({ visibleIds: null, loading: false }),
}));
jest.mock("@/components/ui/calendar", () => ({ Calendar: () => null }));
jest.mock("next/image", () => ({ __esModule: true, default: () => null }));
jest.mock("@/components/ventas/SalesTableFilters", () => ({
  ...jest.requireActual("@/components/ventas/SalesTableFilters"),
  SalesTableFilters: () => null,
}));
// "Cambiar estado" real es un select de Radix: aquí un botón que dispara el mismo callback.
jest.mock("@/components/ventas/BulkStatusSelect", () => ({
  BulkStatusSelect: ({ onStatusChange }: { onStatusChange: (status: string) => void }) => (
    <button onClick={() => onStatusChange("LLAMADO")}>Cambiar estado a Contactado</button>
  ),
}));

function makeOrder(n: number, status: "PREPARADO" | "ENTREGADO" = "PREPARADO"): OrderHeader {
  const at = new Date(Date.UTC(2026, 9, 1, 12, 0, 0) + n * 60_000).toISOString();
  return {
    id: `o-${n}`, orderNumber: `PED-${String(n).padStart(4, "0")}`,
    customer: { id: `c-${n}`, fullName: `Cliente ${n}`, phoneNumber: "999111222" },
    deliveryType: "DOMICILIO", grandTotal: "50.00", status, salesRegion: "LIMA", items: [], payments: [],
    created_at: at, updated_at: at,
  } as unknown as OrderHeader;
}

/** Simula `GET /order-header/business/operations` paginando `total` pedidos. */
function serveOrders(total: number, status: "PREPARADO" | "ENTREGADO" = "PREPARADO") {
  jest.mocked(axios.get).mockImplementation(async (url: string) => {
    const params = new URL(url, "http://x").searchParams;
    const page = Number(params.get("page"));
    const limit = Number(params.get("limit"));
    const from = (page - 1) * limit;
    const data = Array.from({ length: Math.max(0, Math.min(limit, total - from)) }, (_, i) => makeOrder(from + i + 1, status));
    return { data: { data, total, page, totalPages: Math.max(1, Math.ceil(total / limit)), window: { days: 30, from: null, to: null, explicit: false } } };
  });
}
const requestedPages = () => jest.mocked(axios.get).mock.calls.map(([url]) => new URL(url as string, "http://x").searchParams);

function makeActions(overrides: Partial<PedidosActions> = {}): PedidosActions {
  return {
    can: () => true, apiCouriers: [], salesChannels: [], isBulkLoading: false,
    onExportExcel: jest.fn(), onBulkStatusChange: jest.fn(), onBulkWhatsApp: jest.fn(), onCopySelected: jest.fn(),
    onOpenCreateGuide: jest.fn(), onSyncCourier: jest.fn(), onWhatsApp: jest.fn(),
    ...overrides,
  } as unknown as PedidosActions;
}

function pageOf(count: number, status: "PREPARADO" | "ENTREGADO" = "PREPARADO"): Sale[] {
  return Array.from({ length: count }, (_, i) => mapOrderToSale(makeOrder(i + 1, status)));
}

function makeData(sales: Sale[], total: number): OperationsTabData {
  return { sales, total, totalPages: Math.ceil(total / 15), loading: false, fetching: false, counts: undefined, metadata: { couriers: [], channels: [], products: [] } };
}

function renderPreparados(total: number, actions = makeActions(), rows = 15, filters: Partial<ReturnType<typeof emptyTabState>["filters"]> = {}) {
  const state = { ...emptyTabState(), filters: { ...emptyTabState().filters, ...filters } };
  render(
    <PreparadosTab data={makeData(pageOf(rows), total)} state={state} query={{ tab: "preparados", page: 1, limit: 15, filters: state.filters }} onState={jest.fn()} actions={actions} />,
    { wrapper: OrderDetailModalProvider },
  );
  return actions;
}

const selectPage = () => fireEvent.click(screen.getByRole("checkbox", { name: /seleccionar la página/i }));
const banner = () => screen.queryByTestId("select-filter-banner");

beforeEach(() => {
  jest.clearAllMocks();
});

describe("Seleccionar los N pedidos del filtro", () => {
  it("al marcar la página ofrece seleccionar todo el filtro; al aceptar baja todo y avisa el total", async () => {
    serveOrders(120);
    renderPreparados(120);

    expect(banner()).not.toBeInTheDocument();
    selectPage();
    expect(banner()).toHaveTextContent("Seleccionaste 15 pedidos.");

    fireEvent.click(screen.getByRole("button", { name: /seleccionar los 120 pedidos del filtro/i }));

    await waitFor(() => expect(banner()).toHaveTextContent(/están seleccionados los 120 pedidos del filtro/i));
    expect(screen.getByText("120 seleccionados")).toBeInTheDocument();
    expect(toast.success).toHaveBeenCalledWith("120 pedidos seleccionados");
    // Bajó de a 100: dos páginas, sin vista por guía ni resumen.
    const pages = requestedPages();
    expect(pages.map((p) => p.get("page"))).toEqual(["1", "2"]);
    expect(pages.every((p) => p.get("limit") === "100" && p.get("includeSummary") === "false" && p.get("tab") === "preparados")).toBe(true);
  });

  it("muestra el progreso mientras baja y permite cancelar sin seleccionar nada", async () => {
    let release: () => void = () => {};
    jest.mocked(axios.get).mockImplementation(
      () => new Promise((resolve) => { release = () => resolve({ data: { data: [], total: 120, page: 1, totalPages: 2, window: {} } }); }),
    );
    renderPreparados(120);
    selectPage();
    fireEvent.click(screen.getByRole("button", { name: /seleccionar los 120 pedidos del filtro/i }));

    const progress = await screen.findByTestId("bulk-progress");
    expect(progress).toHaveTextContent(/seleccionando/i);
    fireEvent.click(within(progress).getByRole("button", { name: /cancelar/i }));
    release();

    await waitFor(() => expect(screen.queryByTestId("bulk-progress")).not.toBeInTheDocument());
    expect(screen.getByText("15 seleccionados")).toBeInTheDocument();
  });

  it("si el filtro supera 2.000 pedidos no ofrece seleccionarlos y pide afinar", () => {
    renderPreparados(2500);
    selectPage();

    expect(banner()).toHaveTextContent(/el filtro tiene 2.500 pedidos y el máximo para seleccionarlos todos es 2.000/i);
    expect(screen.queryByRole("button", { name: /seleccionar los 2.500/i })).not.toBeInTheDocument();
    expect(axios.get).not.toHaveBeenCalled();
  });

  it("si cabe en una página no hay banner", () => {
    renderPreparados(15);
    selectPage();
    expect(banner()).not.toBeInTheDocument();
  });

  it("'Limpiar selección' del banner la vacía", async () => {
    serveOrders(40);
    renderPreparados(40);
    selectPage();
    fireEvent.click(screen.getByRole("button", { name: /seleccionar los 40 pedidos del filtro/i }));
    await waitFor(() => expect(banner()).toHaveTextContent(/están seleccionados los 40/i));

    fireEvent.click(within(banner()!).getByRole("button", { name: /limpiar selección/i }));
    expect(screen.getByText("0 seleccionados")).toBeInTheDocument();
  });
});

describe("Exportar Excel de todo el filtro", () => {
  it("sin selección exporta TODO el filtro paginando por dentro, con su cantidad en el botón", async () => {
    serveOrders(230);
    const actions = renderPreparados(230, makeActions(), 15, { product: "var-cafe", dateFrom: "2026-10-01" });

    const button = screen.getByRole("button", { name: /exportar excel \(230\)/i });
    expect(button).toBeEnabled();
    fireEvent.click(button);

    await waitFor(() => expect(actions.onExportExcel).toHaveBeenCalledTimes(1));
    const [rows, tab, product] = (actions.onExportExcel as jest.Mock).mock.calls[0];
    expect(rows).toHaveLength(230);
    expect(new Set(rows.map((s: Sale) => s.id)).size).toBe(230);
    expect(tab).toBe("preparados");
    expect(product).toBe("var-cafe");
    // 3 páginas de 100; los filtros viajan en cada una.
    const pages = requestedPages();
    expect(pages.map((p) => p.get("page"))).toEqual(["1", "2", "3"]);
    expect(pages.every((p) => p.get("product") === "var-cafe" && p.get("dateFrom") === "2026-10-01")).toBe(true);
  });

  it("mientras prepara muestra el progreso y deshabilita el botón", async () => {
    let release: () => void = () => {};
    jest.mocked(axios.get).mockImplementation(
      () => new Promise((resolve) => { release = () => resolve({ data: { data: [makeOrder(1)], total: 1, page: 1, totalPages: 1, window: {} } }); }),
    );
    renderPreparados(1, makeActions(), 1);
    fireEvent.click(screen.getByRole("button", { name: /exportar excel \(1\)/i }));

    expect(await screen.findByTestId("bulk-progress")).toHaveTextContent(/preparando la exportación/i);
    expect(screen.getByRole("button", { name: /exportar excel \(1\)/i })).toBeDisabled();
    release();
    await waitFor(() => expect(screen.queryByTestId("bulk-progress")).not.toBeInTheDocument());
  });

  it("cancelar a la mitad no exporta nada y lo avisa", async () => {
    let release: () => void = () => {};
    jest.mocked(axios.get).mockImplementation(
      () => new Promise((resolve) => { release = () => resolve({ data: { data: [makeOrder(1)], total: 300, page: 1, totalPages: 3, window: {} } }); }),
    );
    const actions = renderPreparados(300);
    fireEvent.click(screen.getByRole("button", { name: /exportar excel \(300\)/i }));
    fireEvent.click(within(await screen.findByTestId("bulk-progress")).getByRole("button", { name: /cancelar/i }));
    release();

    await waitFor(() => expect(toast.info).toHaveBeenCalledWith("Exportación cancelada"));
    expect(actions.onExportExcel).not.toHaveBeenCalled();
  });

  it("si el filtro supera 10.000 pedidos no empieza: avisa, deshabilita el botón y no pide nada", () => {
    const actions = renderPreparados(10500);

    expect(screen.getByTestId("export-too-many")).toHaveTextContent(/el filtro tiene 10.500 pedidos y el máximo para exportarlos todos es 10.000/i);
    expect(screen.getByRole("button", { name: /exportar excel \(10500\)/i })).toBeDisabled();
    expect(axios.get).not.toHaveBeenCalled();
    expect(actions.onExportExcel).not.toHaveBeenCalled();
  });

  it("con selección exporta solo lo seleccionado y no baja nada del servidor", () => {
    const actions = renderPreparados(230);
    fireEvent.click(screen.getAllByRole("checkbox")[2]); // un pedido de la página
    fireEvent.click(screen.getByRole("button", { name: /exportar excel \(1\)/i }));

    expect(actions.onExportExcel).toHaveBeenCalledTimes(1);
    expect((actions.onExportExcel as jest.Mock).mock.calls[0][0]).toHaveLength(1);
    expect(axios.get).not.toHaveBeenCalled();
  });

  it("si el servidor falla avisa en vez de exportar a medias", async () => {
    jest.mocked(axios.get).mockRejectedValue(new Error("boom"));
    const actions = renderPreparados(50);
    fireEvent.click(screen.getByRole("button", { name: /exportar excel \(50\)/i }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("No se pudo exportar el filtro completo"));
    expect(actions.onExportExcel).not.toHaveBeenCalled();
  });

  it("las pestañas de cierre exportan todo el filtro con su ventana", async () => {
    serveOrders(130, "ENTREGADO");
    const actions = makeActions();
    const state = emptyTabState();
    render(
      <ClosedTab variant="entregados" data={makeData(pageOf(15, "ENTREGADO"), 130)} state={state} query={{ tab: "entregados", page: 1, limit: 15, filters: state.filters }} onState={jest.fn()} actions={actions} />,
      { wrapper: OrderDetailModalProvider },
    );

    fireEvent.click(screen.getByRole("button", { name: /exportar excel \(130\)/i }));

    await waitFor(() => expect(actions.onExportExcel).toHaveBeenCalledTimes(1));
    expect((actions.onExportExcel as jest.Mock).mock.calls[0][0]).toHaveLength(130);
    expect(requestedPages().every((p) => p.get("tab") === "entregados")).toBe(true);
  });
});

describe("Confirmación de acciones masivas", () => {
  it("cambiar estado de más de una página pide confirmar con la cantidad real", async () => {
    serveOrders(40);
    const actions = renderPreparados(40);
    selectPage();
    fireEvent.click(screen.getByRole("button", { name: /seleccionar los 40 pedidos del filtro/i }));
    await waitFor(() => expect(banner()).toHaveTextContent(/están seleccionados los 40/i));

    fireEvent.click(screen.getByRole("button", { name: /cambiar estado a contactado/i }));

    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent("Vas a cambiar 40 pedidos a «Contactado»");
    expect(actions.onBulkStatusChange).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole("button", { name: "Cambiar 40 pedidos" }));
    expect(actions.onBulkStatusChange).toHaveBeenCalledWith(expect.arrayContaining(["o-1", "o-40"]), "LLAMADO");
    expect((actions.onBulkStatusChange as jest.Mock).mock.calls[0][0]).toHaveLength(40);
  });

  it("'Cancelar' en la confirmación no cambia nada", async () => {
    serveOrders(40);
    const actions = renderPreparados(40);
    selectPage();
    fireEvent.click(screen.getByRole("button", { name: /seleccionar los 40 pedidos del filtro/i }));
    await waitFor(() => expect(banner()).toHaveTextContent(/están seleccionados los 40/i));
    fireEvent.click(screen.getByRole("button", { name: /cambiar estado a contactado/i }));

    fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Cancelar" }));

    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(actions.onBulkStatusChange).not.toHaveBeenCalled();
  });

  it("con una página o menos cambia directo, sin diálogo", () => {
    const actions = renderPreparados(15);
    selectPage();
    fireEvent.click(screen.getByRole("button", { name: /cambiar estado a contactado/i }));

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(actions.onBulkStatusChange).toHaveBeenCalledTimes(1);
  });

  it("WhatsApp masivo de más de 50 abre solo 50, avisa y quita los atendidos de la selección", async () => {
    serveOrders(60);
    const actions = renderPreparados(60, makeActions({ onBulkWhatsApp: jest.fn((list: Sale[]) => Math.min(list.length, 50)) as never }));
    selectPage();
    fireEvent.click(screen.getByRole("button", { name: /seleccionar los 60 pedidos del filtro/i }));
    await waitFor(() => expect(banner()).toHaveTextContent(/están seleccionados los 60/i));

    fireEvent.click(screen.getByRole("button", { name: /whatsapp masivo/i }));
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent("Se abrirán 50 ventanas de las 60 seleccionadas");
    fireEvent.click(within(dialog).getByRole("button", { name: "Abrir 50 ventanas" }));

    expect(actions.onBulkWhatsApp).toHaveBeenCalledTimes(1);
    expect((actions.onBulkWhatsApp as jest.Mock).mock.calls[0][0]).toHaveLength(60);
    // Quedan 10 para el siguiente clic.
    await waitFor(() => expect(screen.getByText("10 seleccionados")).toBeInTheDocument());
  });

  it("WhatsApp masivo de pocos pedidos abre directo, sin diálogo", () => {
    const actions = renderPreparados(15);
    selectPage();
    fireEvent.click(screen.getByRole("button", { name: /whatsapp masivo/i }));

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(actions.onBulkWhatsApp).toHaveBeenCalledTimes(1);
  });
});
