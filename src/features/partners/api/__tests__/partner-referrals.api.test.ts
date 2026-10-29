import axiosAuth from "@/lib/axiosAuth";
import partnersMutationsClient from "../partners-mutations.client";
import { getPartnerReferralsApi, registerPartnerReferralApi } from "../partner-referrals.api";

jest.mock("@/lib/api", () => ({
  API: { partners: "https://partners.test/v1/partners" },
}));

jest.mock("@/lib/axiosAuth", () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn() },
}));

jest.mock("../partners-mutations.client", () => ({
  __esModule: true,
  default: { post: jest.fn() },
}));

const mockGet = jest.mocked(axiosAuth.get);
const mockPost = jest.mocked(partnersMutationsClient.post);

describe("getPartnerReferralsApi", () => {
  beforeEach(() => {
    mockGet.mockReset();
  });

  it("pide GET /me/referrals con el cliente autenticado y sin cursor en la primera página", async () => {
    const page = { items: [], nextCursor: null };
    mockGet.mockResolvedValue({ data: page });

    const result = await getPartnerReferralsApi(null);

    expect(mockGet).toHaveBeenCalledWith("https://partners.test/v1/partners/me/referrals", {
      params: undefined,
    });
    expect(result).toBe(page);
  });

  it("envía el cursor como query param para las páginas siguientes", async () => {
    mockGet.mockResolvedValue({ data: { items: [], nextCursor: null } });

    await getPartnerReferralsApi("cursor-2");

    expect(mockGet).toHaveBeenCalledWith("https://partners.test/v1/partners/me/referrals", {
      params: { cursor: "cursor-2" },
    });
  });

  it("envía limit cuando se pide una cantidad acotada", async () => {
    mockGet.mockResolvedValue({ data: { items: [], nextCursor: null } });

    await getPartnerReferralsApi(null, 5);

    expect(mockGet).toHaveBeenCalledWith("https://partners.test/v1/partners/me/referrals", {
      params: { limit: 5 },
    });
  });

  it("no envía partnerId: la identidad sale del bearer", async () => {
    mockGet.mockResolvedValue({ data: { items: [], nextCursor: null } });

    await getPartnerReferralsApi(null);

    expect(JSON.stringify(mockGet.mock.calls[0])).not.toContain("partnerId");
  });

  it("propaga el error HTTP", async () => {
    mockGet.mockRejectedValue(new Error("Request failed with status code 403"));

    await expect(getPartnerReferralsApi(null)).rejects.toThrow("403");
  });
});

describe("registerPartnerReferralApi", () => {
  beforeEach(() => {
    mockPost.mockReset();
  });

  it("hace POST /me/referrals con el body del contrato y el header Idempotency-Key", async () => {
    const response = {
      id: "ref",
      origin: "MANUAL",
      state: "UNDER_REVIEW",
      capturedAt: "2026-09-24T15:00:00Z",
      expiresAt: "2026-11-23T15:00:00Z",
    };
    mockPost.mockResolvedValue({ data: response });

    const body = { businessName: "Zapatería Andes", email: "andes@example.com" };
    const result = await registerPartnerReferralApi(body, "key-123", "fixture-token");

    expect(mockPost).toHaveBeenCalledWith("https://partners.test/v1/partners/me/referrals", body, {
      headers: { "Idempotency-Key": "key-123", Authorization: "Bearer fixture-token" },
    });
    expect(result).toBe(response);
  });

  it("propaga el error HTTP", async () => {
    mockPost.mockRejectedValue(new Error("Request failed with status code 409"));

    await expect(
      registerPartnerReferralApi({ businessName: "A", email: "a@a.com" }, "key-123", "fixture-token"),
    ).rejects.toThrow("409");
  });
});
