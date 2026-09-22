import { addPartnerReferral } from "../mocks/partner-referrals.store";
import { PARTNER_PLAN_OPTIONS } from "../models/plan-option";
import type { PartnerReferral } from "../models/partner-referral";
import type { RegisterReferralFormValues } from "../schemas/register-referral.schema";

export async function registerReferral(
  input: RegisterReferralFormValues,
): Promise<PartnerReferral> {
  await new Promise((resolve) => setTimeout(resolve, 300));

  const planLabel =
    PARTNER_PLAN_OPTIONS.find((option) => option.value === input.planValue)?.label ?? null;

  const referral: PartnerReferral = {
    id: `ref-${Date.now()}`,
    businessName: input.businessName,
    origin: "manual",
    status: "correo_enviado",
    registeredAt: new Date().toISOString().slice(0, 10),
    planName: planLabel,
    firstMonthCommission: null,
    recurringCommission: null,
  };

  addPartnerReferral(referral);

  return referral;
}
