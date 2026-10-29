import { applicationDecisionSchema } from "../application-decision.schema";
import { submitPartnerApplicationSchema } from "../submit-partner-application.schema";
import { toSubmitPartnerApplicationRequestDto } from "../../mappers/to-submit-partner-application-request-dto";

const VALID_APPLICATION = {
  email: "partner@example.com",
  legalName: "Partner Demo SAC",
  contactName: "Andrea Partner",
  phone: "+51 999 999 999",
  country: "PE",
};

describe("límites del contrato HTTP de solicitudes de ms-partners", () => {
  it.each(["legalName", "contactName"] as const)(
    "%s acepta los límites 2 y 160 y rechaza 1 y 161 caracteres",
    (field) => {
      for (const length of [2, 160]) {
        expect(
          submitPartnerApplicationSchema.safeParse({
            ...VALID_APPLICATION,
            [field]: "a".repeat(length),
          }).success,
        ).toBe(true);
      }
      for (const length of [1, 161]) {
        const result = submitPartnerApplicationSchema.safeParse({
          ...VALID_APPLICATION,
          [field]: "a".repeat(length),
        });
        expect(result.success).toBe(false);
        if (!result.success) expect(result.error.issues[0].path).toEqual([field]);
      }
    },
  );

  it("acepta correo de 320 caracteres y rechaza más de 320", () => {
    const email = `${"a".repeat(64)}@${Array(4).fill("b".repeat(63)).join(".")}`;
    expect(email).toHaveLength(320);
    expect(submitPartnerApplicationSchema.safeParse({ ...VALID_APPLICATION, email }).success).toBe(
      true,
    );
    expect(
      submitPartnerApplicationSchema.safeParse({ ...VALID_APPLICATION, email: `a${email}` })
        .success,
    ).toBe(false);
  });

  it.each(["1234567", "12345 12345 12345 12345 12345 12345"])(
    "valida la longitud del teléfono transmitido y acepta el límite: %s",
    (phone) => {
      const parsed = submitPartnerApplicationSchema.parse({ ...VALID_APPLICATION, phone });
      expect(toSubmitPartnerApplicationRequestDto(parsed).phone.length).toBeGreaterThanOrEqual(7);
      expect(toSubmitPartnerApplicationRequestDto(parsed).phone.length).toBeLessThanOrEqual(30);
    },
  );

  it.each(["12 (34) 56", "1".repeat(31)])(
    "rechaza teléfono fuera del límite transmitido: %s",
    (phone) => {
      const result = submitPartnerApplicationSchema.safeParse({ ...VALID_APPLICATION, phone });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toEqual(["phone"]);
        expect(result.error.issues[0].message).toContain("7 y 30");
      }
    },
  );

  it.each([2, 501])("rechaza motivo de %i caracteres que el API rechazaría", (length) => {
    expect(applicationDecisionSchema.safeParse({ reason: "a".repeat(length) }).success).toBe(false);
  });

  it.each([3, 500])("acepta motivo de %i caracteres y recorta espacios", (length) => {
    const reason = "a".repeat(length);
    expect(applicationDecisionSchema.parse({ reason: `  ${reason}  ` }).reason).toBe(reason);
  });
});
