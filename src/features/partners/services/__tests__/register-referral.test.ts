import { registerPartnerReferralApi } from "../../api/partner-referrals.api";
import { registerReferral } from "../register-referral";

jest.mock("../../api/partner-referrals.api", () => ({
  registerPartnerReferralApi: jest.fn(),
}));

const mockRegisterPartnerReferralApi = jest.mocked(registerPartnerReferralApi);

describe("registerReferral", () => {
  beforeEach(() => {
    mockRegisterPartnerReferralApi.mockReset();
    mockRegisterPartnerReferralApi.mockResolvedValue({
      id: "77777777-7777-4777-8777-777777777777",
      origin: "MANUAL",
      state: "UNDER_REVIEW",
      capturedAt: "2026-09-24T15:00:00Z",
      expiresAt: "2026-11-23T15:00:00Z",
    });
  });

  it("envía el DTO del contrato y la Idempotency-Key recibida", async () => {
    await registerReferral({
      values: { businessName: "Café Norte", email: "cafe@norte.com", phone: "+51 999 111 222" },
      idempotencyKey: "key-abc",
    }, "fixture-token");

    expect(mockRegisterPartnerReferralApi).toHaveBeenCalledWith(
      { businessName: "Café Norte", email: "cafe@norte.com", phone: "+51999111222" },
      "key-abc",
      "fixture-token",
    );
  });

  it("devuelve el referido registrado en el estado que informa el backend", async () => {
    const result = await registerReferral({
      values: { businessName: "Café Norte", email: "cafe@norte.com", phone: "" },
      idempotencyKey: "key-abc",
    }, "fixture-token");

    expect(result).toEqual({
      id: "77777777-7777-4777-8777-777777777777",
      origin: "manual",
      status: "en_revision",
      registeredAt: "2026-09-24T15:00:00Z",
      expiresAt: "2026-11-23T15:00:00Z",
    });
  });

  it("propaga el error del backend", async () => {
    mockRegisterPartnerReferralApi.mockRejectedValue(new Error("409"));

    await expect(
      registerReferral({
        values: { businessName: "Café Norte", email: "cafe@norte.com" },
        idempotencyKey: "key-abc",
      }, "fixture-token"),
    ).rejects.toThrow("409");
  });
});
