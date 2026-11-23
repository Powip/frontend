import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChannelAccountsCard, PlanCard } from "@/components/ventas-chat/AjustesPlanCards";
import * as svc from "@/services/crmPlanService";

jest.mock("@/lib/axiosAuth", () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), put: jest.fn(), patch: jest.fn(), delete: jest.fn() },
}));
jest.mock("sonner", () => ({ toast: { error: jest.fn(), success: jest.fn() } }));
jest.mock("@/hooks/useCrmMe", () => ({
  useCrmMe: () => ({
    level: "admin",
    isAdmin: true,
    isSupervisor: true,
    stores: [
      { id: "s1", name: "Tienda Uno" },
      { id: "s2", name: "Tienda Dos" },
    ],
    fromServer: true,
    phoneMasked: false,
  }),
}));
jest.mock("@/services/crmPlanService", () => ({
  ...jest.requireActual("@/services/crmPlanService"),
  getCrmPlan: jest.fn(),
  updateCrmPlan: jest.fn(),
  listChannelAccounts: jest.fn(),
  updateChannelAccount: jest.fn(),
  disconnectChannelAccount: jest.fn(),
  reconnectChannelAccount: jest.fn(),
}));
const m = svc as jest.Mocked<typeof svc>;
const t = toast as jest.Mocked<typeof toast>;

const quote = (over: Partial<svc.CrmPlanQuote> = {}): svc.CrmPlanQuote => ({
  pauOn: true,
  accountType: "core",
  domain: "app.powip.lat",
  currency: "PEN",
  prices: { crm: 79, pau: 49, bundle: 119, extraSeat: 10 },
  bundleSavings: 9,
  seats: { used: 3, included: 5, extra: 0 },
  basePrice: 119,
  monthlyTotal: 119,
  ...over,
});

const account = (over: Partial<svc.ChannelAccount> = {}): svc.ChannelAccount => ({
  id: "a1",
  channel: "whatsapp",
  accountId: "1555",
  name: "Ventas Lima",
  storeId: "s1",
  isActive: true,
  createdAt: "2026-11-20T15:00:00Z",
  ...over,
});

const renderWith = (ui: React.ReactElement) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
};

beforeEach(() => jest.clearAllMocks());

describe("PlanCard", () => {
  it("muestra CRM + Pau, vendedoras y total", async () => {
    m.getCrmPlan.mockResolvedValue(quote());
    renderWith(<PlanCard />);
    const bundle = await screen.findByTestId("plan-bundle");
    expect(bundle).toHaveAttribute("aria-current", "true");
    expect(within(bundle).getByText(/S\/ 119/)).toBeInTheDocument();
    expect(within(bundle).getByText(/Ahorras S\/ 9/)).toBeInTheDocument();
    expect(screen.getByTestId("plan-seats")).toHaveTextContent("3 / 5 incluidas");
    expect(screen.getByTestId("plan-total")).toHaveTextContent("S/ 119");
    expect(screen.getByTestId("plan-domain")).toHaveTextContent("app.powip.lat");
    expect(screen.getByRole("radio", { name: "Core + CRM" })).toHaveAttribute("aria-checked", "true");
  });

  it("«Cambiar a solo CRM» manda pauOn false y avisa", async () => {
    m.getCrmPlan.mockResolvedValue(quote());
    m.updateCrmPlan.mockResolvedValue(quote({ pauOn: false, basePrice: 79, monthlyTotal: 79 }));
    renderWith(<PlanCard />);
    fireEvent.click(await screen.findByRole("button", { name: "Cambiar a solo CRM" }));
    await waitFor(() => expect(m.updateCrmPlan).toHaveBeenCalledWith({ pauOn: false }));
    await waitFor(() => expect(t.success).toHaveBeenCalledWith("Plan solo CRM · Pau queda en «Solo CRM»"));
    expect(await screen.findByRole("button", { name: "Agregar Pau · S/ 49" })).toBeInTheDocument();
    expect(screen.getByTestId("plan-crm")).toHaveAttribute("aria-current", "true");
    expect(screen.getByTestId("plan-total")).toHaveTextContent("S/ 79");
  });

  it("«Agregar Pau» avisa el precio del paquete", async () => {
    m.getCrmPlan.mockResolvedValue(quote({ pauOn: false, basePrice: 79, monthlyTotal: 79 }));
    m.updateCrmPlan.mockResolvedValue(quote());
    renderWith(<PlanCard />);
    fireEvent.click(await screen.findByRole("button", { name: "Agregar Pau · S/ 49" }));
    await waitFor(() => expect(m.updateCrmPlan).toHaveBeenCalledWith({ pauOn: true }));
    await waitFor(() => expect(t.success).toHaveBeenCalledWith("Plan CRM + Pau · S/ 119"));
  });

  it("muestra vendedoras extra", async () => {
    m.getCrmPlan.mockResolvedValue(quote({ seats: { used: 7, included: 5, extra: 2 }, monthlyTotal: 139 }));
    renderWith(<PlanCard />);
    expect(await screen.findByText("2 vendedoras extra × S/ 10")).toBeInTheDocument();
    expect(screen.getByTestId("plan-total")).toHaveTextContent("S/ 139");
  });

  it("cambia a cuenta Solo CRM con su dominio", async () => {
    m.getCrmPlan.mockResolvedValue(quote());
    m.updateCrmPlan.mockResolvedValue(quote({ accountType: "solo", domain: "crm.powip.lat" }));
    renderWith(<PlanCard />);
    fireEvent.click(await screen.findByRole("radio", { name: "Solo CRM" }));
    await waitFor(() => expect(m.updateCrmPlan).toHaveBeenCalledWith({ accountType: "solo" }));
    await waitFor(() => expect(t.success).toHaveBeenCalledWith("Cuenta Solo POWIP CRM · crm.powip.lat"));
    expect(await screen.findByTestId("plan-domain")).toHaveTextContent("crm.powip.lat");
  });

  it("no manda nada al tocar el tipo de cuenta actual", async () => {
    m.getCrmPlan.mockResolvedValue(quote());
    renderWith(<PlanCard />);
    fireEvent.click(await screen.findByRole("radio", { name: "Core + CRM" }));
    expect(m.updateCrmPlan).not.toHaveBeenCalled();
  });
});

describe("ChannelAccountsCard", () => {
  it("cambia nombre y tienda y avisa «Cuenta actualizada»", async () => {
    m.listChannelAccounts.mockResolvedValue([account()]);
    m.updateChannelAccount.mockResolvedValue({ ...account({ name: "Ventas Sur", storeId: "s2" }), movedConversations: 4 });
    renderWith(<ChannelAccountsCard />);
    const save = await screen.findByRole("button", { name: "Guardar" });
    expect(save).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Nombre de Ventas Lima"), { target: { value: "Ventas Sur" } });
    fireEvent.change(screen.getByLabelText("Tienda de Ventas Lima"), { target: { value: "s2" } });
    fireEvent.click(save);
    await waitFor(() =>
      expect(m.updateChannelAccount).toHaveBeenCalledWith("a1", { name: "Ventas Sur", storeId: "s2" }),
    );
    await waitFor(() => expect(t.success).toHaveBeenCalledWith("Cuenta actualizada"));
  });

  it("muestra el error del servidor si la cuenta tiene chats abiertos", async () => {
    m.listChannelAccounts.mockResolvedValue([account()]);
    m.disconnectChannelAccount.mockRejectedValue({
      isAxiosError: true,
      response: {
        status: 409,
        data: {
          code: "CHANNEL_HAS_OPEN_CHATS",
          message: "Tiene chats abiertos: ciérralos o muévelos antes de desconectar",
        },
      },
    });
    renderWith(<ChannelAccountsCard />);
    fireEvent.click(await screen.findByRole("button", { name: "Desconectar" }));
    await waitFor(() => expect(t.error).toHaveBeenCalled());
    expect(String(t.error.mock.calls[0][0])).toMatch(/chats abiertos/);
    expect(screen.getByText("Conectada")).toBeInTheDocument();
  });

  it("desconecta y reconecta", async () => {
    m.listChannelAccounts.mockResolvedValue([account()]);
    m.disconnectChannelAccount.mockResolvedValue(account({ isActive: false }));
    m.reconnectChannelAccount.mockResolvedValue(account());
    renderWith(<ChannelAccountsCard />);
    fireEvent.click(await screen.findByRole("button", { name: "Desconectar" }));
    await waitFor(() => expect(t.success).toHaveBeenCalledWith("Ventas Lima desconectada"));
    expect(await screen.findByText("Desconectada")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Reconectar" }));
    await waitFor(() => expect(t.success).toHaveBeenCalledWith("Ventas Lima reconectada"));
  });

  it("sin cuentas explica cuándo aparecen", async () => {
    m.listChannelAccounts.mockResolvedValue([]);
    renderWith(<ChannelAccountsCard />);
    expect(await screen.findByText(/Aún no hay cuentas/)).toBeInTheDocument();
  });
});
