jest.setTimeout(30_000);
import { fireEvent, render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AxiosError, AxiosHeaders } from "axios";
import { CourierSettlementWorkspace } from "../CourierSettlementWorkspace";
import * as api from "@/services/courierSettlementsService";

const recent = new Date(Date.now() - 3 * 86_400_000).toISOString();
let mockOrders: unknown[] = [];
jest.mock("@/hooks/useBusinessOrders", () => ({
  useBusinessOrders: () => ({
    orders: mockOrders,
    loading: false,
    error: false,
    retry: jest.fn(),
  }),
}));
jest.mock("@/services/courierService", () => ({
  fetchCouriers: jest.fn().mockResolvedValue([
    { id: "courier", name: "Shalom", companyId: "company", isActive: true },
    { id: "olva", name: "Olva", companyId: "company", isActive: true },
  ]),
}));
jest.mock("@/components/orders/OrderDetailModal", () => ({
  OrderDetailModalProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  OrderDetailButton: () => null,
}));
jest.mock("@/services/courierSettlementsService", () => ({
  ...jest.requireActual("@/services/courierSettlementsService"),
  getCourierSettlements: jest.fn(),
  confirmCourierCollection: jest.fn(),
}));
const service = jest.mocked(api);
const capabilities = { canConfirm: true, canRegister: true, canReconcile: true };
const delivered = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  orderNumber: `ORD-${id}`,
  status: "ENTREGADO",
  grandTotal: "100.00",
  courierId: "courier",
  courier: "Shalom",
  currency: "PEN",
  customer: { fullName: `Cliente ${id}` },
  payments: [],
  updated_at: recent,
  ...overrides,
});
function view() {
  return render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <CourierSettlementWorkspace companyId="company" actorId="user" />
    </QueryClientProvider>,
  );
}
beforeEach(() => {
  jest.clearAllMocks();
  mockOrders = [delivered("o1")];
});

it("does not turn delivered orders into confirmed collections and reloads saved history from the server", async () => {
  service.getCourierSettlements.mockResolvedValue({
    capabilities,
    collections: [],
    history: [
      {
        id: "s1",
        companyId: "company",
        courierName: "Courier guardado",
        courierId: "courier",
        currency: "PEN",
        amountDeposited: 20,
        amountAllocated: 20,
        unallocatedAmount: 0,
        difference: -80,
        status: "PENDIENTE_REVISION",
        date: "2026-11-02",
      } as api.CourierSettlement,
    ],
  });
  const first = view();
  fireEvent.click(await screen.findByRole("button", { name: "Cobros confirmados (0)" }));
  expect(screen.getByText(/No hay cobros confirmados/)).toBeInTheDocument();
  expect(service.confirmCourierCollection).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Depósitos e historial (1)" }));
  expect(screen.getByText("2026-11-02 · Courier guardado")).toBeInTheDocument();
  expect(screen.getByText("Pendiente de revisión")).toBeInTheDocument();
  first.unmount();
  view();
  fireEvent.click(await screen.findByRole("button", { name: "Depósitos e historial (1)" }));
  expect(screen.getByText("2026-11-02 · Courier guardado")).toBeInTheDocument();
  expect(service.getCourierSettlements).toHaveBeenCalledTimes(2);
});

it("opens on «Por liquidar» with delivered orders still owed by the courier, minus confirmed collections", async () => {
  mockOrders = [
    delivered("o1"),
    delivered("o2", { payments: [{ status: "PAID", paymentMethod: "YAPE", amount: "100.00" }] }),
    delivered("o3", { payments: [{ status: "PAID", paymentMethod: "CONTRA_ENTREGA", amount: "100.00" }] }),
  ];
  service.getCourierSettlements.mockResolvedValue({
    capabilities,
    collections: [{ id: "c1", companyId: "company", orderId: "o1", amount: 30 } as api.CourierCollection],
    history: [],
  });
  view();
  const table = await screen.findByRole("table");
  expect(within(table).getByText("ORD-o1")).toBeInTheDocument();
  expect(within(table).getByText("PEN 70.00")).toBeInTheDocument();
  expect(within(table).getByText("ya confirmado PEN 30.00")).toBeInTheDocument();
  // Pagado por Yape al negocio: el courier no debe nada. Contraentrega: sí.
  expect(within(table).queryByText("ORD-o2")).not.toBeInTheDocument();
  expect(within(table).getByText("ORD-o3")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Shalom/ })).toHaveTextContent("PEN 170.00");
});

it("only lets the user pick orders from one courier and opens the liquidation dialog", async () => {
  mockOrders = [delivered("o1"), delivered("o2", { courierId: "olva", courier: "Olva" }), delivered("o3")];
  service.getCourierSettlements.mockResolvedValue({ capabilities, collections: [], history: [] });
  view();
  fireEvent.click(await screen.findByRole("checkbox", { name: "Seleccionar ORD-o1" }));
  expect(screen.getByRole("checkbox", { name: "Seleccionar ORD-o2" })).toBeDisabled();
  fireEvent.click(screen.getByRole("checkbox", { name: "Seleccionar ORD-o3" }));
  fireEvent.click(screen.getByRole("button", { name: "Registrar liquidación" }));
  expect(await screen.findByRole("dialog")).toHaveTextContent("Registrar liquidación · Shalom");
  expect(screen.getByLabelText("Importe depositado PEN")).toHaveValue("200");
});

it("marks orders whose courier ms-courier would reject instead of offering to confirm them", async () => {
  mockOrders = [delivered("o1", { courierId: null, courier: "Motorizado Yuri" })];
  service.getCourierSettlements.mockResolvedValue({ capabilities, collections: [], history: [] });
  view();
  expect(await screen.findByText(/Courier no registrado/)).toBeInTheDocument();
  expect(screen.getByRole("checkbox", { name: "Seleccionar ORD-o1" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Confirmar cobro" })).toBeDisabled();
  expect(screen.getByRole("link", { name: "Ver couriers" })).toHaveAttribute("href", "/configuracion/tiendas");
});

it("explains a missing finance permission and keeps «Por liquidar» read-only", async () => {
  service.getCourierSettlements.mockRejectedValue(
    new AxiosError("Forbidden", "ERR_BAD_REQUEST", undefined, undefined, {
      status: 403,
      statusText: "Forbidden",
      headers: {},
      config: { headers: new AxiosHeaders() },
      data: {},
    }),
  );
  view();
  expect(await screen.findByRole("alert")).toHaveTextContent("no tiene el permiso de Finanzas");
  expect(await screen.findByText("ORD-o1")).toBeInTheDocument();
  expect(screen.queryByRole("checkbox", { name: "Seleccionar ORD-o1" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Confirmar cobro" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Cobros confirmados" }));
  expect(screen.getByText(/Necesitas el permiso de Finanzas/)).toBeInTheDocument();
});

it("shows load errors instead of using local session records as financial truth", async () => {
  service.getCourierSettlements.mockRejectedValue(new Error("Unavailable"));
  view();
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "No se pudieron cargar las liquidaciones guardadas",
  );
  expect(
    screen.queryByRole("button", { name: "Confirmar cobro de otro pedido" }),
  ).not.toBeInTheDocument();
});
