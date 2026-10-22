import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CcSaleConfirmationPanel } from "../CcSaleConfirmationPanel";
import { useAuth } from "@/contexts/AuthContext";
import {
  confirmCommercialOrderPurchase,
  getCommercialLeadConfirmationCapabilities,
} from "@/services/commercialLeadsService";
import { notifyCommercialChange } from "@/utils/commercialOrders";
import type { LeadConfirmationResponse } from "@/types/leads";
import { toast } from "sonner";

jest.mock("@/contexts/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("@/services/commercialLeadsService", () => ({
  confirmCommercialOrderPurchase: jest.fn(),
  getCommercialLeadConfirmationCapabilities: jest.fn(),
  commercialLeadError: (error: unknown) =>
    error instanceof Error ? error.message : "No se pudo confirmar la venta.",
}));
jest.mock("@/utils/commercialOrders", () => ({
  ...jest.requireActual("@/utils/commercialOrders"),
  notifyCommercialChange: jest.fn(),
}));
jest.mock("sonner", () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));


function authSession(session: ReturnType<typeof useAuth>) {
  return { ...session, hasPermission: (permission: string) => session.auth?.user.permissions?.includes(permission) ?? false };
}

const ORDER_UPDATED_AT = "2026-10-22T22:20:00.000Z";
const ACCEPTANCE_LABEL = "El cliente aceptó los productos y el total del pedido";
const SUCCESS = {
  lead: { id: "lead-1", status: "CONVERTIDO" },
  order: { id: "order-1", commercialStage: "SALE" },
  replayed: false,
} as unknown as LeadConfirmationResponse;
const clients: QueryClient[] = [];

type PanelProps = React.ComponentProps<typeof CcSaleConfirmationPanel>;

function renderPanel(overrides: Partial<PanelProps> = {}) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  clients.push(client);
  const invalidateSpy = jest.spyOn(client, "invalidateQueries");
  const onUpdated = jest.fn();
  let props: PanelProps = {
    orderId: "order-1",
    commercialLeadId: "lead-1",
    orderUpdatedAt: ORDER_UPDATED_AT,
    datosCompletos: true,
    onUpdated,
    ...overrides,
  };
  const ui = () => (
    <QueryClientProvider client={client}>
      <CcSaleConfirmationPanel {...props} />
    </QueryClientProvider>
  );
  const result = render(ui());
  return {
    ...result,
    invalidateSpy,
    onUpdated,
    rerenderPanel(next: Partial<PanelProps>) {
      props = { ...props, ...next };
      result.rerender(ui());
    },
  };
}

async function reviewAndAccept() {
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Confirmar venta" }));
  await user.click(screen.getByRole("checkbox", { name: ACCEPTANCE_LABEL }));
  return user;
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(useAuth).mockReturnValue(authSession({
    auth: {
      company: { id: "company-1" },
      user: {
        id: "cc-user-1",
        name: "Ana",
        authorizationVerified: true,
        authorizationCompanyId: "company-1",
        permissions: ["MANAGE_CUSTOMER_SERVICE", "CONFIRM_SALE"],
      },
    },
  } as unknown as ReturnType<typeof useAuth>));
  jest.mocked(getCommercialLeadConfirmationCapabilities).mockResolvedValue({
    enabled: true,
    canConfirm: true,
  });
  jest.mocked(confirmCommercialOrderPurchase).mockResolvedValue(SUCCESS);
});

afterEach(() => {
  for (const client of clients.splice(0)) client.clear();
});

it("confirms the reviewed order through the commercial command and refreshes Ventas", async () => {
  const { invalidateSpy, onUpdated } = renderPanel();
  const user = userEvent.setup();

  await user.click(await screen.findByRole("button", { name: "Confirmar venta" }));
  const confirm = screen.getByRole("button", { name: "Confirmar y continuar en CC" });
  expect(confirm).toBeDisabled();
  expect(confirmCommercialOrderPurchase).not.toHaveBeenCalled();

  await user.click(screen.getByRole("checkbox", { name: ACCEPTANCE_LABEL }));
  await user.click(confirm);

  await waitFor(() => expect(onUpdated).toHaveBeenCalledTimes(1));
  expect(confirmCommercialOrderPurchase).toHaveBeenCalledTimes(1);
  expect(confirmCommercialOrderPurchase).toHaveBeenCalledWith("order-1", {
    commandId: expect.stringMatching(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    ),
    leadId: "lead-1",
    expectedOrderUpdatedAt: ORDER_UPDATED_AT,
  });
  expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["orders"] });
  expect(notifyCommercialChange).toHaveBeenCalledWith("company-1", "lead-1");
  expect(toast.success).toHaveBeenCalled();
});

it("keeps the visible confirmation button disabled until the customer data is saved", async () => {
  const { rerenderPanel } = renderPanel({ datosCompletos: false });

  expect(await screen.findByRole("button", { name: "Confirmar venta" })).toBeDisabled();
  expect(
    screen.getByText("Completa y guarda los datos del cliente antes de confirmar la venta."),
  ).toBeInTheDocument();
  expect(confirmCommercialOrderPurchase).not.toHaveBeenCalled();

  rerenderPanel({ datosCompletos: true });
  expect(screen.getByRole("button", { name: "Confirmar venta" })).toBeEnabled();
});

it("does not allow confirming an order whose reviewed timestamp is missing", async () => {
  renderPanel({ orderUpdatedAt: undefined });

  expect(await screen.findByRole("button", { name: "Confirmar venta" })).toBeDisabled();
  expect(confirmCommercialOrderPurchase).not.toHaveBeenCalled();
});

it("honors the backend confirmation permission even for a CC manager", async () => {
  jest.mocked(getCommercialLeadConfirmationCapabilities).mockResolvedValue({
    enabled: true,
    canConfirm: false,
  });
  renderPanel();

  expect(await screen.findByText("Tu rol no permite confirmar ventas.")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Confirmar venta" })).not.toBeInTheDocument();
  expect(confirmCommercialOrderPurchase).not.toHaveBeenCalled();
});

it("does not offer commercial confirmation while the feature is disabled", async () => {
  jest.mocked(getCommercialLeadConfirmationCapabilities).mockResolvedValue({
    enabled: false,
    canConfirm: false,
  });
  renderPanel();

  expect(
    await screen.findByText("La confirmación de ventas no está habilitada."),
  ).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Confirmar venta" })).not.toBeInTheDocument();
  expect(confirmCommercialOrderPurchase).not.toHaveBeenCalled();
});

it("fails closed when capabilities cannot be loaded", async () => {
  jest.mocked(getCommercialLeadConfirmationCapabilities).mockRejectedValue(new Error("Sin conexión"));
  renderPanel();

  expect(await screen.findByRole("alert")).toHaveTextContent(
    "No se pudo verificar el permiso para confirmar la venta.",
  );
  expect(getCommercialLeadConfirmationCapabilities).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole("button", { name: "Confirmar venta" })).not.toBeInTheDocument();
  expect(confirmCommercialOrderPurchase).not.toHaveBeenCalled();
});

it("rechecks capabilities after a failed read without issuing a confirmation", async () => {
  jest.mocked(getCommercialLeadConfirmationCapabilities)
    .mockRejectedValueOnce(new Error("Sin conexión"))
    .mockResolvedValueOnce({ enabled: true, canConfirm: true });
  renderPanel();
  const user = userEvent.setup();

  await user.click(await screen.findByRole("button", { name: "Reintentar" }));

  expect(await screen.findByRole("button", { name: "Confirmar venta" })).toBeEnabled();
  expect(getCommercialLeadConfirmationCapabilities).toHaveBeenCalledTimes(2);
  expect(confirmCommercialOrderPurchase).not.toHaveBeenCalled();
});

it("cancels a review without creating a sale", async () => {
  renderPanel();
  const user = await reviewAndAccept();

  await user.click(screen.getByRole("button", { name: "Volver" }));

  expect(screen.queryByRole("button", { name: "Confirmar y continuar en CC" })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Confirmar venta" })).toBeInTheDocument();
  expect(confirmCommercialOrderPurchase).not.toHaveBeenCalled();
});

it("retries a failed response with the same command and order snapshot", async () => {
  jest.mocked(confirmCommercialOrderPurchase)
    .mockRejectedValueOnce(new Error("Respuesta interrumpida"))
    .mockResolvedValueOnce({ ...SUCCESS, replayed: true });
  const { onUpdated } = renderPanel();
  const user = await reviewAndAccept();

  await user.click(screen.getByRole("button", { name: "Confirmar y continuar en CC" }));
  await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Respuesta interrumpida"));
  expect(onUpdated).not.toHaveBeenCalled();
  expect(notifyCommercialChange).not.toHaveBeenCalled();

  await user.click(screen.getByRole("button", { name: "Confirmar y continuar en CC" }));
  await waitFor(() => expect(onUpdated).toHaveBeenCalledTimes(1));

  const calls = jest.mocked(confirmCommercialOrderPurchase).mock.calls;
  expect(calls).toHaveLength(2);
  expect(calls[1]).toEqual(calls[0]);
  expect(calls[0][1]).not.toHaveProperty("order");
});

it("blocks duplicate clicks while the command is pending", async () => {
  let resolve!: (result: LeadConfirmationResponse) => void;
  jest.mocked(confirmCommercialOrderPurchase).mockReturnValue(
    new Promise((done) => { resolve = done; }),
  );
  const { onUpdated } = renderPanel();
  await reviewAndAccept();
  const confirm = screen.getByRole("button", { name: "Confirmar y continuar en CC" });

  fireEvent.click(confirm);
  fireEvent.click(confirm);

  expect(confirmCommercialOrderPurchase).toHaveBeenCalledTimes(1);
  expect(confirm).toBeDisabled();
  await act(async () => resolve(SUCCESS));
  await waitFor(() => expect(onUpdated).toHaveBeenCalledTimes(1));
});

it("invalidates the previous review when the order changes", async () => {
  const { rerenderPanel } = renderPanel();
  await reviewAndAccept();

  rerenderPanel({ orderUpdatedAt: "2026-10-22T22:25:00.000Z" });

  const outdated = screen.queryByRole("button", { name: "Confirmar y continuar en CC" });
  if (outdated) {
    expect(outdated).toBeDisabled();
    fireEvent.click(outdated);
  }
  expect(confirmCommercialOrderPurchase).not.toHaveBeenCalled();
});

it("can confirm an existing order without inventing a lead identifier", async () => {
  renderPanel({ commercialLeadId: null });
  const user = await reviewAndAccept();

  await user.click(screen.getByRole("button", { name: "Confirmar y continuar en CC" }));

  await waitFor(() => expect(confirmCommercialOrderPurchase).toHaveBeenCalledTimes(1));
  expect(jest.mocked(confirmCommercialOrderPurchase).mock.calls[0][1]).not.toHaveProperty("leadId");
});
