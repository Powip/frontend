import axiosAuth from "@/lib/axiosAuth";
import { GATEWAY } from "@/lib/gateway";
import {
  approveLeadPayment,
  captureLeadPayment,
  changeLeadPaymentAmount,
  changeLeadPaymentProof,
  getLeadPaymentCapabilities,
  getLeadPayments,
  listLeadPayments,
  rejectLeadPayment,
} from "../leadPaymentsService";
import type { CaptureLeadPaymentInput } from "@/types/leadPayments";

jest.mock("@/lib/axiosAuth", () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), patch: jest.fn() },
}));
const BASE = `${GATEWAY.ventas}/leads`;
const input: CaptureLeadPaymentInput = {
  captureId: "95562692-4932-4f5a-8de0-6ce4bc3e66dc",
  amount: 25.5,
  currency: "PEN",
  paymentMethod: "YAPE",
  paymentProofUrl: "proof",
};
beforeEach(() => jest.resetAllMocks());
afterEach(() => {
  for (const method of [axiosAuth.get, axiosAuth.post, axiosAuth.patch]) {
    for (const [url] of jest.mocked(method).mock.calls) {
      expect(url).toMatch(/\/ventas\/leads\//);
      expect(url).not.toMatch(/order-header|confirm-purchase|stock/);
    }
  }
});
it("reads capabilities without capturing or approving money", async () => {
  const caps = { enabled: false, canView: false, canCapture: false, canReview: false };
  jest.mocked(axiosAuth.get).mockResolvedValue({ data: caps });
  await expect(getLeadPaymentCapabilities()).resolves.toBe(caps);
  expect(axiosAuth.get).toHaveBeenCalledWith(`${BASE}/payment-capabilities`);
  expect(axiosAuth.post).not.toHaveBeenCalled();
  expect(axiosAuth.patch).not.toHaveBeenCalled();
});
it("keeps the same capture identity, currency, amount and proof across a timeout retry", async () => {
  const payment = { id: "payment-1", leadId: "lead-1", status: "PENDING", order: null };
  jest
    .mocked(axiosAuth.post)
    .mockRejectedValueOnce(new Error("timeout"))
    .mockResolvedValueOnce({ data: payment });
  await expect(captureLeadPayment("lead-1", input)).rejects.toThrow("timeout");
  await expect(captureLeadPayment("lead-1", input)).resolves.toBe(payment);
  expect(jest.mocked(axiosAuth.post).mock.calls).toEqual([
    [`${BASE}/lead-1/payments`, input],
    [`${BASE}/lead-1/payments`, input],
  ]);
  expect(axiosAuth.patch).not.toHaveBeenCalled();
  expect(input).not.toHaveProperty("status");
});
it("retains company financial filters and reads advances without inventing an order", async () => {
  const list = { data: [], total: 0, page: 2, limit: 10 };
  jest.mocked(axiosAuth.get).mockResolvedValue({ data: list });
  const params = { status: "PAID" as const, page: 2, limit: 10, leadId: "lead/1" };
  await expect(listLeadPayments(params)).resolves.toBe(list);
  expect(axiosAuth.get).toHaveBeenLastCalledWith(`${BASE}/payments`, { params });
  await expect(getLeadPayments("lead/1")).resolves.toBe(list);
  expect(axiosAuth.get).toHaveBeenLastCalledWith(`${BASE}/lead%2F1/payments`);
});
it.each([
  ["approve", approveLeadPayment, { version: 2, notes: "Verificado" }],
  ["reject", rejectLeadPayment, { version: 2, notes: "No recibido" }],
  ["amount", changeLeadPaymentAmount, { version: 2, amount: 20 }],
  ["proof", changeLeadPaymentProof, { version: 2, paymentProofUrl: "proof-new" }],
] as const)(
  "sends %s with the payment revision and without a spoofed actor",
  async (action, method, payload) => {
    const payment = { id: "pay", leadPaymentVersion: 3 };
    jest.mocked(axiosAuth.patch).mockResolvedValue({ data: payment });
    await expect(method("lead", "pay/1", payload as never)).resolves.toBe(payment);
    expect(axiosAuth.patch).toHaveBeenCalledWith(
      `${BASE}/lead/payments/pay%2F1/${action}`,
      payload,
    );
    expect(payload).not.toHaveProperty("userId");
    expect(payload).not.toHaveProperty("confirmedBy");
    expect(axiosAuth.post).not.toHaveBeenCalled();
  },
);
