import { buildAttributionDto } from "../../test-utils/partner-attribution.fixture";
import { toPartnerAttribution, toPartnerAttributionPage } from "../to-partner-attribution";

it.each([1, 2])("preserves v%s identifiers, LINK and evidence dates without adding PII, plans or money", (resolutionVersion) => {
  const dto = buildAttributionDto({ resolutionVersion });
  const result = toPartnerAttribution(dto);
  const visibleEvidence = Object.fromEntries(Object.entries(dto).filter(([key]) => key !== "claimId"));
  expect(result).toEqual(visibleEvidence);
  for (const field of ["name", "businessName", "email", "planName", "firstMonthCommission", "amount", "claimId"]) {
    expect(result).not.toHaveProperty(field);
  }
});

it("does not project internal identity proof or PII from an expanded v2 object", () => {
  const dto = {
    ...buildAttributionDto({ resolutionVersion: 2 }),
    partnerAuthIdentityId: "88888888-8888-4888-8888-888888888888",
    partnerAuthIssuer: "ms-auth",
    partnerAuthSubject: "99999999-9999-4999-8999-999999999999",
    email: "fixture-only@review.invalid",
  };
  const projected = toPartnerAttribution(dto);
  expect(projected.resolutionVersion).toBe(2);
  for (const field of ["partnerAuthIdentityId", "partnerAuthIssuer", "partnerAuthSubject", "email", "claimId"]) {
    expect(projected).not.toHaveProperty(field);
  }
});

it("keeps page order and the opaque cursor exactly as supplied", () => {
  const dto = buildAttributionDto();
  const second = buildAttributionDto({ id: "66666666-6666-4666-8666-666666666666", resolutionVersion: 2 });
  const page = toPartnerAttributionPage({ items: [dto, second], nextCursor: "opaque-next" });
  expect(page.items.map((item) => item.id)).toEqual([dto.id, second.id]);
  expect(page.items.map((item) => item.resolutionVersion)).toEqual([1, 2]);
  expect(page.nextCursor).toBe("opaque-next");
  expect(toPartnerAttributionPage({ items: [], nextCursor: null })).toEqual({ items: [], nextCursor: null });
});
