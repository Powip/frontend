import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import LiveConsolePage from "../LiveConsolePage";
import { copyLiveText } from "../liveCopy";
import {
  getLiveConsole,
  getLiveYapeReviews,
  updateLiveConfig,
  updateLiveProducts,
} from "../liveService";
import type { LiveConsoleData, LiveProduct } from "../types";

const mockReplace = jest.fn();
let mockTab = "console";
jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace }),
  useSearchParams: () => new URLSearchParams(`tab=${mockTab}`),
}));
jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    auth: {
      user: { id: "admin", role: "ADMINISTRADOR", permissions: [] },
      company: { id: "company", stores: [{ id: "store-a", name: "Tienda" }] },
    },
    selectedStoreId: "store-a",
    setSelectedStore: jest.fn(),
  }),
}));
jest.mock("sonner", () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));
jest.mock("../liveCopy", () => ({
  copyLiveText: jest.fn().mockResolvedValue("copied"),
}));
jest.mock("@/services/userService", () => ({
  getUsersByCompany: jest.fn().mockResolvedValue([]),
}));
jest.mock("../liveService", () => ({
  ...jest.requireActual("../liveService"),
  getLiveConsole: jest.fn(),
  getLiveYapeReviews: jest.fn(),
  updateLiveConfig: jest.fn(),
  updateLiveProducts: jest.fn(),
}));
beforeAll(() => {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

const variant = (variantId: string, Talla: string): LiveProduct => ({
  variantId,
  productId: "short",
  name: "Short Sastre Luisa",
  sku: `SSL-${Talla}`,
  attributes: { Talla },
  variantLabel: Talla,
  regularPrice: 149,
  livePrice: 119,
  availableStock: 3,
  maxPerCustomer: null,
  enabled: true,
});
const consoleData = (): LiveConsoleData => ({
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
    slug: "kunca",
  },
  session: {
    id: "session",
    status: "ENDED",
    platform: "TIKTOK",
    pinnedVariantId: null,
  },
  products: [variant("s", "S"), variant("m", "M")],
  reservations: [],
  trustedCustomers: [],
  metrics: {
    totalSales: 420,
    orderCount: 3,
    pendingSales: 150,
    pendingPaymentCount: 2,
    instantOrderCount: 0,
    activeReservations: 4,
    visits: 11,
  },
  paymentMethods: ["yape"],
  capabilities: {
    readConsole: true,
    manage: true,
    operate: true,
    reviewPayments: true,
  },
  readiness: { ready: true, checks: [] },
  serverNow: "2026-11-24T12:00:00Z",
});
beforeEach(() => {
  jest.clearAllMocks();
  mockTab = "console";
  (getLiveConsole as jest.Mock).mockResolvedValue(consoleData());
  (getLiveYapeReviews as jest.Mock).mockResolvedValue({
    reviews: [],
    serverNow: "x",
  });
});

test("tabs follow the mockup order", async () => {
  render(<LiveConsolePage />);
  await screen.findByText("Ventas validadas");
  expect(
    screen
      .getAllByRole("tab")
      .map((tab) => tab.textContent?.replace(/\d+$/, "")),
  ).toEqual([
    "Consola en vivo",
    "Apartados",
    "Productos del live",
    "Configuración",
    "Pagos por revisar",
  ]);
});

test("A11: validated sales read as good (teal) and pending ones as attention (amber) with a shortcut", async () => {
  render(<LiveConsolePage />);
  const validated = await screen.findByText("S/ 420.00");
  expect(validated).toHaveClass("text-teal-700");
  expect(screen.getByText("S/ 150.00")).toHaveClass("text-amber-700");
  fireEvent.click(screen.getByRole("button", { name: "Validar pagos →" }));
  expect(mockReplace).toHaveBeenCalledWith("/live?tab=payments", {
    scroll: false,
  });
});

test("A2: the catalog link has a «Copiar link» button", async () => {
  render(<LiveConsolePage />);
  expect(
    await screen.findByRole("button", { name: "Copiar link" }),
  ).toBeEnabled();
  expect(
    screen.getByRole("button", { name: "Copiar comentario" }),
  ).toBeEnabled();
});

test("editing a product sets one live price and one max for all its variants", async () => {
  mockTab = "products";
  (updateLiveProducts as jest.Mock).mockResolvedValue({ products: [] });
  render(<LiveConsolePage />);
  fireEvent.click(
    await screen.findByRole("button", { name: "Editar Short Sastre Luisa" }),
  );
  const dialog = screen.getByRole("dialog", { name: "Short Sastre Luisa" });
  fireEvent.change(within(dialog).getByLabelText("Precio live (S/)"), {
    target: { value: "99.90" },
  });
  fireEvent.change(within(dialog).getByLabelText("Máximo por cliente"), {
    target: { value: "2" },
  });
  fireEvent.click(
    within(dialog).getByRole("button", { name: "Guardar producto" }),
  );
  await waitFor(() =>
    expect(updateLiveProducts).toHaveBeenCalledWith("store-a", {
      variantIds: ["s", "m"],
      livePrice: 99.9,
      maxPerCustomer: 2,
    }),
  );
});

test("the product switch publishes or retires the whole product", async () => {
  mockTab = "products";
  (updateLiveProducts as jest.Mock).mockResolvedValue({ products: [] });
  render(<LiveConsolePage />);
  fireEvent.click(
    await screen.findByRole("switch", { name: "Publicar Short Sastre Luisa" }),
  );
  await waitFor(() =>
    expect(updateLiveProducts).toHaveBeenCalledWith("store-a", {
      variantIds: ["s", "m"],
      enabled: false,
    }),
  );
});

test("A2: each advisor's «Copiar link» copies exactly that advisor's link", async () => {
  const value = consoleData();
  value.config.advisors = [
    { id: "a1", name: "Ana", code: "ana-111111" },
    { id: "b2", name: "Bea", code: "bea-222222" },
  ];
  (getLiveConsole as jest.Mock).mockResolvedValue(value);
  render(<LiveConsolePage />);
  await screen.findByText("Bea");
  const bea = screen.getByText("Bea").closest("div")!.parentElement!;
  fireEvent.click(within(bea).getByRole("button", { name: "Copiar link" }));
  await waitFor(() => expect(copyLiveText).toHaveBeenCalledTimes(1));
  expect((copyLiveText as jest.Mock).mock.calls[0][0]).toMatch(
    /\?a=bea-222222$/,
  );
});

test("A1: marking an advisor as commission seller sends only the advisors", async () => {
  const value = consoleData();
  value.config.advisors = [{ id: "a1", name: "Ana", code: "ana-111111" }];
  (getLiveConsole as jest.Mock).mockResolvedValue(value);
  (updateLiveConfig as jest.Mock).mockResolvedValue({ config: value.config });
  render(<LiveConsolePage />);
  fireEvent.click(
    await screen.findByRole("checkbox", { name: "Vendedor por comisión" }),
  );
  await waitFor(() =>
    expect(updateLiveConfig).toHaveBeenCalledWith("store-a", {
      advisors: [
        { id: "a1", name: "Ana", code: "ana-111111", commission: true },
      ],
    }),
  );
});
