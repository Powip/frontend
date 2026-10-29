import { toRegisteredReferral } from "../to-registered-referral";

describe("toRegisteredReferral", () => {
  it("adapta la respuesta 201 del alta manual", () => {
    expect(
      toRegisteredReferral({
        id: "77777777-7777-4777-8777-777777777777",
        origin: "MANUAL",
        state: "UNDER_REVIEW",
        capturedAt: "2026-09-24T15:00:00Z",
        expiresAt: "2026-11-23T15:00:00Z",
      }),
    ).toEqual({
      id: "77777777-7777-4777-8777-777777777777",
      origin: "manual",
      status: "en_revision",
      registeredAt: "2026-09-24T15:00:00Z",
      expiresAt: "2026-11-23T15:00:00Z",
    });
  });

  it("deja expiresAt en null cuando el backend no lo informa", () => {
    const result = toRegisteredReferral({
      id: "ref",
      origin: "MANUAL",
      state: "UNDER_REVIEW",
      capturedAt: "2026-09-24T15:00:00Z",
    });

    expect(result.expiresAt).toBeNull();
  });
});
