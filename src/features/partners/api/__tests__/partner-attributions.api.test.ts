import { AxiosError } from "axios";
import { tokenStore } from "@/lib/tokenStore";
import { buildAttributionDto } from "../../test-utils/partner-attribution.fixture";
import { buildAxiosError } from "../../test-utils/axios-error";
import { getPartnerAttributions } from "../../services/get-partner-attributions";
import { getPartnerAttributionsApi, partnerAttributionsClient } from "../partner-attributions.api";

jest.mock("@/lib/api", () => ({ API: { partners: "https://partners.review.invalid/v1/partners" } }));

const page = { items: [buildAttributionDto()], nextCursor: null };
const originalAdapter = partnerAttributionsClient.defaults.adapter;
const interceptors: number[] = [];

afterEach(() => {
  jest.restoreAllMocks();
  interceptors.splice(0).forEach((id) => partnerAttributionsClient.interceptors.request.eject(id));
  partnerAttributionsClient.defaults.adapter = originalAdapter;
  tokenStore.set(null);
});

it("requests the first page with a pinned bearer and no client-selected scope or limit", async () => {
  const get = jest.spyOn(partnerAttributionsClient, "get").mockResolvedValue({ data: page });
  const controller = new AbortController();
  expect(await getPartnerAttributionsApi(null, "fixture-A", controller.signal)).toEqual(page);
  expect(get).toHaveBeenCalledWith("https://partners.review.invalid/v1/partners/me/attributions", {
    params: undefined, headers: { Authorization: "Bearer fixture-A" }, signal: controller.signal,
  });
});

it("sends only the opaque cursor and forwards it without interpreting it", async () => {
  const get = jest.spyOn(partnerAttributionsClient, "get").mockResolvedValue({ data: page });
  await getPartnerAttributionsApi("opaque+/=cursor", "fixture-A");
  expect(get).toHaveBeenCalledWith(expect.any(String), {
    params: { cursor: "opaque+/=cursor" }, headers: { Authorization: "Bearer fixture-A" }, signal: undefined,
  });
});

it.each([1, 2])("accepts the unchanged public response with resolutionVersion %s", async (resolutionVersion) => {
  const response = { items: [buildAttributionDto({ resolutionVersion })], nextCursor: null };
  jest.spyOn(partnerAttributionsClient, "get").mockResolvedValue({ data: response });
  expect(await getPartnerAttributionsApi(null, "fixture-A")).toEqual(response);
});

it.each([undefined, 0, -1, 1.5, "2"])("rejects invalid resolutionVersion %s instead of fabricating v2", async (resolutionVersion) => {
  const response = {
    items: [{ ...buildAttributionDto(), resolutionVersion }], nextCursor: null,
  };
  jest.spyOn(partnerAttributionsClient, "get").mockResolvedValue({ data: response });
  await expect(getPartnerAttributionsApi(null, "fixture-A")).rejects.toThrow();
});

it.each([
  ["partnerAuthIdentityId", "88888888-8888-4888-8888-888888888888"],
  ["partnerAuthIssuer", "ms-auth"],
  ["partnerAuthSubject", "99999999-9999-4999-8999-999999999999"],
  ["ownerAuth", { issuer: "ms-auth", subject: "99999999-9999-4999-8999-999999999999" }],
  ["email", "fixture-only@review.invalid"],
])("rejects internal or personal field %s even in a v2 response", async (field, value) => {
  const response = {
    items: [{ ...buildAttributionDto({ resolutionVersion: 2 }), [field as string]: value }],
    nextCursor: null,
  };
  jest.spyOn(partnerAttributionsClient, "get").mockResolvedValue({ data: response });
  await expect(getPartnerAttributionsApi(null, "fixture-A")).rejects.toThrow();
});

it.each([
  { extra: "PII", items: page.items, nextCursor: null },
  { items: [{ ...page.items[0], email: "no-pii@review.invalid" }], nextCursor: null },
  { items: [{ ...page.items[0], source: "MANUAL" }], nextCursor: null },
  { items: [{ ...page.items[0], companyId: "not-a-uuid" }], nextCursor: null },
  { items: [{ ...page.items[0], confirmedAt: "not-a-date" }], nextCursor: null },
  { items: page.items, nextCursor: "" },
])("rejects malformed or expanded response contracts: %#", async (data) => {
  jest.spyOn(partnerAttributionsClient, "get").mockResolvedValue({ data });
  await expect(getPartnerAttributionsApi(null, "fixture-A")).rejects.toThrow();
});

it.each([401, 403, 503])("propagates HTTP %s without substituting simulated data", async (status) => {
  const error = buildAxiosError(status, { code: "ATTRIBUTIONS_UNAVAILABLE" });
  jest.spyOn(partnerAttributionsClient, "get").mockRejectedValue(error);
  await expect(getPartnerAttributionsApi(null, "fixture-A")).rejects.toBe(error);
});

it("uses a ten-second timeout and propagates timeout failures without fabricated data", async () => {
  expect(partnerAttributionsClient.defaults.timeout).toBe(10_000);
  const error = new AxiosError("Fixture request timed out", "ECONNABORTED");
  jest.spyOn(partnerAttributionsClient, "get").mockRejectedValue(error);
  await expect(getPartnerAttributionsApi(null, "fixture-A")).rejects.toBe(error);
});

it("the service maps LINK evidence instead of creating a manual Referral", async () => {
  jest.spyOn(partnerAttributionsClient, "get").mockResolvedValue({ data: page });
  const result = await getPartnerAttributions(null, "fixture-A");
  expect(result.items[0]).toMatchObject({ source: "LINK", companyId: page.items[0].companyId });
  expect(result.items[0]).not.toHaveProperty("businessName");
  expect(result.items[0]).not.toHaveProperty("claimId");
});

it("dispatches A's actual HTTP request with Bearer A even when tokenStore switches to B during the interceptor", async () => {
  let entered!: () => void;
  let release!: () => void;
  const entering = new Promise<void>((resolve) => { entered = resolve; });
  const paused = new Promise<void>((resolve) => { release = resolve; });
  interceptors.push(partnerAttributionsClient.interceptors.request.use(async (config) => {
    entered();
    await paused;
    return config;
  }));
  let bearer: unknown;
  partnerAttributionsClient.defaults.adapter = async (config) => {
    bearer = config.headers.Authorization;
    return { data: page, status: 200, statusText: "OK", headers: {}, config };
  };
  tokenStore.set("fixture-A");
  const request = getPartnerAttributionsApi(null, "fixture-A");
  await entering;
  tokenStore.set("fixture-B");
  release();
  await request;
  expect(bearer).toBe("Bearer fixture-A");
  expect(bearer).not.toBe("Bearer fixture-B");
});
