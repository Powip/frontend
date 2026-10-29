import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import LiveYapeReviews from "../LiveYapeReviews";
import { getLiveYapeReviewProof, getLiveYapeReviews, reviewLiveYapePayment } from "../liveService";
import type { LiveYapeReview } from "../types";

jest.mock("../liveService", () => ({
  ...jest.requireActual("../liveService"),
  getLiveYapeReviews: jest.fn(),
  getLiveYapeReviewProof: jest.fn(),
  reviewLiveYapePayment: jest.fn(),
}));
let visibility: DocumentVisibilityState = "visible";
const originalRandomUUID = Object.getOwnPropertyDescriptor(crypto, "randomUUID");
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
function row(label = "A"): LiveYapeReview {
  return {
    checkoutId: `checkout-${label.toLowerCase()}`,
    status: "AWAITING_PAYMENT",
    method: "yape",
    customer: { name: `Cliente ${label}`, phone: "900000049" },
    quote: {
      quoteId: `quote-${label}`,
      expiresAt: "2026-10-28T13:00:00Z",
      subtotal: 40,
      shipping: 10,
      total: 50,
    },
    manualPayment: {
      status: "UNDER_REVIEW",
      phone: "900000049",
      holder: "Negocio local",
      operationNumber: "123456",
      proofDeadlineAt: null,
      reviewDeadlineAt: null,
    },
    createdAt: "2026-10-28T12:00:00Z",
  };
}
const response = (reviews = [row()]) => ({ reviews, serverNow: "2026-10-28T12:00:00Z" });
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
beforeAll(() => {
  Object.defineProperty(crypto, "randomUUID", {
    configurable: true,
    value: () => "00000000-0000-4000-8000-000000000049",
  });
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});
afterAll(() => {
  if (originalRandomUUID) Object.defineProperty(crypto, "randomUUID", originalRandomUUID);
  else Reflect.deleteProperty(crypto, "randomUUID");
});
beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  visibility = "visible";
  jest.spyOn(document, "visibilityState", "get").mockImplementation(() => visibility);
  (getLiveYapeReviews as jest.Mock).mockReset().mockResolvedValue(response());
  (getLiveYapeReviewProof as jest.Mock)
    .mockReset()
    .mockResolvedValue({ url: "https://proof.fixture.invalid/private.png" });
  (reviewLiveYapePayment as jest.Mock).mockReset().mockResolvedValue({ status: "PAID" });
});
afterEach(() => {
  cleanup();
  jest.restoreAllMocks();
  jest.useRealTimers();
});

test("review reads never overlap and start the next interval after the previous response", async () => {
  const pending = deferred<ReturnType<typeof response>>();
  (getLiveYapeReviews as jest.Mock).mockReturnValueOnce(pending.promise);
  render(<LiveYapeReviews storeId="store-a" canReview />);
  await tick(45000);
  expect(getLiveYapeReviews).toHaveBeenCalledTimes(1);
  pending.resolve(response());
  await flush();
  expect(screen.getByText("Cliente A")).toBeInTheDocument();
  await tick(14999);
  expect(getLiveYapeReviews).toHaveBeenCalledTimes(1);
  await tick(1);
  expect(getLiveYapeReviews).toHaveBeenCalledTimes(2);
});

test("hidden review lists pause and resume once when focus and visibility return together", async () => {
  visibility = "hidden";
  render(<LiveYapeReviews storeId="store-a" canReview />);
  await tick(30000);
  expect(getLiveYapeReviews).not.toHaveBeenCalled();
  visibility = "visible";
  act(() => {
    document.dispatchEvent(new Event("visibilitychange"));
    window.dispatchEvent(new Event("focus"));
  });
  await flush();
  expect(getLiveYapeReviews).toHaveBeenCalledTimes(1);
  expect(screen.getByText("Cliente A")).toBeInTheDocument();
  visibility = "hidden";
  act(() => document.dispatchEvent(new Event("visibilitychange")));
  await tick(30000);
  expect(getLiveYapeReviews).toHaveBeenCalledTimes(1);
});

test("changing review scope aborts stale reads and permission removal clears the current list", async () => {
  const old = deferred<ReturnType<typeof response>>();
  (getLiveYapeReviews as jest.Mock)
    .mockReturnValueOnce(old.promise)
    .mockResolvedValueOnce(response([row("B")]));
  const view = render(<LiveYapeReviews storeId="store-a" canReview />);
  await flush();
  const signal = (getLiveYapeReviews as jest.Mock).mock.calls[0][1] as AbortSignal;
  view.rerender(<LiveYapeReviews storeId="store-b" canReview />);
  await flush();
  expect(signal.aborted).toBe(true);
  expect(screen.getByText("Cliente B")).toBeInTheDocument();
  old.resolve(response([row("A")]));
  await flush();
  expect(screen.queryByText("Cliente A")).not.toBeInTheDocument();
  view.rerender(<LiveYapeReviews storeId="store-b" canReview={false} />);
  expect(screen.queryByText("Cliente B")).not.toBeInTheDocument();
  expect(screen.getByText(/rol Administrador vigente/)).toBeInTheDocument();
  await tick(30000);
  act(() => window.dispatchEvent(new Event("focus")));
  await flush();
  expect(getLiveYapeReviews).toHaveBeenCalledTimes(2);
});

test("transient list errors retain rows, while server denial removes previously authorized data", async () => {
  (getLiveYapeReviews as jest.Mock)
    .mockResolvedValueOnce(response())
    .mockRejectedValueOnce(new Error("Servicio temporalmente no disponible"))
    .mockRejectedValueOnce(
      Object.assign(new Error("Acceso retirado"), {
        isAxiosError: true,
        response: { status: 403, data: { message: "Acceso retirado" } },
      }),
    );
  render(<LiveYapeReviews storeId="store-a" canReview />);
  await flush();
  await tick(15000);
  expect(screen.getByText("Cliente A")).toBeInTheDocument();
  expect(screen.getByRole("alert")).toHaveTextContent("Servicio temporalmente no disponible");
  await tick(15000);
  expect(screen.queryByText("Cliente A")).not.toBeInTheDocument();
  expect(screen.getByRole("alert")).toHaveTextContent("Acceso retirado");
});

test("an open review pauses list polling and preserves a failed action and its draft", async () => {
  (reviewLiveYapePayment as jest.Mock).mockRejectedValueOnce(
    new Error("No se pudo validar esta operación"),
  );
  render(<LiveYapeReviews storeId="store-a" canReview />);
  await flush();
  fireEvent.click(screen.getByRole("button", { name: "Revisar y validar" }));
  await flush();
  const operation = screen.getByRole("textbox", { name: "Número de operación verificado en Yape" });
  fireEvent.change(operation, { target: { value: "verificada-123" } });
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(screen.getByRole("button", { name: "Validar pago y confirmar pedido" }));
  await flush();
  expect(screen.getByRole("alert")).toHaveTextContent("No se pudo validar esta operación");
  await tick(60000);
  expect(getLiveYapeReviews).toHaveBeenCalledTimes(1);
  expect(operation).toHaveValue("verificada-123");
  expect(screen.getByRole("checkbox")).toBeChecked();
  expect(screen.getByRole("alert")).toHaveTextContent("No se pudo validar esta operación");
  const proofSignal = (getLiveYapeReviewProof as jest.Mock).mock.calls[0][2] as AbortSignal;
  fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
  await flush();
  expect(proofSignal.aborted).toBe(true);
  expect(getLiveYapeReviews).toHaveBeenCalledTimes(2);
});

test("a completed review gets one immediate fresh list and then resumes the normal interval", async () => {
  (getLiveYapeReviews as jest.Mock)
    .mockResolvedValueOnce(response())
    .mockResolvedValue(response([]));
  render(<LiveYapeReviews storeId="store-a" canReview />);
  await flush();
  fireEvent.click(screen.getByRole("button", { name: "Revisar y validar" }));
  await flush();
  fireEvent.change(
    screen.getByRole("textbox", { name: "Número de operación verificado en Yape" }),
    { target: { value: "123456" } },
  );
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(screen.getByRole("button", { name: "Validar pago y confirmar pedido" }));
  await flush();
  expect(screen.getByText("No hay comprobantes pendientes de revisión.")).toBeInTheDocument();
  expect(
    screen.getByText("Pago validado. El pedido fue confirmado por el servidor."),
  ).toBeInTheDocument();
  expect(getLiveYapeReviews).toHaveBeenCalledTimes(2);
  await tick(14999);
  expect(getLiveYapeReviews).toHaveBeenCalledTimes(2);
  await tick(1);
  expect(getLiveYapeReviews).toHaveBeenCalledTimes(3);
});
