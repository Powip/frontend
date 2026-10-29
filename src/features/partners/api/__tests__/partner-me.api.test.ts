import axiosAuth from "@/lib/axiosAuth";
import { getPartnerMeApi } from "../partner-me.api";

jest.mock("@/lib/api", () => ({
  API: { partners: "https://partners.test/v1/partners" },
}));

jest.mock("@/lib/axiosAuth", () => ({
  __esModule: true,
  default: { get: jest.fn() },
}));

const mockGet = jest.mocked(axiosAuth.get);

describe("getPartnerMeApi", () => {
  beforeEach(() => {
    mockGet.mockReset();
  });

  it("pide GET /me con el cliente autenticado, sin parámetros ni partnerId", async () => {
    const profile = { id: "p", status: "ACTIVE" };
    mockGet.mockResolvedValue({ data: profile });

    const result = await getPartnerMeApi();

    expect(mockGet).toHaveBeenCalledTimes(1);
    expect(mockGet.mock.calls[0]).toEqual(["https://partners.test/v1/partners/me"]);
    expect(JSON.stringify(mockGet.mock.calls[0])).not.toContain("partnerId");
    expect(result).toBe(profile);
  });

  it("propaga el error HTTP sin reemplazarlo", async () => {
    const error = new Error("Request failed with status code 500");
    mockGet.mockRejectedValue(error);

    await expect(getPartnerMeApi()).rejects.toBe(error);
  });
});
