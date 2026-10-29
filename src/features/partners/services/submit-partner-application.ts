import { submitPartnerApplicationApi } from "../api/partner-applications.api";
import { toSubmitPartnerApplicationRequestDto } from "../mappers/to-submit-partner-application-request-dto";
import type { SubmittedPartnerApplication } from "../models/submitted-partner-application";
import type { SubmitPartnerApplicationFormValues } from "../schemas/submit-partner-application.schema";

export interface SubmitPartnerApplicationInput {
  values: SubmitPartnerApplicationFormValues;
  idempotencyKey: string;
}

export async function submitPartnerApplication({
  values,
  idempotencyKey,
}: SubmitPartnerApplicationInput): Promise<SubmittedPartnerApplication> {
  const responseDto = await submitPartnerApplicationApi(
    toSubmitPartnerApplicationRequestDto(values),
    idempotencyKey,
  );

  return { reference: responseDto.applicationReference, status: responseDto.status };
}
