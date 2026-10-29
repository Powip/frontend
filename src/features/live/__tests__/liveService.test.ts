import axios from "axios";
import axiosAuth from "@/lib/axiosAuth";
import {
  checkoutLivePurchase,
  getLiveCatalog,
  getLiveCheckoutSnapshot,
  getLiveConsole,
  getLiveYapeReviews,
  getPublicLive,
  liveError,
  liveVisitorToken,
  quoteLivePurchase,
  safeLiveUrl,
} from "../liveService";
import type { LivePurchaseInput } from "../types";

jest.mock("axios", () => ({
  __esModule: true,
  default: { post: jest.fn(), get: jest.fn(), delete: jest.fn(), isAxiosError: jest.fn() },
}));
jest.mock("@/lib/axiosAuth", () => ({
  __esModule: true,
  default: { get: jest.fn(), put: jest.fn(), patch: jest.fn(), post: jest.fn() },
}));
const id = "1042cd44-14dd-47e3-9503-ce24f6090853";
const input: LivePurchaseInput = {
  items: [{ variantId: id, quantity: 1 }],
  customer: { name: " María ", phone: "987654321" },
  delivery: {
    type: "AGENCY",
    department: " Arequipa ",
    province: " Arequipa ",
    district: " Cayma ",
    address: " Calle de la agencia 123 ",
    agency: " Shalom Arequipa ",
  },
  receipt: { type: "BOLETA", dni: " 46789123 " },
  method: "yape",
  idempotencyKey: id,
  quoteId: id,
};

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  window.history.replaceState(null, "", "/");
  Object.defineProperty(globalThis.crypto, "randomUUID", {
    configurable: true,
    value: jest.fn(() => id),
  });
  (axios.post as jest.Mock).mockResolvedValue({ data: {} });
});

test("catalog passes cancellation to the authenticated request", async () => {
  const controller = new AbortController();
  const catalog = { products: [], serverNow: "2026-10-27T12:00:00Z" };
  (axiosAuth.get as jest.Mock).mockResolvedValue({ data: catalog });
  await expect(getLiveCatalog(id, "", controller.signal)).resolves.toEqual(catalog);
  expect(axiosAuth.get).toHaveBeenCalledWith(expect.stringContaining(`/stores/${id}/catalog`), {
    params: { search: "" },
    signal: controller.signal,
  });
});

test("scoped Live readers pass abort signals while public reads remain anonymous", async () => {
  const controller = new AbortController();
  (axiosAuth.get as jest.Mock).mockResolvedValue({ data: {} });
  (axios.get as jest.Mock).mockResolvedValue({ data: {} });
  await getLiveConsole(id, controller.signal);
  await getLiveYapeReviews(id, controller.signal);
  for (const [, options] of (axiosAuth.get as jest.Mock).mock.calls)
    expect(options.signal).toBe(controller.signal);
  await getPublicLive(id, "visitor-private", controller.signal);
  await getLiveCheckoutSnapshot(id, "visitor-private", id, controller.signal);
  for (const [, options] of (axios.get as jest.Mock).mock.calls) {
    expect(options).toEqual({
      timeout: 20000,
      signal: controller.signal,
      withCredentials: false,
      headers: { "X-Live-Visitor": "visitor-private" },
    });
  }
});

test("anonymous visitor credential persists per store and never derives from customer PII", () => {
  expect(liveVisitorToken(id)).toBe(id);
  expect(liveVisitorToken(id)).toBe(id);
  expect(crypto.randomUUID).toHaveBeenCalledTimes(1);
  expect(localStorage.getItem(`powip:live:visitor:v1:${id}`)).toBe(id);
});
test("private access link imports credential and clears fragment", () => {
  const token = "a".repeat(43);
  window.history.replaceState(null, "", `/live/${id}#access=${token}`);
  expect(liveVisitorToken(id)).toBe(token);
  expect(window.location.hash).toBe("");
  expect(liveVisitorToken(id)).toBe(token);
});
test("quote sends sanitized delivery and no payment command or cookies", async () => {
  await quoteLivePurchase(id, id, input);
  const [, body, options] = (axios.post as jest.Mock).mock.calls[0];
  expect(body.delivery).toEqual({
    type: "AGENCY",
    department: "Arequipa",
    province: "Arequipa",
    district: "Cayma",
    address: "Calle de la agencia 123",
    agency: "Shalom Arequipa",
  });
  expect(body.receipt).toEqual({ type: "BOLETA", dni: "46789123" });
  expect(body.customer.name).toBe("María");
  expect(body.method).toBeUndefined();
  expect(body.idempotencyKey).toBeUndefined();
  expect(body.quoteId).toBeUndefined();
  expect(options).toEqual({
    timeout: 20000,
    withCredentials: false,
    headers: { "X-Live-Visitor": id },
  });
});
test("anonymous commands have a bounded timeout and uncertain responses never claim success", async () => {
  await checkoutLivePurchase(id, id, input);
  expect((axios.post as jest.Mock).mock.calls[0][2].timeout).toBe(20000);
  const failure = { code: "ECONNABORTED" };
  (axios.isAxiosError as unknown as jest.Mock).mockImplementation((value) => value === failure);
  expect(liveError(failure)).toMatch(/No confirmamos el resultado/);
  expect(liveError(failure)).toMatch(/reintenta la misma acción/);
  expect(liveError(failure)).toMatch(/no inicies otra compra ni repitas el pago/);
});
test("checkout preserves caller idempotency command for retries", async () => {
  await checkoutLivePurchase(id, id, input);
  await checkoutLivePurchase(id, id, input);
  const calls = (axios.post as jest.Mock).mock.calls;
  expect(calls[0][1].idempotencyKey).toBe(id);
  expect(calls[1][1].idempotencyKey).toBe(id);
  expect(calls[0][1].quoteId).toBe(id);
  expect(calls[0][1].method).toBe("yape");
});
test("payment and social URLs reject active protocols", () => {
  expect(safeLiveUrl("javascript:alert(1)")).toBeNull();
  expect(safeLiveUrl("http://example.com")).toBeNull();
  expect(safeLiveUrl("https://social.example.invalid/live")).toBe(
    "https://social.example.invalid/live",
  );
});

test("manual proof uploads image with visitor credentials and idempotency, never cookies", async () => {
  const { uploadLiveYapeProof } = await import("../liveService");
  const file = new File([new Uint8Array([137, 80, 78, 71])], "yape.png", { type: "image/png" });
  await uploadLiveYapeProof(id, "private-visitor", id, {
    file,
    operationNumber: " 01234567 ",
    idempotencyKey: id,
  });
  const [url, body, options] = (axios.post as jest.Mock).mock.calls[0];
  expect(url).toContain(`/public/${id}/checkouts/${id}/proof`);
  expect(body.get("file")).toBe(file);
  expect(body.get("operationNumber")).toBe("01234567");
  expect(body.get("idempotencyKey")).toBe(id);
  expect(options.withCredentials).toBe(false);
  expect(options.headers["X-Live-Visitor"]).toBe("private-visitor");
});
test("manual proof rejects PDFs and large images before sending anything", async () => {
  const { uploadLiveYapeProof } = await import("../liveService");
  const input = { operationNumber: "01234567", idempotencyKey: id };
  await expect(
    uploadLiveYapeProof(id, id, id, {
      ...input,
      file: new File(["pdf"], "proof.pdf", { type: "application/pdf" }),
    }),
  ).rejects.toThrow("JPG");
  await expect(
    uploadLiveYapeProof(id, id, id, {
      ...input,
      file: new File([new Uint8Array(5 * 1024 * 1024 + 1)], "large.png", { type: "image/png" }),
    }),
  ).rejects.toThrow("5 MB");
  expect(axios.post).not.toHaveBeenCalled();
});
