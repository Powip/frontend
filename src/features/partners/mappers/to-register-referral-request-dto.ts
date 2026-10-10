import type { RegisterReferralRequestDto } from "../dto/register-referral-request.dto";
import type { RegisterReferralFormValues } from "../schemas/register-referral.schema";

export function toRegisterReferralRequestDto(
  values: RegisterReferralFormValues,
): RegisterReferralRequestDto {
  const phone = values.phone?.replace(/[\s()-]/g, "");

  return {
    businessName: values.businessName,
    email: values.email,
    ...(phone ? { phone } : {}),
  };
}
