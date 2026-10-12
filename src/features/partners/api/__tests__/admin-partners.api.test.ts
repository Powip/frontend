import { AxiosError } from "axios";
import { tokenStore } from "@/lib/tokenStore";
import {
  ADMIN_PARTNER_ID,
  buildAdminActivity,
  buildAdminPage,
  buildAdminPartner,
  buildAdminReferral,
  buildAdminSummary,
} from "../../test-utils/admin-partners.fixture";
import { buildAxiosError } from "../../test-utils/axios-error";
import {
  adminPartnersClient,
  requestAdminDashboardSummary,
  requestAdminPartner,
  requestAdminPartnerActivity,
  requestAdminPartnerReferrals,
  requestAdminPartners,
} from "../admin-partners.api";

jest.mock("@/lib/api", () => ({
  API: { partners: "https://partners.review.invalid/v1/partners" },
}));
const originalAdapter = adminPartnersClient.defaults.adapter;
const interceptors: number[] = [];
afterEach(() => {
  jest.restoreAllMocks();
  interceptors.splice(0).forEach((id) => {
    adminPartnersClient.interceptors.request.eject(id);
  });
  adminPartnersClient.defaults.adapter = originalAdapter;
  tokenStore.set(null);
});

it("uses canonical endpoints with the captured bearer, pagination, status and abort signal", async () => {
  const get = jest.spyOn(adminPartnersClient, "get").mockResolvedValue({ data: buildAdminPage() });
  const signal = new AbortController().signal;
  await requestAdminPartners({
    accessToken: "A",
    cursor: "opaque+/=",
    limit: 5,
    status: "SUSPENDED",
    signal,
  });
  expect(get).toHaveBeenCalledWith("https://partners.review.invalid/v1/partners/admin/partners", {
    headers: { Authorization: "Bearer A" },
    signal,
    params: { cursor: "opaque+/=", limit: 5, status: "SUSPENDED" },
  });
  get.mockResolvedValueOnce({ data: buildAdminPartner() });
  await requestAdminPartner({ accessToken: "A", partnerId: ADMIN_PARTNER_ID, signal });
  expect(get).toHaveBeenLastCalledWith(
    `https://partners.review.invalid/v1/partners/admin/partners/${ADMIN_PARTNER_ID}`,
    { headers: { Authorization: "Bearer A" }, signal },
  );
  get.mockResolvedValueOnce({ data: { ...buildAdminPage(), items: [buildAdminReferral()] } });
  await requestAdminPartnerReferrals({
    accessToken: "A",
    partnerId: ADMIN_PARTNER_ID,
    cursor: "next",
    signal,
  });
  expect(get).toHaveBeenLastCalledWith(expect.stringContaining(`/${ADMIN_PARTNER_ID}/referrals`), {
    headers: { Authorization: "Bearer A" },
    signal,
    params: { cursor: "next" },
  });
  get.mockResolvedValueOnce({ data: { ...buildAdminPage(), items: [buildAdminActivity()] } });
  await requestAdminPartnerActivity({ accessToken: "A", partnerId: ADMIN_PARTNER_ID, limit: 1 });
  expect(get).toHaveBeenLastCalledWith(expect.stringContaining(`/${ADMIN_PARTNER_ID}/activity`), {
    headers: { Authorization: "Bearer A" },
    signal: undefined,
    params: { limit: 1 },
  });
  get.mockResolvedValueOnce({ data: buildAdminSummary() });
  expect(await requestAdminDashboardSummary({ accessToken: "A" })).toEqual(buildAdminSummary());
  expect(get).toHaveBeenLastCalledWith(
    "https://partners.review.invalid/v1/partners/admin/dashboard-summary",
    { headers: { Authorization: "Bearer A" }, signal: undefined },
  );
});

it("preserves real nullable fields and empty pages without assigning defaults", async () => {
  const partner = buildAdminPartner({
    status: "APPLIED",
    referralCode: null,
    activatedAt: null,
    manualReferralsCount: 0,
    linkAttributionsCount: 0,
  });
  const get = jest.spyOn(adminPartnersClient, "get").mockResolvedValue({ data: partner });
  expect(await requestAdminPartner({ accessToken: "A", partnerId: partner.id })).toEqual(partner);
  const page = { items: [], nextCursor: null, hasMore: false, limit: 20 };
  get.mockResolvedValueOnce({ data: page });
  expect(await requestAdminPartners({ accessToken: "A" })).toEqual(page);
});

it.each([
  { id: "not-uuid" },
  { version: undefined },
  { version: "0" },
  { version: -1 },
  { version: 0.5 },
  { version: Number.MAX_SAFE_INTEGER + 1 },
  { appliedAt: "yesterday" },
  { activatedAt: "2026-13-01T10:00:00Z" },
  { manualReferralsCount: "3" },
  { manualReferralsCount: -1 },
  { manualReferralsCount: 1.5 },
  { manualReferralsCount: Number.NaN },
  { manualReferralsCount: Number.POSITIVE_INFINITY },
  { linkAttributionsCount: null },
  { status: "activo" },
  { tierLevel: "bronce" },
  { email: "personal@review.invalid" },
])("rejects malformed or expanded Partner payloads %#", async (override) => {
  jest
    .spyOn(adminPartnersClient, "get")
    .mockResolvedValue({ data: { ...buildAdminPartner(), ...override } });
  await expect(
    requestAdminPartner({ accessToken: "A", partnerId: ADMIN_PARTNER_ID }),
  ).rejects.toThrow();
});

it.each([
  { nextCursor: "" },
  { nextCursor: "next", hasMore: false },
  { hasMore: true, nextCursor: null },
  { limit: "20" },
  { limit: 101 },
  { limit: 0 },
  { unknown: "internal" },
  { items: null },
])("rejects invalid pagination %#", async (override) => {
  jest
    .spyOn(adminPartnersClient, "get")
    .mockResolvedValue({ data: { ...buildAdminPage(), ...override } });
  await expect(requestAdminPartners({ accessToken: "A" })).rejects.toThrow();
});

it("keeps manual and LINK attribution rows separate even when their UUIDs coincide", async () => {
  const manual = buildAdminReferral();
  const link = buildAdminReferral({
    id: manual.id,
    source: "LINK_ATTRIBUTION",
    origin: "LINK",
    state: "LINK_ATTRIBUTED",
    businessName: null,
    companyId: ADMIN_PARTNER_ID,
    companyCreatedAt: "2026-10-03T10:00:00Z",
    attributedAt: "2026-10-03T10:00:00Z",
  });
  const page = { ...buildAdminPage(), items: [manual, link] };
  jest.spyOn(adminPartnersClient, "get").mockResolvedValue({ data: page });
  expect(
    (await requestAdminPartnerReferrals({ accessToken: "A", partnerId: ADMIN_PARTNER_ID })).items,
  ).toEqual([manual, link]);
});

it.each([
  { source: "LINK_ATTRIBUTION", origin: "MANUAL" },
  { source: "LINK_ATTRIBUTION", origin: "LINK", state: "PAID" },
  { companyId: "wrong" },
  { firstMonthCommission: 0 },
])("rejects fabricated referral evidence %#", async (override) => {
  jest.spyOn(adminPartnersClient, "get").mockResolvedValue({
    data: { ...buildAdminPage(), items: [{ ...buildAdminReferral(), ...override }] },
  });
  await expect(
    requestAdminPartnerReferrals({ accessToken: "A", partnerId: ADMIN_PARTNER_ID }),
  ).rejects.toThrow();
});

it.each([
  { actorEmail: "private@review.invalid" },
  { occurredAt: "2026-10-10" },
  { entityId: "wrong" },
])("rejects expanded or invalid audit data %#", async (override) => {
  jest.spyOn(adminPartnersClient, "get").mockResolvedValue({
    data: { ...buildAdminPage(), items: [{ ...buildAdminActivity(), ...override }] },
  });
  await expect(
    requestAdminPartnerActivity({ accessToken: "A", partnerId: ADMIN_PARTNER_ID }),
  ).rejects.toThrow();
});

it.each([
  "referredMrr",
  "monthlyCommissions",
  "discountsGiven",
  "channelCost",
  "ltvBrought",
  "channelRoiMultiplier",
] as const)("rejects a fabricated zero for unavailable %s", async (key) => {
  const summary = buildAdminSummary();
  jest
    .spyOn(adminPartnersClient, "get")
    .mockResolvedValue({ data: { ...summary, financial: { ...summary.financial, [key]: 0 } } });
  await expect(requestAdminDashboardSummary({ accessToken: "A" })).rejects.toThrow();
});

it.each([401, 403, 404, 503])(
  "propagates HTTP %s without a substitute response",
  async (status) => {
    const error = buildAxiosError(status, { code: "ADMIN_READ_FAILURE" });
    jest.spyOn(adminPartnersClient, "get").mockRejectedValue(error);
    for (const request of [
      requestAdminPartners({ accessToken: "A" }),
      requestAdminPartner({ accessToken: "A", partnerId: ADMIN_PARTNER_ID }),
      requestAdminPartnerReferrals({ accessToken: "A", partnerId: ADMIN_PARTNER_ID }),
      requestAdminPartnerActivity({ accessToken: "A", partnerId: ADMIN_PARTNER_ID }),
      requestAdminDashboardSummary({ accessToken: "A" }),
    ])
      await expect(request).rejects.toBe(error);
  },
);

it("pins Bearer A through dispatch even if the session changes to B", async () => {
  let entered!: () => void;
  let release!: () => void;
  const entering = new Promise<void>((resolve) => {
    entered = resolve;
  });
  const paused = new Promise<void>((resolve) => {
    release = resolve;
  });
  interceptors.push(
    adminPartnersClient.interceptors.request.use(async (config) => {
      entered();
      await paused;
      return config;
    }),
  );
  let bearer: unknown;
  adminPartnersClient.defaults.adapter = async (config) => {
    bearer = config.headers.Authorization;
    return { data: buildAdminPage(), status: 200, statusText: "OK", headers: {}, config };
  };
  tokenStore.set("A");
  const request = requestAdminPartners({ accessToken: "A" });
  await entering;
  tokenStore.set("B");
  release();
  await request;
  expect(bearer).toBe("Bearer A");
  expect(adminPartnersClient.defaults.timeout).toBe(10_000);
});

it("propagates a timeout without replacing it with cached fixture data", async () => {
  const error = new AxiosError("Request timed out", "ECONNABORTED");
  jest.spyOn(adminPartnersClient, "get").mockRejectedValue(error);
  await expect(requestAdminPartners({ accessToken: "A" })).rejects.toBe(error);
});
