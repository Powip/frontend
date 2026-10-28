import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import LiveConsolePage from "../LiveConsolePage";
import {
  getLiveConsole,
  getLiveYapeConfig,
  getLiveYapeReviews,
  updateLiveConfig,
  updateLiveSession,
  updateLiveYapeConfig,
} from "../liveService";
import type { LiveConsoleData, LiveReviewConsoleData } from "../types";

const mockReplace = jest.fn();
let mockStore = "store-a";
let mockTab = "config";
let mockRole = "VENTAS";
let mockUserId = "reviewer";
jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace }),
  useSearchParams: () => new URLSearchParams(`tab=${mockTab}`),
}));
jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    auth: {
      user: { id: mockUserId, role: mockRole, permissions: [] },
      company: { id: "company", stores: [{ id: mockStore, name: "Tienda" }] },
    },
    selectedStoreId: mockStore,
    setSelectedStore: jest.fn(),
  }),
}));
jest.mock("../liveService", () => ({
  ...jest.requireActual("../liveService"),
  getLiveConsole: jest.fn(),
  getLiveYapeReviews: jest.fn(),
  getLiveYapeConfig: jest.fn(),
  updateLiveConfig: jest.fn(),
  updateLiveSession: jest.fn(),
  updateLiveYapeConfig: jest.fn(),
}));
const minimal = (id = "store-a"): LiveReviewConsoleData => ({
  store: { id, name: "Tienda" },
  capabilities: {
    readConsole: false,
    read: false,
    manage: false,
    operate: false,
    reviewPayments: true,
  },
  serverNow: "2026-10-20T12:00:00Z",
});
beforeAll(() => {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});
beforeEach(() => {
  jest.clearAllMocks();
  mockStore = "store-a";
  mockTab = "config";
  mockRole = "VENTAS";
  mockUserId = "reviewer";
  (getLiveConsole as jest.Mock).mockResolvedValue(minimal());
  (getLiveYapeReviews as jest.Mock).mockResolvedValue({
    reviews: [],
    serverNow: "2026-10-20T12:00:00Z",
  });
});

test("server-scoped review payload exposes no console configuration or sales", async () => {
  render(<LiveConsolePage />);
  await screen.findByText("No hay comprobantes pendientes de revisión.");
  expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual(["Pagos por revisar"]);
  expect(screen.queryByText("Configuración")).not.toBeInTheDocument();
  expect(screen.queryByText("Ventas del live")).not.toBeInTheDocument();
  expect(screen.queryByText("Conectar Mercado Pago")).not.toBeInTheDocument();
  expect(mockReplace).toHaveBeenCalledWith("/live?tab=payments", { scroll: false });
  expect(getLiveYapeReviews).toHaveBeenCalledWith("store-a", expect.any(AbortSignal));
});

function fullConsole(ready: boolean, enabled = false): LiveConsoleData {
  return {
    config: {
      enabled,
      allowBuyNow: true,
      allowReservations: true,
      reservationMinutes: 15,
      maxReservedUnits: 5,
      allowAccumulation: false,
      combineShipping: false,
      homeShipping: 0,
      agencyShipping: null,
      reminderEnabled: false,
      showBackLink: false,
      allowSellerLive: false,
      closePolicy: "MANUAL",
      liveUrl: "",
    },
    session: { id: "session", status: "CLOSED", platform: "TIKTOK", pinnedVariantId: null },
    products: [],
    reservations: [],
    trustedCustomers: [],
    metrics: {
      totalSales: 0,
      orderCount: 0,
      instantOrderCount: 0,
      activeReservations: 0,
      visits: 0,
    },
    paymentMethods: ["yape"],
    capabilities: { readConsole: true, manage: true, operate: true, reviewPayments: true },
    readiness: {
      ready,
      checks: [
        {
          code: "STOCK",
          ready,
          message: ready ? "Stock disponible" : "Agrega productos con stock",
        },
      ],
    },
    deliveryMethods: ["HOME"],
    serverNow: "2026-10-23T12:00:00Z",
  };
}

test("opening controls stay disabled until the server confirms readiness and purchases are enabled", async () => {
  mockTab = "console";
  mockRole = "ADMINISTRADOR";
  (getLiveConsole as jest.Mock).mockResolvedValue(fullConsole(false, true));
  render(<LiveConsolePage />);
  await screen.findByText("Agrega productos con stock");
  expect(screen.getByRole("button", { name: "Estoy en vivo" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Abrir catálogo" })).toBeDisabled();
  expect(updateLiveSession).not.toHaveBeenCalled();
  (getLiveConsole as jest.Mock).mockResolvedValue(fullConsole(true, false));
  fireEvent.click(screen.getByRole("button", { name: "Actualizar live" }));
  await screen.findByRole("heading", { name: "Catálogo preparado" });
  expect(screen.getByRole("button", { name: "Estoy en vivo" })).toBeDisabled();
  (getLiveConsole as jest.Mock).mockResolvedValue(fullConsole(true, true));
  fireEvent.click(screen.getByRole("button", { name: "Actualizar live" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Estoy en vivo" })).toBeEnabled());
  expect(screen.getByRole("button", { name: "Abrir catálogo" })).toBeEnabled();
});

test("configuration remains editable while purchases are off and enable requires server readiness", async () => {
  mockTab = "config";
  mockRole = "ADMINISTRADOR";
  (getLiveConsole as jest.Mock).mockResolvedValue(fullConsole(false));
  (getLiveYapeConfig as jest.Mock).mockResolvedValue({
    config: { enabled: false, phone: "", holder: "", qrUrl: null, reviewHours: 24 },
  });
  render(<LiveConsolePage />);
  const toggle = await screen.findByRole("switch", { name: /^Habilitar compras del live/ });
  expect(toggle).not.toBeChecked();
  expect(toggle).toBeDisabled();
  expect(screen.getByLabelText("Envío a domicilio")).toBeEnabled();
  expect(screen.getByRole("button", { name: "Guardar configuración" })).toBeEnabled();
  (getLiveConsole as jest.Mock).mockResolvedValue(fullConsole(true));
  fireEvent.click(screen.getByRole("button", { name: "Actualizar live" }));
  await waitFor(() => expect(toggle).toBeEnabled());
  fireEvent.click(toggle);
  expect(screen.getByText(/Activación sin guardar/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Guardar y habilitar compras" }));
  await waitFor(() =>
    expect(updateLiveConfig).toHaveBeenCalledWith(
      "store-a",
      expect.objectContaining({ enabled: true }),
    ),
  );
});

test("disabled opening controls describe missing setup and link to the relevant tab", async () => {
  mockTab = "console";
  mockRole = "ADMINISTRADOR";
  (getLiveConsole as jest.Mock).mockResolvedValue(fullConsole(false));
  render(<LiveConsolePage />);
  const open = await screen.findByRole("button", { name: "Estoy en vivo" });
  expect(open).toBeDisabled();
  expect(open).toHaveAccessibleDescription("Falta completar: Stock disponible.");
  fireEvent.click(screen.getByRole("button", { name: "Ir a Productos" }));
  expect(mockReplace).toHaveBeenCalledWith("/live?tab=products", { scroll: false });
  expect(updateLiveSession).not.toHaveBeenCalled();
});

test.each([
  ["YAPE", "live-yape-settings"],
  ["SHIPPING", "live-shipping-settings"],
] as const)(
  "the console setup shortcut focuses missing %s instead of the disabled purchases switch",
  async (code, targetId) => {
    mockTab = "console";
    mockRole = "ADMINISTRADOR";
    const saved = fullConsole(false);
    saved.readiness = { ready: false, checks: [{ code, ready: false, message: `Falta ${code}` }] };
    (getLiveConsole as jest.Mock).mockResolvedValue(saved);
    (getLiveYapeConfig as jest.Mock).mockResolvedValue({
      config: { enabled: false, phone: "", holder: "", qrUrl: null, reviewHours: 24 },
    });
    const view = render(<LiveConsolePage />);
    fireEvent.click(await screen.findByRole("button", { name: "Ir a Configuración" }));
    expect(mockReplace).toHaveBeenCalledWith("/live?tab=config", { scroll: false });
    mockTab = "config";
    view.rerender(<LiveConsolePage />);
    await waitFor(() => expect(document.getElementById(targetId)).toHaveFocus());
  },
);

test("save shipping, enable purchases and save activation before opening; refresh preserves the draft", async () => {
  mockRole = "ADMINISTRADOR";
  let saved = fullConsole(false);
  saved.config.homeShipping = null;
  saved.readiness = {
    ready: false,
    checks: [{ code: "SHIPPING", ready: false, message: "Configura una tarifa de envío" }],
  };
  (getLiveConsole as jest.Mock).mockImplementation(async () => saved);
  (getLiveYapeConfig as jest.Mock).mockResolvedValue({
    config: { enabled: true, phone: "912345678", holder: "Negocio", qrUrl: null, reviewHours: 24 },
  });
  (updateLiveConfig as jest.Mock).mockImplementation(async (_storeId, config) => {
    saved = {
      ...saved,
      config,
      readiness: {
        ready: true,
        checks: [{ code: "SHIPPING", ready: true, message: "Envío configurado" }],
      },
    };
    return { config };
  });
  const view = render(<LiveConsolePage />);
  const toggle = await screen.findByRole("switch", { name: /^Habilitar compras del live/ });
  fireEvent.click(screen.getByRole("button", { name: "Configurar envío" }));
  await waitFor(() => expect(document.getElementById("live-shipping-settings")).toHaveFocus());
  fireEvent.change(screen.getByLabelText("Envío a domicilio"), { target: { value: "10" } });
  expect(toggle).toBeDisabled();
  expect(toggle).toHaveAccessibleDescription(/Primero guarda las tarifas/);
  fireEvent.click(screen.getByRole("button", { name: "Guardar configuración" }));
  await waitFor(() => expect(toggle).toBeEnabled());
  expect(updateLiveConfig).toHaveBeenLastCalledWith(
    "store-a",
    expect.objectContaining({ enabled: false, homeShipping: 10 }),
  );
  fireEvent.click(toggle);
  expect(toggle).toBeChecked();
  expect(toggle).toHaveAccessibleDescription(/Activación sin guardar/);
  fireEvent.click(screen.getByRole("button", { name: "Actualizar live" }));
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Actualizar live" })).toBeEnabled(),
  );
  expect(toggle).toBeChecked();
  expect(toggle).toHaveAccessibleDescription(/Activación sin guardar/);
  expect(updateLiveConfig).toHaveBeenCalledTimes(1);
  expect(updateLiveSession).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Guardar y habilitar compras" }));
  await screen.findByRole("button", { name: "Ir a Consola en vivo" });
  expect(updateLiveConfig).toHaveBeenLastCalledWith(
    "store-a",
    expect.objectContaining({ enabled: true, homeShipping: 10 }),
  );
  mockTab = "console";
  view.rerender(<LiveConsolePage />);
  expect(screen.getByRole("button", { name: "Estoy en vivo" })).toBeEnabled();
  expect(screen.getByRole("button", { name: "Abrir catálogo" })).toBeEnabled();
});

test("saving Yape refreshes opening requirements immediately", async () => {
  mockRole = "ADMINISTRADOR";
  const before = fullConsole(false);
  before.readiness = {
    ready: false,
    checks: [{ code: "YAPE", ready: false, message: "Configura el Yape del negocio" }],
  };
  (getLiveConsole as jest.Mock).mockResolvedValue(before);
  (getLiveYapeConfig as jest.Mock).mockResolvedValue({
    config: { enabled: false, phone: "912345678", holder: "Negocio", qrUrl: null, reviewHours: 24 },
  });
  (updateLiveYapeConfig as jest.Mock).mockImplementation(async (_store, config) => {
    (getLiveConsole as jest.Mock).mockResolvedValue(fullConsole(true));
    return { config };
  });
  render(<LiveConsolePage />);
  fireEvent.click(await screen.findByRole("switch", { name: "Permitir pagar por Yape" }));
  fireEvent.click(screen.getByRole("button", { name: "Guardar Yape" }));
  await screen.findByRole("heading", { name: "Catálogo preparado" });
  expect(getLiveConsole).toHaveBeenCalledTimes(2);
  expect(screen.getByRole("switch", { name: /^Habilitar compras del live/ })).toBeEnabled();
});

test("an active live can still be ended or closed when readiness changes", async () => {
  mockTab = "console";
  mockRole = "ADMINISTRADOR";
  const active = fullConsole(false, true);
  active.session = { id: "session", status: "LIVE", platform: "TIKTOK", pinnedVariantId: null };
  (getLiveConsole as jest.Mock).mockResolvedValue(active);
  render(<LiveConsolePage />);
  expect(await screen.findByRole("button", { name: "Terminar live" })).toBeEnabled();
  expect(screen.getByRole("button", { name: "Cerrar catálogo" })).toBeEnabled();
});

test("finance role cannot override server denial of payment review", async () => {
  mockRole = "FINANZAS";
  (getLiveConsole as jest.Mock).mockResolvedValue({
    ...minimal(),
    capabilities: { ...minimal().capabilities, reviewPayments: false },
  });
  render(<LiveConsolePage />);
  await screen.findByText(/rol Administrador vigente/);
  expect(getLiveYapeReviews).not.toHaveBeenCalled();
});

test("late console authorization for previous store cannot replace current store", async () => {
  let resolveOld!: (data: LiveReviewConsoleData) => void;
  (getLiveConsole as jest.Mock)
    .mockReturnValueOnce(
      new Promise<LiveReviewConsoleData>((resolve) => {
        resolveOld = resolve;
      }),
    )
    .mockResolvedValue(minimal("store-b"));
  const view = render(<LiveConsolePage />);
  mockStore = "store-b";
  view.rerender(<LiveConsolePage />);
  await screen.findByText("No hay comprobantes pendientes de revisión.");
  await act(async () =>
    resolveOld({
      ...minimal(),
      capabilities: { ...minimal().capabilities, reviewPayments: false },
    }),
  );
  await waitFor(() =>
    expect(getLiveYapeReviews).toHaveBeenCalledWith("store-b", expect.any(AbortSignal)),
  );
  expect(screen.queryByText(/rol Administrador vigente/)).not.toBeInTheDocument();
});

test("a late authorization response from the previous account cannot replace the current account", async () => {
  let resolveOld!: (data: LiveReviewConsoleData) => void;
  (getLiveConsole as jest.Mock)
    .mockReturnValueOnce(
      new Promise<LiveReviewConsoleData>((resolve) => {
        resolveOld = resolve;
      }),
    )
    .mockResolvedValue({
      ...minimal(),
      capabilities: { ...minimal().capabilities, reviewPayments: false },
    });
  const view = render(<LiveConsolePage />);
  mockUserId = "other-account";
  view.rerender(<LiveConsolePage />);
  await screen.findByText(/rol Administrador vigente/);
  await act(async () => resolveOld(minimal()));
  expect(getLiveYapeReviews).not.toHaveBeenCalled();
  expect(screen.getByText(/rol Administrador vigente/)).toBeInTheDocument();
});

test("administrator config starts without invented shipping prices and saves the explicit amount", async () => {
  const consoleData: LiveConsoleData = {
    config: {
      enabled: true,
      allowBuyNow: true,
      allowReservations: true,
      reservationMinutes: 15,
      maxReservedUnits: 5,
      allowAccumulation: false,
      combineShipping: false,
      homeShipping: null,
      agencyShipping: null,
      reminderEnabled: false,
      showBackLink: false,
      allowSellerLive: false,
      closePolicy: "MANUAL",
      liveUrl: "",
    },
    session: null,
    products: [],
    reservations: [],
    trustedCustomers: [],
    metrics: {
      totalSales: 0,
      orderCount: 0,
      instantOrderCount: 0,
      activeReservations: 0,
      visits: 0,
    },
    paymentMethods: ["yape"],
    capabilities: { manage: true, operate: true, reviewPayments: true },
    serverNow: "2026-10-22T12:00:00Z",
  };
  (getLiveConsole as jest.Mock).mockResolvedValue(consoleData);
  (getLiveYapeConfig as jest.Mock).mockResolvedValue({
    config: { enabled: false, phone: "", holder: "", qrUrl: null, reviewHours: 24 },
  });
  (updateLiveConfig as jest.Mock).mockResolvedValue({ config: consoleData.config });
  render(<LiveConsolePage />);
  const home = await screen.findByLabelText("Envío a domicilio");
  const agency = screen.getByLabelText("Envío a agencia");
  expect(home).toHaveValue(null);
  expect(agency).toHaveValue(null);
  expect(
    screen.queryByRole("switch", { name: "Juntar compras en un envío" }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("switch", { name: "Recordatorio por WhatsApp" }),
  ).not.toBeInTheDocument();
  expect(screen.queryByRole("switch", { name: "Live de vendedores" })).not.toBeInTheDocument();
  fireEvent.change(home, { target: { value: "10.125" } });
  expect(screen.getByRole("button", { name: "Guardar configuración" })).toBeDisabled();
  fireEvent.change(home, { target: { value: "10.50" } });
  fireEvent.click(screen.getByRole("button", { name: "Guardar configuración" }));
  await waitFor(() =>
    expect(updateLiveConfig).toHaveBeenCalledWith(
      "store-a",
      expect.objectContaining({
        homeShipping: 10.5,
        agencyShipping: null,
        combineShipping: false,
        allowAccumulation: false,
      }),
    ),
  );
});
