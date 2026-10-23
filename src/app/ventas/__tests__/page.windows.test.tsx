import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

/**
 * Ventas — cada pestaña baja solo lo que muestra (FEAT-27).
 *
 * 1. Pendientes muestra los recientes; los viejos están en "Pendientes antiguos",
 *    que se baja recién al elegirlo y nunca queda sin acceso.
 * 2. Todas no se pide hasta entrar a la pestaña; su número sale del conteo.
 * 3. El período de Anuladas y Todas va al servidor (con debounce) y filtra al instante.
 * 4. Los KPIs tienen su propia consulta por período: dan lo mismo que antes
 *    aunque el período sea más viejo que lo bajado.
 */

jest.mock("axios", () => ({
  default: { get: jest.fn(), patch: jest.fn(), post: jest.fn() },
  get: jest.fn(),
  patch: jest.fn(),
  post: jest.fn(),
}));
jest.mock("@/lib/axiosAuth", () => ({ __esModule: true, default: jest.requireMock("axios") }));
jest.mock("@/contexts/BusinessScopeContext", () => ({ useBusinessScope: () => ({ scopeKey: "company-1:business:store-1", storeIds: ["store-1"] }) }));
jest.mock("@/hooks/useInvalidateBusinessData", () => ({ useInvalidateBusinessData: () => jest.fn() }));
jest.mock("sonner", () => ({
  toast: { success: jest.fn(), error: jest.fn(), warning: jest.fn(), info: jest.fn() },
}));
jest.mock("@/contexts/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  usePathname: () => "/ventas",
}));
jest.mock("@/services/atencionClienteService", () => ({
  enviarPedidoALima: jest.fn(),
  reassignSeller: jest.fn(),
}));
jest.mock("@/hooks/useBusinessOrders", () => ({ useBusinessOrders: jest.fn() }));
jest.mock("@/hooks/useBusinessSalesPage", () => ({ useBusinessSalesPage: jest.fn() }));
jest.mock("@/services/businessSalesService", () => ({ getBusinessSalesExport: jest.fn() }));
jest.mock("@/hooks/useBusinessOrdersCount", () => ({ useBusinessOrdersCount: jest.fn() }));
jest.mock("@/lib/peruDate", () => ({ ...jest.requireActual("@/lib/peruDate"), todayInPeru: () => "2026-09-26" }));
jest.mock("@/utils/exportSalesExcel", () => ({
  ...jest.requireActual("@/utils/exportSalesExcel"),
  exportSalesToExcel: jest.fn(),
}));
// El período de los KPIs lo elige cada test (el selector real avisa el mes actual al montar).
let mockKpiPeriod: [string, string] = ["2026-09-01", "2026-09-30"];
jest.mock("@/components/dashboard/PeriodSelector", () => {
  const { useEffect } = jest.requireActual<typeof import("react")>("react");
  return {
    PeriodSelector: ({ onPeriodChange }: { onPeriodChange: (from: string, to: string) => void }) => {
      useEffect(() => {
        onPeriodChange(mockKpiPeriod[0], mockKpiPeriod[1]);
      }, []); // eslint-disable-line react-hooks/exhaustive-deps
      return null;
    },
  };
});
jest.mock("@/components/modals/CustomerServiceModal", () => ({ __esModule: true, default: () => null }));
jest.mock("@/components/modals/CommentsTimelineModal", () => ({ __esModule: true, default: () => null }));
jest.mock("@/components/modals/PaymentVerificationModal", () => ({ __esModule: true, default: () => null }));
jest.mock("@/components/modals/ImportSalesModal", () => ({ __esModule: true, default: () => null }));
jest.mock("@/components/modals/CreateGuideModal", () => ({ __esModule: true, default: () => null }));
jest.mock("@/components/modals/CancellationModal", () => ({ __esModule: true, default: () => null }));
jest.mock("@/components/modals/ReassignSellerModal", () => ({ __esModule: true, default: () => null }));
jest.mock("@/utils/bulkStatusUtils", () => ({ processBulkStatusChange: jest.fn(async () => ({ success: [], failed: [] })) }));
type BulkActions = {
  onStatusChange: (status: OrderStatus) => Promise<void>;
  onExtraAction: (value: string) => void;
};
const mockBulkActions: BulkActions[] = [];
jest.mock("@/components/ventas/BulkStatusSelect", () => {
  const actual = jest.requireActual("@/components/ventas/BulkStatusSelect");
  return { ...actual, BulkStatusSelect: (props: BulkActions) => {
    mockBulkActions.push(props);
    return <actual.BulkStatusSelect {...props} />;
  } };
});

import { useAuth } from "@/contexts/AuthContext";
import { useBusinessOrders } from "@/hooks/useBusinessOrders";
import { useBusinessSalesPage } from "@/hooks/useBusinessSalesPage";
import { getBusinessSalesExport } from "@/services/businessSalesService";
import { useMemo } from "react";
import { applyFilters, buildProductFilterOptions } from "@/components/ventas/SalesTableFilters";
import { isInPeruWindow } from "@/lib/peruDate";
import { useBusinessOrdersCount } from "@/hooks/useBusinessOrdersCount";
import type { OrderHeader, OrderStatus } from "@/interfaces/IOrder";
import { exportSalesToExcel } from "@/utils/exportSalesExcel";
import { TODAS_STATUSES } from "../useVentasOrders";
import VentasPage from "../page";
import { processBulkStatusChange } from "@/utils/bulkStatusUtils";

const mockUseAuth = jest.mocked(useAuth);
const mockOrders = jest.mocked(useBusinessOrders);
const mockCount = jest.mocked(useBusinessOrdersCount);
const mockExport = jest.mocked(exportSalesToExcel);

type Opts = { statuses?: OrderStatus[]; enabled?: boolean };
type Label = "pendientes" | "antiguos" | "anuladas" | "todas" | "kpis";
type Override = Partial<{ loading: boolean; error: boolean; orders: OrderHeader[] }>;

const PEND: OrderStatus[] = ["PENDIENTE", "PAGADO"];
const KPI: OrderStatus[] = ["PENDIENTE", "PAGADO", "ANULADO"];

function makeOrder(n: number, status: OrderStatus, createdAt: string, updatedAt = createdAt): OrderHeader {
  return {
    id: `o-${n}`,
    orderNumber: `ORD-${n}`,
    customer: { id: `c-${n}`, fullName: `Cliente ${n}`, phoneNumber: "999111222" },
    deliveryType: "DOMICILIO",
    grandTotal: "100.00",
    status,
    salesRegion: "LIMA",
    items: [],
    payments: [],
    created_at: createdAt,
    updated_at: updatedAt,
  } as unknown as OrderHeader;
}

// Hoy (Perú) = 2026-09-26 → recientes desde 08-28, antiguos hasta 08-27.
const RECIENTE = makeOrder(101, "PENDIENTE", "2026-09-20T15:00:00.000Z");
// Llegan del servidor por fecha de creación desc; la vista los ordena por días sin movimiento.
const ANTIGUO_202 = makeOrder(202, "PENDIENTE", "2026-07-15T15:00:00.000Z", "2026-08-20T15:00:00.000Z"); // 37 días
const ANTIGUO_201 = makeOrder(201, "PAGADO", "2026-07-01T15:00:00.000Z", "2026-08-01T15:00:00.000Z"); // 56 días
const ANULADA = makeOrder(301, "ANULADO", "2026-09-10T15:00:00.000Z");
const PREPARADO = makeOrder(401, "PREPARADO", "2026-09-22T15:00:00.000Z");
// KPIs de agosto: 3 pendientes viejos (fuera de la ventana de 30 días) y 1 anulado.
// ORD-505 cae en el día de margen de la consulta (07-31): no cuenta.
const KPI_AGOSTO = [
  makeOrder(501, "PENDIENTE", "2026-08-05T15:00:00.000Z"),
  makeOrder(502, "PENDIENTE", "2026-08-10T15:00:00.000Z"),
  makeOrder(503, "PENDIENTE", "2026-08-15T15:00:00.000Z"),
  makeOrder(504, "ANULADO", "2026-08-12T15:00:00.000Z"),
  makeOrder(505, "PENDIENTE", "2026-07-31T15:00:00.000Z"),
];

const DATA: Record<Label, OrderHeader[]> = {
  pendientes: [RECIENTE],
  antiguos: [ANTIGUO_202, ANTIGUO_201],
  anuladas: [ANULADA],
  todas: [PREPARADO, RECIENTE, ANULADA],
  kpis: KPI_AGOSTO,
};
// Sin `statuses` = el historial completo, lo que pedía la vista antes de FEAT-27.
const HISTORIAL = [PREPARADO, RECIENTE, ANULADA, ANTIGUO_202, ANTIGUO_201, ...KPI_AGOSTO];
const EMPTY: OrderHeader[] = [];

function labelOf(from: string | undefined, opts?: Opts): Label | null {
  const s = opts?.statuses;
  if (!s) return null;
  if (s === TODAS_STATUSES) return "todas";
  if (s.length === 3) return "kpis";
  if (s[0] === "ANULADO") return "anuladas";
  return from === undefined ? "antiguos" : "pendientes";
}

let overrides: Partial<Record<Label, Override>> = {};
let retries: Record<Label, jest.Mock>;
let counts: { todas: number | null; antiguos: number | null };

beforeEach(() => {
  jest.clearAllMocks();
  mockBulkActions.length = 0;
  mockKpiPeriod = ["2026-09-01", "2026-09-30"];
  overrides = {};
  retries = { pendientes: jest.fn(), antiguos: jest.fn(), anuladas: jest.fn(), todas: jest.fn(), kpis: jest.fn() };
  counts = { todas: 1011, antiguos: 2 };
  mockUseAuth.mockReturnValue({
    auth: {
      user: { id: "user-1", name: "Ana", surname: "V", role: "ADMIN", permissions: [] },
      company: { id: "company-1", name: "Powip Test", stores: [] },
    },
    selectedStoreId: "store-1",
  } as unknown as ReturnType<typeof useAuth>);
  mockOrders.mockImplementation((from?: string, _to?: string, opts?: Opts) => {
    const label = labelOf(from, opts);
    const orders = label === null ? HISTORIAL : opts?.enabled === false ? EMPTY : DATA[label];
    return {
      orders,
      loading: false,
      error: false,
      retry: label ? retries[label] : jest.fn(),
      refetch: jest.fn(),
      ...(label ? overrides[label] : {}),
    } as unknown as ReturnType<typeof useBusinessOrders>;
  });
  jest.mocked(useBusinessSalesPage).mockImplementation((_ids, query) => {
    const label: Label = query.tab === "pendientes" && query.sort === "updated_asc" ? "antiguos" : query.tab;
    const override = overrides[label];
    const source = override?.orders ?? DATA[label];
    const kpiSource = overrides.kpis?.orders ?? DATA.kpis;
    const businessTotal = counts.todas;
    const antiguosTotal = counts.antiguos;
    const result = useMemo(() => {
      const orders = source.filter(order => isInPeruWindow(order.created_at, { fromDate: query.dateFrom ?? "", toDate: query.dateTo ?? "" }))
        .sort((a, b) => query.sort === "updated_asc" ? Date.parse(a.updated_at) - Date.parse(b.updated_at) : Date.parse(b.created_at) - Date.parse(a.created_at));
      const kpiRows = kpiSource.filter(order => isInPeruWindow(order.created_at, { fromDate: query.kpiDateFrom ?? "", toDate: query.kpiDateTo ?? "" }));
      const balances = new Map<string, { currency: string | null; paid: number; pending: number }>();
      for (const order of kpiRows.filter(row => PEND.includes(row.status))) {
        const currency = order.currency ?? null;
        const key = currency ?? "UNKNOWN";
        const group = balances.get(key) ?? { currency, paid: 0, pending: 0 };
        group.pending += Number(order.grandTotal);
        balances.set(key, group);
      }
      return {
        data: override?.loading || override?.error ? EMPTY : orders.slice((query.page - 1) * query.limit, query.page * query.limit),
        total: orders.length, page: query.page, totalPages: Math.max(1, Math.ceil(orders.length / query.limit)),
        counts: { pendientes: DATA.pendientes.length, anuladas: DATA.anuladas.length, todas: businessTotal, pendientesAntiguos: antiguosTotal },
        kpis: { pendientes: kpiRows.filter(row => PEND.includes(row.status)).length, anuladas: kpiRows.filter(row => row.status === "ANULADO").length, amounts: [...balances.values()] },
        metadata: { products: [] },
      };
    }, [source, kpiSource, query.page, query.limit, query.sort, query.dateFrom, query.dateTo, query.kpiDateFrom, query.kpiDateTo, override?.loading, override?.error, businessTotal, antiguosTotal]);
    return { data: result, isFetching: !!override?.loading || !!overrides.kpis?.loading, isError: !!override?.error || !!overrides.kpis?.error, isDebouncing: false, refetch: overrides.kpis?.error ? retries.kpis : retries[label] } as unknown as ReturnType<typeof useBusinessSalesPage>;
  });
  jest.mocked(getBusinessSalesExport).mockImplementation(async (_ids, query) => {
    const label: Label = query.tab === "pendientes" && query.sort === "updated_asc" ? "antiguos" : query.tab;
    return [...(overrides[label]?.orders ?? DATA[label])].filter(order => isInPeruWindow(order.created_at, { fromDate: query.dateFrom ?? "", toDate: query.dateTo ?? "" }))
      .sort((a, b) => query.sort === "updated_asc" ? Date.parse(a.updated_at) - Date.parse(b.updated_at) : Date.parse(b.created_at) - Date.parse(a.created_at));
  });
  mockCount.mockImplementation((_from, _to, opts) => ({
    count: opts?.statuses === TODAS_STATUSES ? counts.todas : counts.antiguos,
    loading: false,
    error: false,
    retry: jest.fn(),
    refetch: jest.fn(),
  }) as unknown as ReturnType<typeof useBusinessOrdersCount>);
});

const ordersIn = (panel: HTMLElement) =>
  within(panel)
    .queryAllByText(/^ORD-\d+$/)
    .map((el) => el.textContent);

const callsFor = (statuses: OrderStatus[]) =>
  mockOrders.mock.calls.filter(([, , o]) => o?.statuses === statuses);

/** Número de una tarjeta de KPI (el <h3> al lado de su título). */
const kpiValue = (title: string) =>
  screen.getByText(title, { selector: "p" }).parentElement?.querySelector("h3")?.textContent;

describe("VentasPage — Pendientes recientes y antiguos", () => {
  it("muestra los recientes y ofrece Pendientes antiguos con su contador", () => {
    render(<VentasPage />);
    const panel = screen.getByRole("tabpanel");

    expect(ordersIn(panel)).toEqual(["ORD-101"]);
    expect(within(panel).getByRole("button", { name: "Recientes" })).toHaveAttribute("aria-pressed", "true");
    const antiguos = within(panel).getByRole("button", { name: "Pendientes antiguos (2)" });
    expect(antiguos).toBeEnabled();
    expect(antiguos).toHaveAttribute("aria-pressed", "false");
    expect(within(panel).getByText("Los pendientes de más de 30 días están en Pendientes antiguos")).toBeInTheDocument();
  });

  it("baja los antiguos recién al elegirlos, primero los que llevan más días sin movimiento", () => {
    render(<VentasPage />);
    expect(jest.mocked(useBusinessSalesPage).mock.calls.every(([, query]) => query.sort !== "updated_asc")).toBe(true);
    expect(jest.mocked(useBusinessSalesPage).mock.calls.at(-1)?.[1]).toEqual(expect.objectContaining({ dateFrom: "2026-08-28", limit: 10 }));

    fireEvent.click(screen.getByRole("button", { name: "Pendientes antiguos (2)" }));

    expect(useBusinessSalesPage).toHaveBeenLastCalledWith(["store-1"], expect.objectContaining({ dateTo: "2026-08-27", sort: "updated_asc", limit: 10 }));
    const panel = screen.getByRole("tabpanel");
    expect(ordersIn(panel)).toEqual(["ORD-201", "ORD-202"]);
    expect(within(panel).getByText("56 días sin movimiento")).toBeInTheDocument();
    expect(within(panel).getByText("37 días sin movimiento")).toBeInTheDocument();
    expect(within(panel).getByRole("button", { name: "Pendientes antiguos (2)" })).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(within(panel).getByRole("button", { name: "Recientes" }));
    expect(ordersIn(panel)).toEqual(["ORD-101"]);
  });

  it("al cambiar entre Recientes y Antiguos se vacía la selección", () => {
    render(<VentasPage />);
    const panel = screen.getByRole("tabpanel");
    fireEvent.click(within(panel).getAllByRole("checkbox")[0]);
    expect(screen.getByRole("button", { name: /Imprimir seleccionados \(1\)/ })).toBeEnabled();

    fireEvent.click(within(panel).getByRole("button", { name: "Pendientes antiguos (2)" }));
    expect(screen.getByRole("button", { name: /Imprimir seleccionados \(0\)/ })).toBeDisabled();

    fireEvent.click(within(panel).getByRole("button", { name: "Recientes" }));
    expect(screen.getByRole("button", { name: /Imprimir seleccionados \(0\)/ })).toBeDisabled();
  });

  it("al volver a Recientes deja de pedir los antiguos", () => {
    render(<VentasPage />);
    const lastQuery = () => jest.mocked(useBusinessSalesPage).mock.calls.at(-1)?.[1];

    fireEvent.click(screen.getByRole("button", { name: "Pendientes antiguos (2)" }));
    expect(lastQuery()).toEqual(expect.objectContaining({ dateTo: "2026-08-27", sort: "updated_asc" }));

    fireEvent.click(screen.getByRole("button", { name: "Recientes" }));
    expect(lastQuery()).toEqual(expect.objectContaining({ dateFrom: "2026-08-28", sort: "created_desc" }));
  });

  it("si el contador no está (carga o falla), el acceso sigue habilitado y sin número", () => {
    counts.antiguos = null;
    render(<VentasPage />);
    const antiguos = screen.getByRole("button", { name: "Pendientes antiguos" });
    expect(antiguos).toBeEnabled();

    fireEvent.click(antiguos);

    expect(ordersIn(screen.getByRole("tabpanel"))).toEqual(["ORD-201", "ORD-202"]);
  });

  it("con 0 antiguos el botón queda deshabilitado", () => {
    counts.antiguos = 0;
    render(<VentasPage />);
    expect(screen.getByRole("button", { name: "Pendientes antiguos" })).toBeDisabled();
  });

  it("la carga y el error de antiguos se ven dentro de la tabla, sin tapar la página", () => {
    overrides.antiguos = { loading: true };
    const { rerender } = render(<VentasPage />);
    fireEvent.click(screen.getByRole("button", { name: "Pendientes antiguos (2)" }));
    const panel = screen.getByRole("tabpanel");
    expect(within(panel).getByText("Cargando pendientes antiguos...")).toBeInTheDocument();
    expect(within(panel).getByRole("table")).toBeInTheDocument();

    overrides.antiguos = { error: true };
    rerender(<VentasPage />);
    expect(within(panel).getByRole("alert")).toHaveTextContent("No se pudieron cargar los pendientes antiguos.");
    fireEvent.click(within(panel).getByRole("button", { name: "Reintentar" }));
    expect(retries.antiguos).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("tab", { name: /Todas las Ventas/ })).toBeInTheDocument();
  });
});

describe("VentasPage — Anuladas y Todas por período", () => {
  it("Todas no se pide hasta entrar a la pestaña", () => {
    render(<VentasPage />);
    expect(jest.mocked(useBusinessSalesPage).mock.calls.every(([, query]) => query.tab !== "todas")).toBe(true);
    expect(useBusinessSalesPage).toHaveBeenLastCalledWith(["store-1"], expect.objectContaining({ tab: "pendientes", page: 1, limit: 10 }));

    fireEvent.mouseDown(screen.getByRole("tab", { name: /Todas las Ventas/ }));

    expect(useBusinessSalesPage).toHaveBeenLastCalledWith(["store-1"], expect.objectContaining({ tab: "todas", dateFrom: "2026-08-28", limit: 10 }));
    expect(ordersIn(screen.getByRole("tabpanel"))).toEqual(["ORD-401", "ORD-101", "ORD-301"]);
  });

  it("el número de Todas sale del conteo hasta que baja la lista; después cuenta lo que muestra", () => {
    overrides.todas = { loading: true };
    const { rerender } = render(<VentasPage />);
    const tab = () => screen.getByRole("tab", { name: /Todas las Ventas/ });
    expect(tab()).toHaveTextContent(/Todas las Ventas\s*1011$/);

    fireEvent.mouseDown(tab());
    expect(within(screen.getByRole("tabpanel")).getByText("Cargando ventas...")).toBeInTheDocument();
    expect(tab()).toHaveTextContent(/Todas las Ventas\s*1011$/);

    overrides.todas = {};
    rerender(<VentasPage />);
    expect(within(screen.getByRole("tabpanel")).queryByText("Cargando ventas...")).not.toBeInTheDocument();
    expect(tab()).toHaveTextContent(/Todas las Ventas\s*1011$/);
  });

  it("sin conteo, la pestaña Todas no muestra número", () => {
    counts.todas = null;
    render(<VentasPage />);
    expect(screen.getByRole("tab", { name: /Todas las Ventas/ })).toHaveTextContent(/^Todas las Ventas$/);
  });

  it("el atajo de 7 días filtra al instante y pide su ventana con debounce", async () => {
    render(<VentasPage />);
    fireEvent.mouseDown(screen.getByRole("tab", { name: /Todas las Ventas/ }));
    const panel = screen.getByRole("tabpanel");
    expect(within(panel).getByLabelText("Desde")).toHaveValue("2026-08-28");

    fireEvent.click(within(panel).getByRole("button", { name: "7 días" }));

    expect(within(panel).getByLabelText("Desde")).toHaveValue("2026-09-20");
    expect(ordersIn(panel)).toEqual(["ORD-401", "ORD-101"]); // ORD-301 (09-10) sale de la ventana
    await waitFor(
      () => expect(useBusinessSalesPage).toHaveBeenLastCalledWith(["store-1"], expect.objectContaining({ tab: "todas", dateFrom: "2026-09-20", limit: 10 })),
      { timeout: 2000 },
    );
    expect(jest.mocked(useBusinessSalesPage).mock.calls.at(-1)?.[1].dateFrom).toBe("2026-09-20");
  });

  it("Anuladas: el período va al servidor y si falla, el error queda en la pestaña con Reintentar", async () => {
    render(<VentasPage />);
    fireEvent.mouseDown(screen.getByRole("tab", { name: /Ventas Anuladas/ }));
    const panel = screen.getByRole("tabpanel");
    expect(ordersIn(panel)).toEqual(["ORD-301"]);

    overrides.anuladas = { error: true };
    fireEvent.click(within(panel).getByRole("button", { name: "15 días" }));

    await waitFor(
      () => expect(useBusinessSalesPage).toHaveBeenLastCalledWith(["store-1"], expect.objectContaining({ tab: "anuladas", dateFrom: "2026-09-12", limit: 10 })),
      { timeout: 2000 },
    );
    expect(within(panel).getByRole("alert")).toHaveTextContent("No se pudieron cargar las ventas de este período.");
    fireEvent.click(within(panel).getByRole("button", { name: "Reintentar" }));
    expect(retries.anuladas).toHaveBeenCalled();
    expect(screen.getByRole("tab", { name: /Todas las Ventas/ })).toBeInTheDocument();
  });
});

describe("VentasPage — Anuladas, Todas y Pendientes antiguos no muestran ni usan una lista a medio bajar", () => {
  it.each(["loading", "error"] as const)("bloquea cambios y callbacks previos si antiguos seleccionados quedan en %s", async (state) => {
    const { rerender } = render(<VentasPage />);
    fireEvent.click(screen.getByRole("button", { name: "Pendientes antiguos (2)" }));
    const row = screen.getByText("ORD-201").closest("tr")!;
    fireEvent.click(within(row).getByRole("checkbox"));
    const previousActions = mockBulkActions.at(-1)!;
    const bulkControl = () => within(screen.getByRole("tabpanel")).getAllByRole("combobox")[0];
    expect(bulkControl()).toBeEnabled();

    // React Query conserva los datos anteriores al fallar o revalidar.
    overrides.antiguos = state === "loading" ? { loading: true } : { error: true };
    rerender(<VentasPage />);

    expect(ordersIn(screen.getByRole("tabpanel"))).toEqual([]);
    expect(bulkControl()).toBeDisabled();
    await act(async () => { await previousActions.onStatusChange("PREPARADO"); });
    act(() => previousActions.onExtraAction("__REPROGRAMAR__"));
    expect(processBulkStatusChange).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it.each(["loading", "error"] as const)("no reprograma una selección anterior desde un diálogo abierto si antiguos quedan en %s", async (state) => {
    const { rerender } = render(<VentasPage />);
    fireEvent.click(screen.getByRole("button", { name: "Pendientes antiguos (2)" }));
    fireEvent.click(within(screen.getByText("ORD-201").closest("tr")!).getByRole("checkbox"));
    act(() => mockBulkActions.at(-1)!.onExtraAction("__REPROGRAMAR__"));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    overrides.antiguos = state === "loading" ? { loading: true } : { error: true };
    rerender(<VentasPage />);
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Confirmar" }));
    expect(processBulkStatusChange).not.toHaveBeenCalled();
  });

  it("mientras Todas baja no lista los pedidos de otras consultas ni exporta; al llegar muestra la página completa", async () => {
    overrides.todas = { loading: true, orders: EMPTY };
    const { rerender } = render(<VentasPage />);
    fireEvent.mouseDown(screen.getByRole("tab", { name: /Todas las Ventas/ }));
    const panel = () => screen.getByRole("tabpanel");
    const exportar = () => within(panel()).getByRole("button", { name: /Exportar Excel/ });

    expect(within(panel()).getByText("Cargando ventas...")).toBeInTheDocument();
    expect(ordersIn(panel())).toEqual([]); // no ORD-101 ni ORD-301, que trajeron Pendientes y Anuladas
    expect(exportar()).toBeDisabled();
    fireEvent.click(exportar());
    expect(mockExport).not.toHaveBeenCalled();
    expect(screen.getByRole("tab", { name: /Todas las Ventas/ })).toHaveTextContent(/Todas las Ventas\s*1011$/);

    overrides.todas = {};
    rerender(<VentasPage />);

    expect(ordersIn(panel())).toEqual(["ORD-401", "ORD-101", "ORD-301"]);
    fireEvent.click(exportar());
    await waitFor(() => expect(mockExport).toHaveBeenCalledTimes(1));
    expect(mockExport.mock.calls[0][0].map((r) => r.orderNumber)).toEqual(["ORD-401", "ORD-101", "ORD-301"]);
  });

  it("al agrandar el período de Anuladas no muestra lo bajado antes como si fuera el período nuevo", async () => {
    const { rerender } = render(<VentasPage />);
    fireEvent.mouseDown(screen.getByRole("tab", { name: /Ventas Anuladas/ }));
    const panel = screen.getByRole("tabpanel");
    const tab = () => screen.getByRole("tab", { name: /Ventas Anuladas/ });
    expect(ordersIn(panel)).toEqual(["ORD-301"]);
    expect(tab()).toHaveTextContent(/Ventas Anuladas\s*1$/);

    overrides.anuladas = { loading: true };
    fireEvent.change(within(panel).getByLabelText("Desde"), { target: { value: "2026-08-01" } });

    expect(within(panel).getByText("Cargando ventas...")).toBeInTheDocument();
    expect(ordersIn(panel)).toEqual([]);
    expect(tab()).toHaveTextContent(/^Ventas Anuladas$/);
    expect(within(panel).getByRole("button", { name: /Exportar Excel/ })).toBeDisabled();

    overrides.anuladas = {};
    rerender(<VentasPage />);
    await waitFor(() => expect(ordersIn(panel)).toEqual(["ORD-301"]), { timeout: 2000 });
    expect(useBusinessSalesPage).toHaveBeenLastCalledWith(["store-1"], expect.objectContaining({ tab: "anuladas", dateFrom: "2026-08-01", limit: 10 }));
    expect(tab()).toHaveTextContent(/Ventas Anuladas\s*1$/);
    expect(within(panel).getByRole("button", { name: /Exportar Excel/ })).toBeEnabled();
  });

  it("mientras Pendientes antiguos baja no lista los antiguos que trajo Todas ni exporta; al llegar muestra la página completa", async () => {
    // Todas ampliada a más de 30 días ya trajo uno de los antiguos
    overrides.todas = { orders: [PREPARADO, RECIENTE, ANULADA, ANTIGUO_202] };
    overrides.antiguos = { loading: true, orders: EMPTY };
    const { rerender } = render(<VentasPage />);
    fireEvent.mouseDown(screen.getByRole("tab", { name: /Todas las Ventas/ }));
    fireEvent.mouseDown(screen.getByRole("tab", { name: /Pendientes/ }));
    fireEvent.click(screen.getByRole("button", { name: "Pendientes antiguos (2)" }));
    const panel = () => screen.getByRole("tabpanel");
    const exportar = () => within(panel()).getByRole("button", { name: /Exportar Excel/ });

    expect(within(panel()).getByText("Cargando pendientes antiguos...")).toBeInTheDocument();
    expect(ordersIn(panel())).toEqual([]); // no ORD-202, que trajo Todas
    expect(exportar()).toBeDisabled();
    fireEvent.click(exportar());
    expect(mockExport).not.toHaveBeenCalled();

    overrides.antiguos = {};
    rerender(<VentasPage />);

    expect(ordersIn(panel())).toEqual(["ORD-201", "ORD-202"]);
    fireEvent.click(exportar());
    await waitFor(() => expect(mockExport).toHaveBeenCalledTimes(1));
    expect(mockExport.mock.calls[0][0].map((r) => r.orderNumber)).toEqual(["ORD-201", "ORD-202"]);
  });

  it("al cambiar el período de Todas o de Anuladas se vacía la selección de esa pestaña", () => {
    render(<VentasPage />);
    fireEvent.mouseDown(screen.getByRole("tab", { name: /Todas las Ventas/ }));
    let panel = screen.getByRole("tabpanel");
    fireEvent.click(within(panel).getAllByRole("checkbox")[0]);
    expect(within(panel).getByRole("button", { name: /Imprimir seleccionados \(3\)/ })).toBeEnabled();

    fireEvent.click(within(panel).getByRole("button", { name: "7 días" }));
    expect(ordersIn(panel)).toEqual(["ORD-401", "ORD-101"]);
    expect(within(panel).getByRole("button", { name: /Imprimir seleccionados \(0\)/ })).toBeDisabled();

    fireEvent.mouseDown(screen.getByRole("tab", { name: /Ventas Anuladas/ }));
    panel = screen.getByRole("tabpanel");
    fireEvent.click(within(panel).getAllByRole("checkbox")[0]);
    expect(within(panel).getByRole("button", { name: /Imprimir seleccionados \(1\)/ })).toBeEnabled();

    fireEvent.change(within(panel).getByLabelText("Desde"), { target: { value: "2026-09-01" } });
    expect(ordersIn(panel)).toEqual(["ORD-301"]);
    expect(within(panel).getByRole("button", { name: /Imprimir seleccionados \(0\)/ })).toBeDisabled();
  });
});

describe("VentasPage — KPIs por período", () => {
  it("conserva las monedas de la consulta KPI aunque el período quede fuera de las pestañas cargadas", async () => {
    mockKpiPeriod = ["2026-08-01", "2026-08-31"];
    overrides.kpis = { orders: [
      { ...KPI_AGOSTO[0], currency: "PEN", grandTotal: "110.00" },
      { ...KPI_AGOSTO[1], currency: "USD", grandTotal: "25.00" },
    ] };
    render(<VentasPage />);
    await waitFor(() => expect(kpiValue("Por cobrar")).toBe("S/ 110.00USD 25.00"));
    expect(kpiValue("Adelantado")).toBe("S/ 0.00USD 0.00");
    expect(ordersIn(screen.getByRole("tabpanel"))).toEqual(["ORD-101"]);
  });

  it("mientras cargan, las tarjetas muestran …", () => {
    overrides.kpis = { loading: true };
    render(<VentasPage />);
    expect(kpiValue("Pendientes")).toBe("…");
    expect(kpiValue("Anuladas")).toBe("…");
    expect(kpiValue("Por cobrar")).toBe("…");
    expect(kpiValue("Adelantado")).toBe("…");
  });

  it("si fallan, avisan con Reintentar y no muestran 0", () => {
    overrides.kpis = { error: true };
    render(<VentasPage />);
    expect(screen.getByText("No se pudieron calcular las estadísticas.")).toBeInTheDocument();
    for (const title of ["Pendientes", "Anuladas", "Por cobrar", "Adelantado"]) {
      expect(kpiValue(title)).not.toMatch(/^(0|S\/ 0\.00)$/);
    }

    fireEvent.click(screen.getAllByRole("button", { name: "Reintentar" })[0]);

    expect(retries.kpis).toHaveBeenCalledTimes(1);
  });

  it("un pedido que pasa a Anulado recibe el KPI actualizado de la misma respuesta del servidor", async () => {
    overrides.kpis = { orders: [RECIENTE, ANULADA] };
    const { rerender } = render(<VentasPage />);
    fireEvent.mouseDown(screen.getByRole("tab", { name: /Todas las Ventas/ }));
    await waitFor(() => expect(kpiValue("Anuladas")).toBe("1"));
    expect(kpiValue("Pendientes")).toBe("1");

    // Se anuló el PREPARADO desde Todas: Todas y Anuladas ya lo traen anulado; los KPIs, todavía no.
    const anulado = { ...PREPARADO, status: "ANULADO" as OrderStatus };
    overrides.todas = { orders: [anulado, RECIENTE, ANULADA] };
    overrides.anuladas = { orders: [anulado, ANULADA] };
    overrides.kpis = { orders: [anulado, RECIENTE, ANULADA] };
    rerender(<VentasPage />);

    expect(kpiValue("Anuladas")).toBe("2");
    expect(kpiValue("Pendientes")).toBe("1");
  });

  it("con un período más viejo que la ventana cuentan todo ese período", async () => {
    mockKpiPeriod = ["2026-08-01", "2026-08-31"];
    render(<VentasPage />);

    await waitFor(() => expect(kpiValue("Pendientes")).toBe("3"));
    expect(kpiValue("Anuladas")).toBe("1");
    expect(useBusinessSalesPage).toHaveBeenLastCalledWith(["store-1"], expect.objectContaining({ kpiDateFrom: "2026-08-01", kpiDateTo: "2026-08-31" }));
    expect(ordersIn(screen.getByRole("tabpanel"))).toEqual(["ORD-101"]);
  });
});
