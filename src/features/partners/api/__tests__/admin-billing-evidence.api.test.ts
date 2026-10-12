import { tokenStore } from "@/lib/tokenStore";
import { buildAxiosError } from "../../test-utils/axios-error";
import {
  BILLING_ID,
  billingEvidence,
  billingPage,
} from "../../test-utils/billing-evidence.fixture";
import {
  adminBillingEvidenceClient,
  requestAdminBillingEvidence,
  requestAdminBillingEvidenceDetail,
} from "../admin-billing-evidence.api";

jest.mock("@/lib/api", () => ({
  API: { partners: "https://partners.review.invalid/v1/partners" },
}));
afterEach(() => {
  jest.restoreAllMocks();
  tokenStore.set(null);
});

it("uses exact readonly paths, captured bearer, filter, cursor, limit and abort signal", async () => {
  const get = jest
    .spyOn(adminBillingEvidenceClient, "get")
    .mockResolvedValue({ data: billingPage() });
  const signal = new AbortController().signal;
  tokenStore.set("OTHER-BEARER");
  await requestAdminBillingEvidence({
    accessToken: "PINNED-BEARER",
    cursor: "opaque",
    limit: 5,
    state: "QUARANTINED",
    signal,
  });
  expect(get).toHaveBeenCalledWith(
    "https://partners.review.invalid/v1/partners/admin/billing-evidence",
    {
      headers: { Authorization: "Bearer PINNED-BEARER" },
      signal,
      params: { cursor: "opaque", limit: 5, state: "QUARANTINED" },
    },
  );
  get.mockResolvedValueOnce({ data: billingEvidence() });
  expect(
    await requestAdminBillingEvidenceDetail({
      accessToken: "PINNED-BEARER",
      evidenceId: BILLING_ID,
      signal,
    }),
  ).toEqual(billingEvidence());
  expect(get).toHaveBeenLastCalledWith(
    `https://partners.review.invalid/v1/partners/admin/billing-evidence/${BILLING_ID}`,
    {
      headers: { Authorization: "Bearer PINNED-BEARER" },
      signal,
    },
  );
});

it("preserves exact decimal strings and null money without conversion, fake zero or totals", async () => {
  const unknown = billingEvidence({ amount: null, currency: null, paidAt: null });
  const get = jest.spyOn(adminBillingEvidenceClient, "get").mockResolvedValue({ data: unknown });
  expect(
    await requestAdminBillingEvidenceDetail({ accessToken: "A", evidenceId: BILLING_ID }),
  ).toEqual(unknown);
  get.mockResolvedValueOnce({ data: billingEvidence({ amount: "99999999999999999999.12345678" }) });
  expect(
    (await requestAdminBillingEvidenceDetail({ accessToken: "A", evidenceId: BILLING_ID })).amount,
  ).toBe("99999999999999999999.12345678");
  get.mockResolvedValueOnce({ data: billingPage([]) });
  expect(await requestAdminBillingEvidence({ accessToken: "A" })).toEqual(billingPage([]));
});

it.each([
  { amount: 89.12 },
  { amount: "89.123456789" },
  { amount: "1e2" },
  { amount: "-1" },
  { currency: "pen" },
  { paidAt: "yesterday" },
  { state: "PAID" },
  { factType: "REFUNDED" },
  { eventType: "billing.invoice-paid-observed" },
  { attempts: 21 },
  { lastErrorCode: "private-error-text" },
  { authSubject: "private" },
  { issuer: "private" },
  { email: "private@example.test" },
  { providerPaymentId: "private-token" },
  { normalizedPayload: {} },
  { commission: 0 },
  { missingFields: ["SecretClientName"] },
  { reconciliationReasons: ["private reason"] },
  { observationId: null },
])("rejects malformed, expanded, private or financially invented DTOs %#", async (override) => {
  jest
    .spyOn(adminBillingEvidenceClient, "get")
    .mockResolvedValue({ data: { ...billingEvidence(), ...override } });
  await expect(
    requestAdminBillingEvidenceDetail({ accessToken: "A", evidenceId: BILLING_ID }),
  ).rejects.toThrow();
});

it.each([
  { hasMore: true, nextCursor: null },
  { hasMore: false, nextCursor: "next" },
  { limit: 0 },
  { limit: 101 },
  { limit: "20" },
  { items: null },
  { nextCursor: "" },
  { rawPayload: {} },
])("rejects inconsistent or expanded page contracts %#", async (override) => {
  jest
    .spyOn(adminBillingEvidenceClient, "get")
    .mockResolvedValue({ data: { ...billingPage(), ...override } });
  await expect(requestAdminBillingEvidence({ accessToken: "A" })).rejects.toThrow();
});

it.each([401, 403, 404, 503])("propagates HTTP%s with no fallback data", async (status) => {
  const failure = buildAxiosError(status);
  jest.spyOn(adminBillingEvidenceClient, "get").mockRejectedValue(failure);
  await expect(requestAdminBillingEvidence({ accessToken: "A" })).rejects.toBe(failure);
  await expect(
    requestAdminBillingEvidenceDetail({ accessToken: "A", evidenceId: BILLING_ID }),
  ).rejects.toBe(failure);
});
