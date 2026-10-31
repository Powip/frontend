import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { getPublicLive, reserveLiveProduct } from "../liveService";
import PublicLivePage from "../PublicLivePage";
import type { LivePublicData } from "../types";

jest.mock("../liveService", () => ({
  ...jest.requireActual("../liveService"),
  getPublicLive: jest.fn(),
  reserveLiveProduct: jest.fn(),
  liveVisitorToken: jest.fn((store: string) => `visitor-${store}`),
}));
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
function publicData(label: string): LivePublicData {
  return {
    store: { id: `store-${label}`, name: `Tienda ${label}` },
    config: {
      enabled: true,
      allowBuyNow: true,
      allowReservations: true,
      reservationMinutes: 15,
      maxReservedUnits: 5,
      allowAccumulation: false,
      combineShipping: false,
      homeShipping: 8,
      agencyShipping: null,
      reminderEnabled: false,
      showBackLink: false,
      allowSellerLive: false,
      closePolicy: "MANUAL",
      liveUrl: "",
    },
    session: { id: `session-${label}`, status: "LIVE", platform: "TIKTOK", pinnedVariantId: null },
    products: [
      {
        variantId: "shared-variant",
        name: `Producto ${label}`,
        sku: "SKU-1",
        variantLabel: "Negro · 41",
        regularPrice: 25,
        livePrice: 20,
        availableStock: 5,
        maxPerCustomer: 5,
        enabled: true,
      },
    ],
    customer: { name: "María Torres", phone: "987654321" },
    reservations: [],
    isTrusted: false,
    paymentMethods: ["yape"],
    serverNow: "2026-10-28T15:00:00.000Z",
  };
}
async function flush() {
  await act(async () => {
    for (let count = 0; count < 10; count += 1) await Promise.resolve();
  });
}
beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date("2026-10-28T15:00:00.000Z"));
  jest.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
  (getPublicLive as jest.Mock)
    .mockReset()
    .mockImplementation((store: string) =>
      Promise.resolve(publicData(store.endsWith("B") ? "B" : "A")),
    );
  (reserveLiveProduct as jest.Mock).mockReset();
  Object.defineProperty(globalThis.crypto, "randomUUID", {
    configurable: true,
    value: jest.fn(() => "attempt-one"),
  });
});
afterEach(() => {
  cleanup();
  jest.restoreAllMocks();
  jest.useRealTimers();
});

test("aborts the old public reader and never displays its late result in the next store", async () => {
  const old = deferred<LivePublicData>();
  (getPublicLive as jest.Mock).mockReturnValueOnce(old.promise);
  const view = render(<PublicLivePage storeId="store-A" />);
  const oldSignal = (getPublicLive as jest.Mock).mock.calls[0][2] as AbortSignal;
  view.rerender(<PublicLivePage storeId="store-B" />);
  await flush();
  expect(oldSignal.aborted).toBe(true);
  expect(screen.getByText("Producto B")).toBeInTheDocument();
  await act(async () => old.resolve(publicData("A")));
  expect(screen.queryByText("Producto A")).not.toBeInTheDocument();
  expect(screen.getByText("Producto B")).toBeInTheDocument();
});

test("a slow public reader does not overlap and resumes after visibility returns", async () => {
  const slow = deferred<LivePublicData>();
  (getPublicLive as jest.Mock).mockReturnValueOnce(slow.promise);
  render(<PublicLivePage storeId="store-A" />);
  await act(async () => jest.advanceTimersByTime(30000));
  expect(getPublicLive).toHaveBeenCalledTimes(1);
  await act(async () => slow.resolve(publicData("A")));
  await act(async () => jest.advanceTimersByTime(5000));
  await flush();
  expect(getPublicLive).toHaveBeenCalledTimes(2);
});

test("a successful background read does not erase a reservation error", async () => {
  (reserveLiveProduct as jest.Mock).mockRejectedValueOnce(
    new Error("No se pudo apartar. Reintenta."),
  );
  render(<PublicLivePage storeId="store-A" />);
  await flush();
  fireEvent.click(screen.getByRole("button", { name: /Separar/ }));
  await flush();
  expect(screen.getByRole("alert")).toHaveTextContent("No se pudo apartar. Reintenta.");
  await flush();
  const reads = (getPublicLive as jest.Mock).mock.calls.length;
  await act(async () => jest.advanceTimersByTime(5_000));
  await flush();
  expect(getPublicLive).toHaveBeenCalledTimes(reads + 1);
  expect(screen.getByRole("alert")).toHaveTextContent("No se pudo apartar. Reintenta.");
});

test("a late reservation cannot reset the quantity selected in the next store", async () => {
  const reserve = deferred<unknown>();
  (reserveLiveProduct as jest.Mock).mockReturnValueOnce(reserve.promise);
  const view = render(<PublicLivePage storeId="store-A" />);
  await flush();
  fireEvent.click(screen.getByRole("button", { name: /Separar/ }));
  view.rerender(<PublicLivePage storeId="store-B" />);
  await flush();
  fireEvent.click(screen.getByRole("button", { name: "Sumar cantidad de Producto B" }));
  const article = screen.getByText("Producto B").closest("article");
  if (!article) throw new Error("Missing product card");
  expect(within(article).getByText("2")).toBeInTheDocument();
  await act(async () => reserve.resolve({ reservation: {} }));
  expect(within(article).getByText("2")).toBeInTheDocument();
  expect(screen.queryByText(/apartado guardado/)).not.toBeInTheDocument();
});
