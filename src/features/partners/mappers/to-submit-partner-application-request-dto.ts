import type { SubmitPartnerApplicationRequestDto } from "../dto/submit-partner-application-request.dto";
import type { SubmitPartnerApplicationFormValues } from "../schemas/submit-partner-application.schema";

export function normalizePhone(phone: string): string {
  return phone.replace(/[\s()-]/g, "");
}

export function toSubmitPartnerApplicationRequestDto(
  values: SubmitPartnerApplicationFormValues,
): SubmitPartnerApplicationRequestDto {
  return {
    email: values.email.trim(),
    legalName: values.legalName.trim(),
    contactName: values.contactName.trim(),
    phone: normalizePhone(values.phone),
    country: values.country.trim().toUpperCase(),
  };
}
