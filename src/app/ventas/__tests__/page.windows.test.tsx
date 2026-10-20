import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

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
jest.mock("@/contexts/BusinessScopeContext", () => ({ useBusinessScope: () => ({ scopeKey: "company-1:business:store-1" }) }));
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
jest.mock("@/hooks/useBusinessOrdersCount", () => ({ useBusinessOrdersCount: jest.fn() }));
jest.mock("@/lib/peruDate", () => ({ ...jest.requireActual("@/lib/peruDate"), todayInPeru: () => "2026-09-26" }));
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

import { useAuth } from "@/contexts/AuthContext";
import { useBusinessOrders } from "@/hooks/useBusinessOrders";
import { useBusinessOrdersCount } from "@/hooks/useBusinessOrdersCount";
import type { OrderHeader, OrderStatus } from "@/interfaces/IOrder";
import { TODAS_STATUSES } from "../useVentasOrders";
import VentasPage from "../page";

const mockUseAuth = jest.mocked(useAuth);
const mockOrders = jest.mocked(useBusinessOrders);
const mockCount = jest.mocked(useBusinessOrdersCount);

type Opts = { statuses?: OrderStatus[]; enabled?: boolean };
type Label = "pendientes" | "antiguos" | "anuladas" | "todas" | "kpis";
type Override = Partial<{ loading: boolean; error: boolean }>;

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
    expect(mockOrders).toHaveBeenCalledWith(undefined, "2026-08-27", { statuses: PEND, enabled: false });
    expect(mockOrders).not.toHaveBeenCalledWith(undefined, "2026-08-27", { statuses: PEND, enabled: true });

    fireEvent.click(screen.getByRole("button", { name: "Pendientes antiguos (2)" }));

    expect(mockOrders).toHaveBeenCalledWith(undefined, "2026-08-27", { statuses: PEND, enabled: true });
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
    expect(callsFor(TODAS_STATUSES).length).toBeGreaterThan(0);
    expect(callsFor(TODAS_STATUSES).every(([, , o]) => o?.enabled === false)).toBe(true);

    fireEvent.mouseDown(screen.getByRole("tab", { name: /Todas las Ventas/ }));

    const calls = callsFor(TODAS_STATUSES);
    expect(calls[calls.length - 1]).toEqual(["2026-08-28", undefined, { statuses: TODAS_STATUSES, enabled: true }]);
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
    expect(tab()).toHaveTextContent(/Todas las Ventas\s*3$/);
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
    await waitFor(() =>
      expect(mockOrders).toHaveBeenCalledWith("2026-09-20", undefined, { statuses: TODAS_STATUSES, enabled: true }),
    );
    expect(mockCount).toHaveBeenCalledWith("2026-09-20", undefined, { statuses: TODAS_STATUSES });
  });

  it("Anuladas: el período va al servidor y si falla, el error queda en la pestaña con Reintentar", async () => {
    render(<VentasPage />);
    fireEvent.mouseDown(screen.getByRole("tab", { name: /Ventas Anuladas/ }));
    const panel = screen.getByRole("tabpanel");
    expect(ordersIn(panel)).toEqual(["ORD-301"]);

    overrides.anuladas = { error: true };
    fireEvent.click(within(panel).getByRole("button", { name: "15 días" }));

    await waitFor(() =>
      expect(mockOrders).toHaveBeenCalledWith("2026-09-12", undefined, { statuses: ["ANULADO"] }),
    );
    expect(within(panel).getByRole("alert")).toHaveTextContent("No se pudieron cargar las ventas de este período.");
    fireEvent.click(within(panel).getByRole("button", { name: "Reintentar" }));
    expect(retries.anuladas).toHaveBeenCalled();
    expect(screen.getByRole("tab", { name: /Todas las Ventas/ })).toBeInTheDocument();
  });
});

describe("VentasPage — KPIs por período", () => {
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

    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));

    expect(retries.kpis).toHaveBeenCalledTimes(1);
  });

  it("con un período más viejo que la ventana cuentan todo ese período", async () => {
    mockKpiPeriod = ["2026-08-01", "2026-08-31"];
    render(<VentasPage />);

    await waitFor(() => expect(kpiValue("Pendientes")).toBe("3"));
    expect(kpiValue("Anuladas")).toBe("1");
    expect(mockOrders).toHaveBeenCalledWith("2026-07-31", "2026-09-01", { statuses: KPI, enabled: true });
    expect(ordersIn(screen.getByRole("tabpanel"))).toEqual(["ORD-101"]);
  });
});
