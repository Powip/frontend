import type { DefaultValues } from "react-hook-form";
import type { RegisterReferralFormValues } from "./register-referral.schema";

export const registerReferralDefaultValues: DefaultValues<RegisterReferralFormValues> = {
  businessName: "",
  email: "",
  phone: "",
  planValue: undefined,
};
