import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import LiveConsolePage from "../LiveConsolePage";
import { getLiveConsole, updateLiveSession } from "../liveService";
import type { LiveConsoleData } from "../types";

let mockStore = "store-a";
let mockTab = "products";
let mockVisibility: DocumentVisibilityState = "visible";
jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace: jest.fn() }),
  useSearchParams: () => new URLSearchParams(`tab=${mockTab}`),
}));
jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    auth: {
      user: { id: "admin", role: "ADMINISTRADOR", permissions: [] },
      company: {
        id: "company",
        stores: [
          { id: "store-a", name: "Tienda A" },
          { id: "store-b", name: "Tienda B" },
        ],
      },
    },
    selectedStoreId: mockStore,
    setSelectedStore: jest.fn(),
  }),
}));
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
jest.mock("../liveService", () => ({
  ...jest.requireActual("../liveService"),
  getLiveConsole: jest.fn(),
  updateLiveSession: jest.fn(),
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
function consoleData(label = "A"): LiveConsoleData {
  return {
    config: {
      enabled: true,
      allowBuyNow: true,
      allowReservations: true,
      reservationMinutes: 15,
      maxReservedUnits: 5,
      allowAccumulation: false,
      combineShipping: false,
      homeShipping: 10,
      agencyShipping: null,
      reminderEnabled: false,
      showBackLink: false,
      allowSellerLive: false,
      closePolicy: "MANUAL",
      liveUrl: "",
    },
    session: {
      id: "session",
      status: "LIVE",
      platform: "TIKTOK",
      pinnedVariantId: `variant-${label}`,
    },
    products: [
      {
        variantId: `variant-${label}`,
        productId: `product-${label}`,
        name: `Producto ${label}`,
        sku: `SKU-${label}`,
        regularPrice: 20,
        livePrice: 15,
        availableStock: 5,
        maxPerCustomer: null,
        enabled: true,
      },
    ],
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
    deliveryMethods: ["HOME"],
    capabilities: {
      readConsole: true,
      read: true,
      manage: true,
      operate: true,
      reviewPayments: true,
    },
    readiness: {
      ready: true,
      checks: ["YAPE", "PRODUCTS", "STOCK", "SHIPPING", "CUSTOMER_REVIEW"].map((code) => ({
        code,
        ready: true,
        message: "Preparado",
      })),
    } as LiveConsoleData["readiness"],
    serverNow: "2026-10-28T12:00:00Z",
  };
}
async function flush() {
  await act(async () => {
    for (let index = 0; index < 10; index += 1) await Promise.resolve();
  });
}
async function tick(milliseconds: number) {
  await act(async () => {
    jest.advanceTimersByTime(milliseconds);
    for (let index = 0; index < 10; index += 1) await Promise.resolve();
  });
}
beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  mockStore = "store-a";
  mockTab = "products";
  mockVisibility = "visible";
  jest.spyOn(document, "visibilityState", "get").mockImplementation(() => mockVisibility);
  (getLiveConsole as jest.Mock).mockReset().mockResolvedValue(consoleData());
  (updateLiveSession as jest.Mock).mockReset().mockResolvedValue({});
});
afterEach(() => {
  cleanup();
  jest.restoreAllMocks();
  jest.useRealTimers();
});

test("a slow console read completes before the next poll interval begins", async () => {
  const pending = deferred<LiveConsoleData>();
  (getLiveConsole as jest.Mock).mockReturnValueOnce(pending.promise);
  render(<LiveConsolePage />);
  await flush();
  await tick(12000);
  expect(getLiveConsole).toHaveBeenCalledTimes(1);
  pending.resolve(consoleData());
  await flush();
  expect(screen.getByText("Producto A")).toBeInTheDocument();
  await tick(7999);
  expect(getLiveConsole).toHaveBeenCalledTimes(1);
  await tick(1);
  expect(getLiveConsole).toHaveBeenCalledTimes(2);
});

test("hidden consoles make no initial request and resume once for focus and visibility together", async () => {
  mockVisibility = "hidden";
  render(<LiveConsolePage />);
  await tick(30000);
  expect(getLiveConsole).not.toHaveBeenCalled();
  mockVisibility = "visible";
  act(() => {
    document.dispatchEvent(new Event("visibilitychange"));
    window.dispatchEvent(new Event("focus"));
  });
  await flush();
  expect(getLiveConsole).toHaveBeenCalledTimes(1);
  expect(screen.getByText("Producto A")).toBeInTheDocument();
  mockVisibility = "hidden";
  act(() => document.dispatchEvent(new Event("visibilitychange")));
  await tick(30000);
  expect(getLiveConsole).toHaveBeenCalledTimes(1);
});

test("changing stores aborts the old request and rejects its late snapshot", async () => {
  const old = deferred<LiveConsoleData>();
  (getLiveConsole as jest.Mock)
    .mockReturnValueOnce(old.promise)
    .mockResolvedValueOnce(consoleData("B"));
  const view = render(<LiveConsolePage />);
  await flush();
  const signal = (getLiveConsole as jest.Mock).mock.calls[0][1] as AbortSignal;
  mockStore = "store-b";
  view.rerender(<LiveConsolePage />);
  await flush();
  expect(signal.aborted).toBe(true);
  expect(getLiveConsole).toHaveBeenLastCalledWith("store-b", expect.any(AbortSignal));
  expect(screen.getByText("Producto B")).toBeInTheDocument();
  old.resolve(consoleData("A"));
  await flush();
  expect(screen.getByText("Producto B")).toBeInTheDocument();
  expect(screen.queryByText("Producto A")).not.toBeInTheDocument();
  view.unmount();
  await tick(20000);
  expect(getLiveConsole).toHaveBeenCalledTimes(2);
});

test("transient errors retain the last snapshot and recover, while read denial clears it", async () => {
  (getLiveConsole as jest.Mock)
    .mockResolvedValueOnce(consoleData())
    .mockRejectedValueOnce(new Error("Fallo temporal"))
    .mockResolvedValueOnce(consoleData("Recuperado"))
    .mockRejectedValueOnce(
      Object.assign(new Error("Sesión expirada"), {
        isAxiosError: true,
        response: { status: 401, data: { message: "Sesión expirada" } },
      }),
    );
  render(<LiveConsolePage />);
  await flush();
  await tick(8000);
  expect(screen.getByText("Producto A")).toBeInTheDocument();
  expect(screen.getByRole("alert")).toHaveTextContent("Fallo temporal");
  await tick(8000);
  expect(screen.getByText("Producto Recuperado")).toBeInTheDocument();
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  await tick(8000);
  expect(screen.queryByText("Producto Recuperado")).not.toBeInTheDocument();
  expect(screen.getByRole("alert")).toHaveTextContent("Sesión expirada");
});

test("a pending action pauses polling and receives one fresh read after it completes", async () => {
  mockTab = "console";
  const operation = deferred<unknown>();
  const ended = consoleData();
  if (ended.session) ended.session.status = "ENDED";
  (getLiveConsole as jest.Mock).mockResolvedValueOnce(consoleData()).mockResolvedValueOnce(ended);
  (updateLiveSession as jest.Mock).mockReturnValueOnce(operation.promise);
  render(<LiveConsolePage />);
  await flush();
  fireEvent.click(screen.getByRole("button", { name: "Terminar live" }));
  await tick(24000);
  expect(updateLiveSession).toHaveBeenCalledTimes(1);
  expect(getLiveConsole).toHaveBeenCalledTimes(1);
  operation.resolve({});
  await flush();
  expect(getLiveConsole).toHaveBeenCalledTimes(2);
  expect(screen.getByText("Live terminado · catálogo abierto")).toBeInTheDocument();
  await tick(14999);
  expect(getLiveConsole).toHaveBeenCalledTimes(2);
  await tick(1);
  expect(getLiveConsole).toHaveBeenCalledTimes(3);
});
