import { toRegisterReferralRequestDto } from "../to-register-referral-request-dto";

describe("toRegisterReferralRequestDto", () => {
  it("envía nombre, correo y teléfono sin planId ni planValue", () => {
    const dto = toRegisterReferralRequestDto({
      businessName: "Zapatería Andes",
      email: "andes@example.com",
      phone: "+51987654321",
    });

    expect(dto).toEqual({
      businessName: "Zapatería Andes",
      email: "andes@example.com",
      phone: "+51987654321",
    });
    expect(dto).not.toHaveProperty("planId");
    expect(dto).not.toHaveProperty("planValue");
  });

  it("normaliza el teléfono quitando espacios, guiones y paréntesis", () => {
    const dto = toRegisterReferralRequestDto({
      businessName: "Zapatería Andes",
      email: "andes@example.com",
      phone: "+51 (987) 654-321",
    });

    expect(dto.phone).toBe("+51987654321");
  });

  it.each([undefined, "", "   "])("omite phone cuando llega vacío (%p)", (phone) => {
    const dto = toRegisterReferralRequestDto({
      businessName: "Zapatería Andes",
      email: "andes@example.com",
      phone,
    });

    expect(dto).not.toHaveProperty("phone");
  });
});
