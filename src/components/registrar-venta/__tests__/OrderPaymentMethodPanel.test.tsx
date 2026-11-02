jest.setTimeout(30_000);
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { OrderPaymentMethodPanel } from "../OrderPaymentMethodPanel";
import * as api from "@/services/orderPaymentMethodService";
jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ auth: { company: { id: "company" }, user: { id: "user" } } }),
}));
jest.mock("@/services/orderPaymentMethodService", () => ({
  ...jest.requireActual("@/services/orderPaymentMethodService"),
  getOrderPaymentMethods: jest.fn(),
  correctOrderPaymentMethod: jest.fn(),
}));
const service = jest.mocked(api);
const payment: api.OrderPaymentMethod = {
  paymentId: "paid-1",
  amount: 50,
  currency: "PEN",
  status: "PAID",
  paymentDate: "2026-11-02",
  recordedLedgerMethod: "EFECTIVO",
  effectiveOrderMethod: "EFECTIVO",
  version: 0,
  history: [],
};
const response = (canCorrect = true): api.OrderPaymentMethods => ({
  orderId: "order1",
  canCorrect,
  allowedMethods: ["YAPE", "EFECTIVO"],
  payments: [payment],
});
function view() {
  return render(
    <QueryClientProvider
      client={
        new QueryClient({
          defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
        })
      }
    >
      <OrderPaymentMethodPanel orderId="order1" />
    </QueryClientProvider>,
  );
}
beforeEach(() => {
  jest.clearAllMocks();
  service.getOrderPaymentMethods.mockResolvedValue(response());
  Object.defineProperty(global.crypto, "randomUUID", {
    configurable: true,
    value: jest.fn(() => "request-method"),
  });
});

it("corrects an approved payment only in the order with audit reason and expected version", async () => {
  const user = userEvent.setup({ delay: null });
  service.correctOrderPaymentMethod.mockImplementation(async () => {
    service.getOrderPaymentMethods.mockResolvedValue({
      ...response(),
      payments: [
        {
          ...payment,
          effectiveOrderMethod: "YAPE",
          version: 1,
          history: [
            {
              id: "correction",
              previousMethod: "EFECTIVO",
              newMethod: "YAPE",
              reason: "Método informado por cliente",
              actorId: "user",
              createdAt: "2026-11-02",
              version: 1,
            },
          ],
        },
      ],
    });
    return { ...payment, effectiveOrderMethod: "YAPE", version: 1 };
  });
  view();
  expect(service.getOrderPaymentMethods).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Corregir método o ver historial" }));
  await user.click(await screen.findByRole("button", { name: "Corregir método del pago 1" }));
  expect(screen.getByRole("button", { name: "Guardar corrección" })).toBeDisabled();
  await user.selectOptions(screen.getByLabelText("Método correcto"), "YAPE");
  await user.type(screen.getByLabelText("Motivo de la corrección"), "Método informado por cliente");
  await user.click(screen.getByRole("button", { name: "Guardar corrección" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  expect(service.correctOrderPaymentMethod).toHaveBeenCalledWith("order1", "paid-1", {
    newMethod: "YAPE",
    reason: "Método informado por cliente",
    requestId: "request-method",
    expectedVersion: 0,
  });
  expect(screen.getByText("Pago 1 · Yape")).toBeInTheDocument();
  expect(screen.getByText("Método registrado en recaudo: Efectivo")).toBeInTheDocument();
  expect(screen.getByText("Historial de correcciones (1)")).toBeInTheDocument();
});

it("uses server capabilities and does not offer correction without access", async () => {
  service.getOrderPaymentMethods.mockResolvedValue(response(false));
  view();
  fireEvent.click(screen.getByRole("button", { name: "Corregir método o ver historial" }));
  expect(await screen.findByText("Pago 1 · Efectivo")).toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: /Corregir método del pago/ }),
  ).not.toBeInTheDocument();
});

it("reuses the command identity after an uncertain network result", async () => {
  const user = userEvent.setup({ delay: null });
  service.correctOrderPaymentMethod
    .mockRejectedValueOnce(new Error("Network unavailable"))
    .mockResolvedValueOnce({ ...payment, effectiveOrderMethod: "YAPE", version: 1 });
  view();
  await user.click(screen.getByRole("button", { name: "Corregir método o ver historial" }));
  await user.click(await screen.findByRole("button", { name: "Corregir método del pago 1" }));
  await user.selectOptions(screen.getByLabelText("Método correcto"), "YAPE");
  await user.type(screen.getByLabelText("Motivo de la corrección"), "Corrección verificada");
  await user.click(screen.getByRole("button", { name: "Guardar corrección" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("reintentar sin duplicarla");
  await user.click(screen.getByRole("button", { name: "Guardar corrección" }));
  await waitFor(() => expect(service.correctOrderPaymentMethod).toHaveBeenCalledTimes(2));
  expect(service.correctOrderPaymentMethod.mock.calls[0][2]).toEqual(
    service.correctOrderPaymentMethod.mock.calls[1][2],
  );
});

it("requires refreshing a stale version before another correction", async () => {
  const user = userEvent.setup({ delay: null });
  service.correctOrderPaymentMethod.mockRejectedValue({
    isAxiosError: true,
    response: { status: 409 },
  });
  view();
  await user.click(screen.getByRole("button", { name: "Corregir método o ver historial" }));
  await user.click(await screen.findByRole("button", { name: "Corregir método del pago 1" }));
  await user.selectOptions(screen.getByLabelText("Método correcto"), "YAPE");
  await user.type(screen.getByLabelText("Motivo de la corrección"), "Corrección verificada");
  await user.click(screen.getByRole("button", { name: "Guardar corrección" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Este pago cambió");
  expect(screen.queryByRole("button", { name: "Guardar corrección" })).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Actualizar métodos" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  expect(service.getOrderPaymentMethods).toHaveBeenCalledTimes(2);
  expect(service.correctOrderPaymentMethod).toHaveBeenCalledTimes(1);
});

it("does not display a late response from the previously selected order", async () => {
  let completePrevious!: (value: api.OrderPaymentMethods) => void;
  service.getOrderPaymentMethods.mockImplementation((orderId) =>
    orderId === "order1"
      ? new Promise((resolve) => {
          completePrevious = resolve;
        })
      : Promise.resolve({
          ...response(),
          orderId,
          payments: [{ ...payment, effectiveOrderMethod: "YAPE" }],
        }),
  );
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const content = (orderId: string) => (
    <QueryClientProvider client={client}>
      <OrderPaymentMethodPanel orderId={orderId} />
    </QueryClientProvider>
  );
  const view = render(content("order1"));
  fireEvent.click(screen.getByRole("button", { name: "Corregir método o ver historial" }));
  await waitFor(() => expect(service.getOrderPaymentMethods).toHaveBeenCalledTimes(1));
  view.rerender(content("order2"));
  fireEvent.click(screen.getByRole("button", { name: "Corregir método o ver historial" }));
  expect(await screen.findByText("Pago 1 · Yape")).toBeInTheDocument();
  await act(async () => completePrevious(response()));
  expect(screen.queryByText("Pago 1 · Efectivo")).not.toBeInTheDocument();
  expect(screen.getByText("Pago 1 · Yape")).toBeInTheDocument();
});
