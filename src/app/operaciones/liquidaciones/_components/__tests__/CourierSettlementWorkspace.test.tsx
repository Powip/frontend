jest.setTimeout(30_000);
import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CourierSettlementWorkspace } from "../CourierSettlementWorkspace";
import * as api from "@/services/courierSettlementsService";
jest.mock("@/hooks/useBusinessOrders", () => ({
  useBusinessOrders: () => ({
    orders: [{ id: "o1", status: "ENTREGADO", grandTotal: 100, courierId: "courier" }],
    loading: false,
    error: false,
    retry: jest.fn(),
  }),
}));
jest.mock("@/services/courierService", () => ({ fetchCouriers: jest.fn().mockResolvedValue([]) }));
jest.mock("@/services/courierSettlementsService", () => ({
  ...jest.requireActual("@/services/courierSettlementsService"),
  getCourierSettlements: jest.fn(),
  confirmCourierCollection: jest.fn(),
}));
const service = jest.mocked(api);
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
});

it("does not turn delivered orders into confirmed collections and reloads saved history from the server", async () => {
  service.getCourierSettlements.mockResolvedValue({
    capabilities: { canConfirm: true, canRegister: true, canReconcile: true },
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
  expect(await screen.findByText(/No hay cobros confirmados/)).toBeInTheDocument();
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

it("shows load errors instead of using local session records as financial truth", async () => {
  service.getCourierSettlements.mockRejectedValue(new Error("Unavailable"));
  view();
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "No se pudieron cargar las liquidaciones guardadas",
  );
  expect(
    screen.queryByRole("button", { name: "Confirmar cobro del courier" }),
  ).not.toBeInTheDocument();
});
