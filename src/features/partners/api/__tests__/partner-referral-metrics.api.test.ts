import { AxiosError } from "axios";
import { tokenStore } from "@/lib/tokenStore";
import { buildAxiosError } from "../../test-utils/axios-error";
import {
  partnerReferralMetricsClient,
  requestPartnerReferralMetrics,
} from "../partner-referral-metrics.api";

jest.mock("@/lib/api", () => ({
  API: { partners: "https://partners.review.invalid/v1/partners" },
}));
const metrics = {
  claimCaptures: 12,
  attachedClaims: 7,
  attributedCompanies: 4,
  asOf: "2026-10-11T10:00:00Z",
};
const originalAdapter = partnerReferralMetricsClient.defaults.adapter;
const interceptors: number[] = [];
afterEach(() => {
  jest.restoreAllMocks();
  interceptors.splice(0).forEach((id) => {
    partnerReferralMetricsClient.interceptors.request.eject(id);
  });
  partnerReferralMetricsClient.defaults.adapter = originalAdapter;
  tokenStore.set(null);
});

it("reads the own endpoint with the captured bearer/abort and no client owner/country", async () => {
  const get = jest.spyOn(partnerReferralMetricsClient, "get").mockResolvedValue({ data: metrics });
  const signal = new AbortController().signal;
  expect(await requestPartnerReferralMetrics({ accessToken: "captured-A", signal })).toEqual(
    metrics,
  );
  expect(get).toHaveBeenCalledWith(
    "https://partners.review.invalid/v1/partners/me/referral-metrics",
    { headers: { Authorization: "Bearer captured-A" }, signal },
  );
});
it.each(["", " ", " A", "A "])(
  "rejects an absent or padded session before dispatch %#",
  async (accessToken) => {
    const get = jest.spyOn(partnerReferralMetricsClient, "get");
    await expect(requestPartnerReferralMetrics({ accessToken })).rejects.toThrow();
    expect(get).not.toHaveBeenCalled();
  },
);
it.each([
  { ...metrics, clicks: 0 },
  { ...metrics, attributedCompanies: null },
  { ...metrics, claimCaptures: "0" },
  { ...metrics, asOf: "2026-02-30T10:00:00Z" },
])("fails closed on malformed/expanded DTO %#", async (data) => {
  jest.spyOn(partnerReferralMetricsClient, "get").mockResolvedValue({ data });
  await expect(requestPartnerReferralMetrics({ accessToken: "A" })).rejects.toThrow();
});
it.each([401, 403, 503])("propagates HTTP %s without zero fallback", async (status) => {
  const failure = buildAxiosError(status);
  jest.spyOn(partnerReferralMetricsClient, "get").mockRejectedValue(failure);
  await expect(requestPartnerReferralMetrics({ accessToken: "A" })).rejects.toBe(failure);
});
it("has ten-second timeout and preserves a timeout error", async () => {
  expect(partnerReferralMetricsClient.defaults.timeout).toBe(10_000);
  const failure = new AxiosError("Fixture timeout", "ECONNABORTED");
  jest.spyOn(partnerReferralMetricsClient, "get").mockRejectedValue(failure);
  await expect(requestPartnerReferralMetrics({ accessToken: "A" })).rejects.toBe(failure);
});
it("does not substitute a later tokenStore bearer during a deferred dispatch", async () => {
  let entered!: () => void;
  let release!: () => void;
  const entering = new Promise<void>((accept) => {
    entered = accept;
  });
  const paused = new Promise<void>((accept) => {
    release = accept;
  });
  interceptors.push(
    partnerReferralMetricsClient.interceptors.request.use(async (config) => {
      entered();
      await paused;
      return config;
    }),
  );
  let bearer: unknown;
  partnerReferralMetricsClient.defaults.adapter = async (config) => {
    bearer = config.headers.Authorization;
    return { data: metrics, status: 200, statusText: "OK", headers: {}, config };
  };
  tokenStore.set("captured-A");
  const result = requestPartnerReferralMetrics({ accessToken: "captured-A" });
  await entering;
  tokenStore.set("current-B");
  release();
  await result;
  expect(bearer).toBe("Bearer captured-A");
});
