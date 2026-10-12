import { tokenStore } from "@/lib/tokenStore";
import { buildAxiosError } from "../../test-utils/axios-error";
import {
  commissionEvaluationFixture,
  commissionItemFixture,
  commissionReadPageFixture,
} from "../../test-utils/commission-read.fixture";
import {
  type CommissionPageRequest,
  commissionReadClient,
  requestOwnCommissionEvaluations,
  requestOwnCommissionItems,
} from "../commission-read.api";

jest.mock("@/lib/api", () => ({
  API: { partners: "https://partners.review.invalid/v1/partners" },
}));
const originalAdapter = commissionReadClient.defaults.adapter;
const interceptors: number[] = [];
afterEach(() => {
  jest.restoreAllMocks();
  interceptors.splice(0).forEach((id) => {
    commissionReadClient.interceptors.request.eject(id);
  });
  commissionReadClient.defaults.adapter = originalAdapter;
  tokenStore.set(null);
});
it.each([
  ["commissions", requestOwnCommissionItems, commissionItemFixture],
  ["commission-evaluations", requestOwnCommissionEvaluations, commissionEvaluationFixture],
] as const)(
  "GET own %s pins bearer/abort and forwards only bounded cursor/limit",
  async (route, request, item) => {
    const page = commissionReadPageFixture([item], { limit: 1 });
    const get = jest.spyOn(commissionReadClient, "get").mockResolvedValue({ data: page });
    const signal = new AbortController().signal;
    expect(
      await request({ accessToken: "captured-A", signal, cursor: "opaque_cursor", limit: 1 }),
    ).toEqual(page);
    expect(get).toHaveBeenCalledWith(`https://partners.review.invalid/v1/partners/me/${route}`, {
      headers: { Authorization: "Bearer captured-A" },
      signal,
      params: { cursor: "opaque_cursor", limit: 1 },
    });
  },
);
it("defaults a bounded 20-item request without transmitting a null cursor", async () => {
  const get = jest
    .spyOn(commissionReadClient, "get")
    .mockResolvedValue({ data: commissionReadPageFixture([commissionItemFixture]) });
  await requestOwnCommissionItems({ accessToken: "A", cursor: null });
  expect(get).toHaveBeenCalledWith(
    expect.stringMatching(/\/me\/commissions$/),
    expect.objectContaining({ params: { limit: 20 } }),
  );
});
it.each([
  { accessToken: "" },
  { accessToken: " A" },
  { accessToken: "A " },
  { cursor: "" },
  { cursor: "with=padding" },
  { limit: 0 },
  { limit: 101 },
  { limit: 1.2 },
  { limit: "20" },
  { partnerId: "selected-owner" },
  { country: "PE" },
  { approvalId: "selected-approval" },
])("rejects unsafe/session/client-scope request before HTTP %#", async (override) => {
  const get = jest.spyOn(commissionReadClient, "get");
  const request = { accessToken: "A", ...override } as CommissionPageRequest;
  await expect(requestOwnCommissionItems(request)).rejects.toThrow();
  await expect(requestOwnCommissionEvaluations(request)).rejects.toThrow();
  expect(get).not.toHaveBeenCalled();
});
it.each([
  { ...commissionReadPageFixture([commissionItemFixture]), balance: "10.00" },
  commissionReadPageFixture([{ ...commissionItemFixture, netAmount: 4.25 }]),
  commissionReadPageFixture([commissionItemFixture], { limit: 10 }),
  commissionReadPageFixture([commissionItemFixture], {
    limit: 1,
    hasMore: true,
    nextCursor: "original_cursor",
  }),
])("rejects malformed/expanded/stalled item pagination %#", async (page) => {
  jest.spyOn(commissionReadClient, "get").mockResolvedValue({ data: page });
  await expect(
    requestOwnCommissionItems({ accessToken: "A", cursor: "original_cursor" }),
  ).rejects.toThrow();
});
it("rejects a repeated evaluation cursor rather than looping", async () => {
  jest.spyOn(commissionReadClient, "get").mockResolvedValue({
    data: commissionReadPageFixture([commissionEvaluationFixture], {
      limit: 1,
      hasMore: true,
      nextCursor: "original_cursor",
    }),
  });
  await expect(
    requestOwnCommissionEvaluations({ accessToken: "A", cursor: "original_cursor", limit: 1 }),
  ).rejects.toThrow();
});
it.each([401, 403, 503])("preserves HTTP %s with no fabricated empty page", async (status) => {
  const failure = buildAxiosError(status);
  jest.spyOn(commissionReadClient, "get").mockRejectedValue(failure);
  await expect(requestOwnCommissionItems({ accessToken: "A" })).rejects.toBe(failure);
  await expect(requestOwnCommissionEvaluations({ accessToken: "A" })).rejects.toBe(failure);
});
it("uses captured Bearer A even when tokenStore changes during a queued GET", async () => {
  let entered!: () => void;
  let release!: () => void;
  const entering = new Promise<void>((accept) => {
    entered = accept;
  });
  const paused = new Promise<void>((accept) => {
    release = accept;
  });
  interceptors.push(
    commissionReadClient.interceptors.request.use(async (config) => {
      entered();
      await paused;
      return config;
    }),
  );
  let bearer: unknown;
  commissionReadClient.defaults.adapter = async (config) => {
    bearer = config.headers.Authorization;
    return {
      data: commissionReadPageFixture([commissionItemFixture]),
      status: 200,
      statusText: "OK",
      headers: {},
      config,
    };
  };
  tokenStore.set("captured-A");
  const result = requestOwnCommissionItems({ accessToken: "captured-A" });
  await entering;
  tokenStore.set("current-B");
  release();
  await result;
  expect(bearer).toBe("Bearer captured-A");
  expect(commissionReadClient.defaults.timeout).toBe(10_000);
});
