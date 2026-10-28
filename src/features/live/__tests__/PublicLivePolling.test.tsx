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

test("pauses public polling for checkout, retains its draft on reopen and refreshes after close", async () => {
  render(<PublicLivePage storeId="store-A" />);
  await flush();
  fireEvent.click(screen.getByRole("button", { name: "Comprar ahora" }));
  let dialog = within(await screen.findByRole("dialog"));
  fireEvent.change(dialog.getByLabelText("Dirección"), { target: { value: "Av. Borrador 123" } });
  await act(async () => jest.advanceTimersByTime(20_000));
  window.dispatchEvent(new Event("focus"));
  await flush();
  expect(getPublicLive).toHaveBeenCalledTimes(1);
  fireEvent.click(dialog.getByRole("button", { name: "Close" }));
  await flush();
  expect(getPublicLive).toHaveBeenCalledTimes(2);
  fireEvent.click(screen.getByRole("button", { name: "Comprar ahora" }));
  dialog = within(await screen.findByRole("dialog"));
  expect(dialog.getByLabelText("Dirección")).toHaveValue("Av. Borrador 123");
  expect(dialog.getByRole("button", { name: "Calcular total" })).toBeDisabled();
  expect(dialog.queryByRole("button", { name: /Ver instrucciones Yape/ })).not.toBeInTheDocument();
});

test("a successful background read does not erase a reservation error", async () => {
  (reserveLiveProduct as jest.Mock).mockRejectedValueOnce(
    new Error("No se pudo apartar. Reintenta."),
  );
  render(<PublicLivePage storeId="store-A" />);
  await flush();
  fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: "María Torres" } });
  fireEvent.change(screen.getByLabelText("WhatsApp"), { target: { value: "987654321" } });
  fireEvent.click(screen.getByRole("button", { name: "Apartar" }));
  await flush();
  expect(screen.getByRole("alert")).toHaveTextContent("No se pudo apartar. Reintenta.");
  await act(async () => jest.advanceTimersByTime(5_000));
  await flush();
  expect(getPublicLive).toHaveBeenCalledTimes(2);
  expect(screen.getByRole("alert")).toHaveTextContent("No se pudo apartar. Reintenta.");
});

test("a late reservation cannot reset the quantity selected in the next store", async () => {
  const reserve = deferred<unknown>();
  (reserveLiveProduct as jest.Mock).mockReturnValueOnce(reserve.promise);
  const view = render(<PublicLivePage storeId="store-A" />);
  await flush();
  fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: "María Torres" } });
  fireEvent.change(screen.getByLabelText("WhatsApp"), { target: { value: "987654321" } });
  fireEvent.click(screen.getByRole("button", { name: "Apartar" }));
  view.rerender(<PublicLivePage storeId="store-B" />);
  await flush();
  fireEvent.click(screen.getByRole("button", { name: "Agregar una unidad de Producto B" }));
  const article = screen.getByText("Producto B").closest("article");
  if (!article) throw new Error("Missing product card");
  expect(within(article).getByText("2")).toBeInTheDocument();
  await act(async () => reserve.resolve({ reservation: {} }));
  expect(within(article).getByText("2")).toBeInTheDocument();
  expect(screen.queryByText(/apartado guardado/)).not.toBeInTheDocument();
});
