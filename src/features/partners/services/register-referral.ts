import { registerPartnerReferralApi } from "../api/partner-referrals.api";
import { toRegisterReferralRequestDto } from "../mappers/to-register-referral-request-dto";
import { toRegisteredReferral } from "../mappers/to-registered-referral";
import type { RegisteredReferral } from "../models/registered-referral";
import type { RegisterReferralFormValues } from "../schemas/register-referral.schema";

export interface RegisterReferralInput {
  values: RegisterReferralFormValues;
  idempotencyKey: string;
}

export async function registerReferral({
  values,
  idempotencyKey,
}: RegisterReferralInput): Promise<RegisteredReferral> {
  const responseDto = await registerPartnerReferralApi(
    toRegisterReferralRequestDto(values),
    idempotencyKey,
  );

  return toRegisteredReferral(responseDto);
}
