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
const session = { role: "admin" };
jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ auth: { accessToken: "t", user: { id: "u1", role: session.role }, company: { id: "co1" } } }),
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
  getCrmAccess: jest.fn(),
  listChannelAccounts: jest.fn(),
  updateChannelAccount: jest.fn(),
  disconnectChannelAccount: jest.fn(),
  reconnectChannelAccount: jest.fn(),
  deleteChannelAccount: jest.fn(),
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

const access = (over: Partial<svc.CrmAccess> = {}): svc.CrmAccess => ({
  allowed: true,
  level: "admin",
  crm: true,
  pau: true,
  until: "2026-12-23",
  source: "subscription",
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

describe("PlanCard (solo lectura: el plan sale del pago)", () => {
  it("muestra lo pagado, hasta cuándo y las vendedoras; sin botones para cambiar el plan", async () => {
    m.getCrmPlan.mockResolvedValue(quote());
    m.getCrmAccess.mockResolvedValue(access());
    renderWith(<PlanCard />);
    const paid = await screen.findByTestId("plan-paid");
    expect(paid).toHaveTextContent("CRM + Pau");
    expect(paid).toHaveTextContent("Pagado hasta el 23/12/2026");
    expect(within(paid).getByRole("link", { name: "Ver Mi plan" })).toHaveAttribute("href", "/configuracion/plan");
    expect(screen.getByTestId("plan-seats")).toHaveTextContent("3 / 5 incluidas");
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Agregar Pau|Cambiar a solo CRM/ })).not.toBeInTheDocument();
  });

  it("solo CRM y activación manual", async () => {
    m.getCrmPlan.mockResolvedValue(quote({ pauOn: false }));
    m.getCrmAccess.mockResolvedValue(access({ pau: false, via: "MANUAL" }));
    renderWith(<PlanCard />);
    const paid = await screen.findByTestId("plan-paid");
    expect(paid).toHaveTextContent("Solo CRM");
    expect(paid).toHaveTextContent("Activado por POWIP hasta el 23/12/2026");
  });

  it("muestra vendedoras extra", async () => {
    m.getCrmPlan.mockResolvedValue(quote({ seats: { used: 7, included: 5, extra: 2 } }));
    m.getCrmAccess.mockResolvedValue(access());
    renderWith(<PlanCard />);
    expect(await screen.findByText(/2 vendedoras extra × S\/ 10/)).toBeInTheDocument();
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

  it("«Eliminar» pide confirmar en español y solo borra al confirmar", async () => {
    session.role = "admin";
    m.listChannelAccounts.mockResolvedValue([account(), account({ id: "a2", accountId: "1666", name: "Ventas Norte" })]);
    m.deleteChannelAccount.mockResolvedValue({
      id: "a1",
      channel: "whatsapp",
      accountId: "1555",
      deletedConversations: 3,
      deletedMessages: 20,
      deletedFiles: 1,
      connection: "deleted",
    });
    renderWith(<ChannelAccountsCard />);
    const row = await screen.findByTestId("channel-account-a1");

    fireEvent.click(within(row).getByRole("button", { name: "Eliminar" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText("¿Eliminar Ventas Lima?")).toBeInTheDocument();
    expect(within(dialog).getByText(/también los abiertos/)).toBeInTheDocument();
    expect(within(dialog).getByText(/Las ventas y pedidos no se tocan/)).toBeInTheDocument();
    expect(within(dialog).getByText(/no se puede deshacer/)).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: "Cancelar" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(m.deleteChannelAccount).not.toHaveBeenCalled();

    fireEvent.click(within(row).getByRole("button", { name: "Eliminar" }));
    fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Sí, eliminar" }));
    await waitFor(() => expect(m.deleteChannelAccount).toHaveBeenCalledWith("a1"));
    await waitFor(() => expect(t.success).toHaveBeenCalledWith("Ventas Lima eliminada (3 chats borrados)"));
    await waitFor(() => expect(screen.queryByTestId("channel-account-a1")).not.toBeInTheDocument());
    // La otra cuenta de la tienda sigue.
    expect(screen.getByTestId("channel-account-a2")).toBeInTheDocument();
  });

  it("sin ser dueño o administrador no aparece «Eliminar»", async () => {
    session.role = "seller";
    m.listChannelAccounts.mockResolvedValue([account()]);
    renderWith(<ChannelAccountsCard />);
    expect(await screen.findByRole("button", { name: "Desconectar" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Eliminar" })).not.toBeInTheDocument();
    session.role = "admin";
  });

  it("sin cuentas explica cuándo aparecen", async () => {
    m.listChannelAccounts.mockResolvedValue([]);
    renderWith(<ChannelAccountsCard />);
    expect(await screen.findByText(/Aún no hay cuentas/)).toBeInTheDocument();
  });
});
