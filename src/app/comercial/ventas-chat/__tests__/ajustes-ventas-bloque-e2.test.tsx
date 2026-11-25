import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as tools from "@/services/crmSalesToolsService";
import * as ajustesE from "@/services/crmAjustesEService";
import * as teamService from "@/services/crmTeamService";
import * as planService from "@/services/crmPlanService";
import * as panelService from "@/services/crmOrderPanelService";
import VentasView from "@/components/ventas-chat/VentasView";
import {
  AttributionCard,
  CodCard,
  MemberStoresCard,
  PaymentsCard,
  StoreWelcomeCard,
  StoresChannelsCard,
  welcomeProblem,
} from "@/components/ventas-chat/AjustesBloqueE";
import { AssignCard } from "@/components/ventas-chat/AjustesCards";
import type { SalesBoardRow } from "@/types/crmSalesTools";
import type { CrmSettings } from "@/types/crmTeam";

const access = {
  isAdmin: true,
  stores: [
    { id: "s1", name: "Kunca" },
    { id: "s2", name: "Amagreen" },
  ],
};
jest.mock("@/hooks/useCrmMe", () => ({ useCrmMe: () => access }));
jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    auth: { accessToken: "t", user: { id: "u1", name: "Jairo" }, company: { id: "co1", stores: [{ id: "s1", name: "Kunca" }] } },
  }),
}));
jest.mock("@/hooks/usePdfDownload", () => ({ usePdfDownload: () => jest.fn() }));
jest.mock("@/components/modals/ImportSalesModal", () => ({ __esModule: true, default: () => null }));
jest.mock("@/lib/axiosAuth", () => ({ __esModule: true, default: { get: jest.fn(), post: jest.fn(), patch: jest.fn() } }));
jest.mock("sonner", () => ({ toast: { error: jest.fn(), success: jest.fn() } }));
jest.mock("@/services/crmSalesToolsService", () => ({
  ...jest.requireActual("@/services/crmSalesToolsService"),
  getSalesBoard: jest.fn(),
}));
jest.mock("@/services/crmAjustesEService", () => ({
  getCrmSettingsE: jest.fn(),
  updateCrmSettingsE: jest.fn(),
  getSalesBoardExtras: jest.fn(),
}));
jest.mock("@/services/crmTeamService", () => ({
  ...jest.requireActual("@/services/crmTeamService"),
  listTeamMembers: jest.fn(),
  updateCrmSettings: jest.fn(),
}));
jest.mock("@/services/crmPlanService", () => ({
  ...jest.requireActual("@/services/crmPlanService"),
  listChannelAccounts: jest.fn(),
}));
jest.mock("@/services/crmOrderPanelService", () => ({
  ...jest.requireActual("@/services/crmOrderPanelService"),
  getStorePolicy: jest.fn(),
}));

const t = tools as jest.Mocked<typeof tools>;
const e = ajustesE as jest.Mocked<typeof ajustesE>;
const team = teamService as jest.Mocked<typeof teamService>;
const plan = planService as jest.Mocked<typeof planService>;
const panel = panelService as jest.Mocked<typeof panelService>;

const settings = (over: Record<string, unknown> = {}) =>
  ({
    assignMode: "round_robin",
    assignUsers: [{ userId: "u1", userName: "Ana" }],
    stickySeller: true,
    showPresence: true,
    attributionDays: 7,
    attributionPau: "persona",
    attributionCod: "confirma",
    attributionReturning: true,
    codUserIds: [],
    welcomeByStore: [],
    memberStores: [],
    ...over,
  }) as unknown as CrmSettings;

function wrap(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}
const card = (id: string) => screen.getByTestId(`card-${id}`);
const save = (id: string) => within(card(id)).getByRole("button", { name: "Guardar" });

beforeEach(() => {
  jest.clearAllMocks();
  team.listTeamMembers.mockResolvedValue([
    { userId: "u1", userName: "Ana" },
    { userId: "u2", userName: "Bea" },
    { userId: "u3", userName: "Cia" },
  ]);
  e.updateCrmSettingsE.mockImplementation(async (input) => ({ ...(settings() as object), ...input }) as never);
  team.updateCrmSettings.mockImplementation(async (input) => ({ ...(settings() as object), ...input }) as never);
});

describe("Ajustes · bloque E (J3–J8, J10)", () => {
  it("J8: reparto a la de menos carga y sin mantener vendedora", async () => {
    wrap(<AssignCard settings={settings()} />);
    fireEvent.click(within(card("assign")).getByRole("radio", { name: "A la que tenga menos chats abiertos" }));
    fireEvent.click(screen.getByRole("switch", { name: "Mantener al cliente con su vendedora" }));
    fireEvent.click(save("assign"));
    await waitFor(() =>
      expect(team.updateCrmSettings).toHaveBeenCalledWith({
        assignMode: "least_load",
        assignUsers: [{ userId: "u1", userName: "Ana" }],
        stickySeller: false,
      }),
    );
  });

  it("J4: máximo 2 personas en contra entrega", async () => {
    wrap(<CodCard settings={settings()} />);
    fireEvent.click(await screen.findByRole("checkbox", { name: "COD: Ana" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "COD: Bea" }));
    expect(screen.getByRole("checkbox", { name: "COD: Cia" })).toBeDisabled();
    expect(screen.getByRole("link", { name: "Abrir Gestión CC" })).toHaveAttribute("href", "/atencion-cliente");
    fireEvent.click(save("cod"));
    await waitFor(() => expect(e.updateCrmSettingsE).toHaveBeenCalledWith({ codUserIds: ["u1", "u2"] }));
  });

  it("J6: bienvenida por tienda con botones y vista previa", async () => {
    wrap(<StoreWelcomeCard settings={settings()} />);
    fireEvent.click(screen.getByRole("tab", { name: "Amagreen" }));
    fireEvent.click(screen.getByRole("switch", { name: "Bienvenida activa en esta tienda" }));
    fireEvent.change(screen.getByLabelText("Mensaje de bienvenida de la tienda"), { target: { value: "Hola 👋" } });
    const add = screen.getByRole("button", { name: /Agregar botón/ });
    fireEvent.click(add);
    fireEvent.click(add);
    fireEvent.click(add);
    expect(add).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Texto del botón 1"), { target: { value: "Ver catálogo" } });
    fireEvent.change(screen.getByLabelText("Acción del botón 1"), { target: { value: "catalogo" } });
    fireEvent.click(screen.getByRole("button", { name: "Quitar botón 3" }));
    fireEvent.change(screen.getByLabelText("Texto del botón 2"), { target: { value: "Hablar con asesora" } });
    expect(within(screen.getByTestId("welcome-preview")).getByText("Ver catálogo")).toBeInTheDocument();
    fireEvent.click(save("store-welcome"));
    await waitFor(() =>
      expect(e.updateCrmSettingsE).toHaveBeenCalledWith({
        welcomeByStore: [
          {
            storeId: "s2",
            enabled: true,
            message: "Hola 👋",
            buttons: [
              { text: "Ver catálogo", action: "catalogo" },
              { text: "Hablar con asesora", action: "asesora" },
            ],
          },
        ],
      }),
    );
  });

  it("J6: reglas de los botones", () => {
    const base = { storeId: "s1", enabled: true, message: "Hola", buttons: [] };
    expect(welcomeProblem({ ...base, message: " " })).toMatch(/Escribe el mensaje/);
    expect(welcomeProblem({ ...base, buttons: [{ text: "x".repeat(21), action: "pau" }] })).toMatch(/20 caracteres/);
    expect(welcomeProblem({ ...base, buttons: [{ text: "A", action: "pau" }, { text: "a", action: "pau" }] })).toMatch(/mismo texto/);
    expect(welcomeProblem(base)).toBeNull();
  });

  it("J7: días de atribución de 1 a 30", async () => {
    wrap(<AttributionCard settings={settings()} />);
    const days = screen.getByLabelText("Días de atribución");
    fireEvent.change(days, { target: { value: "31" } });
    expect(save("attribution")).toBeDisabled();
    expect(screen.getByText("Los días van de 1 a 30.")).toBeInTheDocument();
    fireEvent.change(days, { target: { value: "14" } });
    fireEvent.change(screen.getByLabelText("Atribución con Pau"), { target: { value: "inicio" } });
    fireEvent.click(save("attribution"));
    await waitFor(() =>
      expect(e.updateCrmSettingsE).toHaveBeenCalledWith({
        attributionDays: 14,
        attributionPau: "inicio",
        attributionCod: "confirma",
        attributionReturning: true,
      }),
    );
  });

  it("J10: matriz personas × tiendas", async () => {
    wrap(<MemberStoresCard settings={settings()} />);
    const bea = await screen.findByRole("checkbox", { name: "Bea atiende Amagreen" });
    expect(bea).toBeChecked();
    fireEvent.click(bea);
    fireEvent.click(screen.getByRole("checkbox", { name: "Cia atiende Kunca" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Cia atiende Amagreen" }));
    expect(screen.getByText("Cada persona necesita al menos una tienda.")).toBeInTheDocument();
    expect(save("member-stores")).toBeDisabled();
    fireEvent.click(screen.getByRole("checkbox", { name: "Cia atiende Kunca" }));
    fireEvent.click(save("member-stores"));
    await waitFor(() =>
      expect(e.updateCrmSettingsE).toHaveBeenCalledWith({
        memberStores: [
          { userId: "u2", storeIds: ["s1"] },
          { userId: "u3", storeIds: ["s1"] },
        ],
      }),
    );
  });

  it("J3: canales agrupados por tienda con vendedoras", async () => {
    plan.listChannelAccounts.mockResolvedValue([
      { id: "a1", channel: "whatsapp", accountId: "51999", name: "Ventas Kunca", storeId: "s1", isActive: true, createdAt: "" },
      { id: "a2", channel: "instagram", accountId: "ig1", name: null, storeId: null, isActive: false, createdAt: "" },
    ]);
    wrap(<StoresChannelsCard settings={settings({ memberStores: [{ userId: "u2", storeIds: ["s2"] }] })} />);
    const kunca = await screen.findByTestId("store-group-s1");
    expect(await within(kunca).findByText("Ventas Kunca")).toBeInTheDocument();
    await waitFor(() => expect(kunca).toHaveTextContent("1 cuenta conectada · 2 vendedoras"));
    expect(screen.getByTestId("store-group-s2")).toHaveTextContent("0 cuentas conectadas · 3 vendedoras");
    expect(within(screen.getByTestId("store-group-none")).getByText("Desconectada")).toBeInTheDocument();
  });

  it("J5: pagos y cobros con política por tienda", async () => {
    panel.getStorePolicy.mockResolvedValue({
      storeId: "s1",
      saved: true,
      shipCharge: 10,
      firstOffer: "full" as never,
      depositEnabled: true,
      depositAmount: 20,
      codFull: false,
      codAsk: "always" as never,
      discountCap: 10,
      promoText: "",
      quantityPromos: [],
    });
    wrap(<PaymentsCard />);
    expect(await screen.findByText(/Adelanto S\/ 20.00/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Editar" })).toBeInTheDocument();
    expect(screen.getByText("Por definir")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Tienda de la política"), { target: { value: "s2" } });
    await waitFor(() => expect(panel.getStorePolicy).toHaveBeenCalledWith("s2"));
  });
});

const row = (over: Partial<SalesBoardRow> = {}): SalesBoardRow => ({
  kind: "order",
  id: "o1",
  coreId: "core-1",
  number: "PED-1",
  conversationId: "c1",
  contactName: "Ana",
  channel: "whatsapp",
  sellerId: "u1",
  sellerName: "Rosa",
  status: null,
  total: 100,
  paid: 30,
  publicUrl: null,
  orderId: "ord-1",
  createdAt: "2026-11-20T15:00:00.000Z",
  bucket: "pending",
  ...over,
});

describe("Ventas · V3 con datos del Core", () => {
  it("ciudad, pago/envío y acciones Pagos, Editar, Seguimiento y WhatsApp", async () => {
    t.getSalesBoard.mockResolvedValue([row(), row({ id: "q1", kind: "quote", orderId: null, number: "COT-1" })]);
    e.getSalesBoardExtras.mockResolvedValue([
      {
        orderId: "ord-1",
        city: "Arequipa",
        province: "Arequipa",
        district: "Cayma",
        units: 3,
        phone: "+51 999 111 222",
        deliveryType: "PROVINCIA",
        courier: "Shalom",
        trackingUrl: "https://track.example/ord-1",
        guideNumber: "G-1",
        paymentMethods: ["YAPE"],
        payments: [{ id: "p1", amount: 30, method: "YAPE", status: "VALIDADO", paidAt: "2026-11-20T15:00:00.000Z", proofUrl: null }],
      },
    ]);
    wrap(<VentasView />);
    const cities = await screen.findAllByTestId("row-city");
    await waitFor(() => expect(cities[0]).toHaveTextContent("Arequipa, Arequipa3 unidades"));
    expect(cities[1]).toHaveTextContent("—");
    expect(screen.getAllByTestId("row-payship")[0]).toHaveTextContent("YapeProvincia · Shalom");
    expect(e.getSalesBoardExtras).toHaveBeenCalledWith(["ord-1"]);
    expect(screen.getByRole("link", { name: "Editar PED-1 en el Core" })).toHaveAttribute("href", "/registrar-venta?orderId=ord-1");
    expect(screen.getByRole("link", { name: "Seguimiento de PED-1" })).toHaveAttribute("href", "https://track.example/ord-1");
    expect(screen.getAllByRole("link", { name: "Abrir chat de Ana" })[0]).toHaveTextContent("WhatsApp");
    fireEvent.click(screen.getByRole("button", { name: "Ver pagos de PED-1" }));
    expect(within(await screen.findByTestId("payments-list")).getByText("S/ 30.00")).toBeInTheDocument();
  });

  it("si el Core no responde, la tabla sigue y muestra —", async () => {
    t.getSalesBoard.mockResolvedValue([row()]);
    e.getSalesBoardExtras.mockRejectedValue(new Error("503"));
    wrap(<VentasView />);
    const city = await screen.findByTestId("row-city");
    await waitFor(() => expect(city).toHaveTextContent("—"));
    expect(screen.getByRole("button", { name: "Seguimiento de PED-1" })).toBeDisabled();
  });
});
