import { toPartnerApplication, toPartnerApplicationPage } from "../to-partner-application";

const DTO = {
  id: "11111111-1111-4111-8111-111111111111",
  applicationReference: "APP-2026-000001",
  email: "partner@example.com",
  displayName: "Partner Demo",
  country: "PE",
  status: "APPLIED",
  appliedAt: "2026-09-24T15:00:00Z",
};

describe("toPartnerApplication", () => {
  it("mapea la solicitud conservando su id real", () => {
    expect(toPartnerApplication(DTO)).toEqual({
      id: DTO.id,
      reference: "APP-2026-000001",
      email: "partner@example.com",
      displayName: "Partner Demo",
      country: "PE",
      status: "applied",
      rawStatus: "APPLIED",
      appliedAt: "2026-09-24T15:00:00Z",
    });
  });

  it.each([
    ["APPLIED", "applied"],
    ["ACTIVE", "approved"],
    ["REJECTED", "rejected"],
    ["SOMETHING_NEW", "unknown"],
  ])("mapea el estado %s a %s", (status, expected) => {
    expect(toPartnerApplication({ ...DTO, status }).status).toBe(expected);
  });
});

describe("toPartnerApplicationPage", () => {
  it("conserva el cursor siguiente", () => {
    expect(toPartnerApplicationPage({ items: [DTO], nextCursor: "next" })).toMatchObject({
      items: [{ id: DTO.id }],
      nextCursor: "next",
    });
  });
});
