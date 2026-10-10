import {
  approveAdminApplicationApi,
  rejectAdminApplicationApi,
} from "../api/partner-applications.api";
import { toApprovedApplication, toRejectedApplication } from "../mappers/to-application-decision";
import type { ApprovedApplication, RejectedApplication } from "../models/application-decision";

export interface ApplicationDecisionInput {
  applicationId: string;
  reason: string;
  idempotencyKey: string;
}

export async function approveAdminApplication(
  { applicationId, reason, idempotencyKey }: ApplicationDecisionInput,
  accessToken: string,
): Promise<ApprovedApplication> {
  const responseDto = await approveAdminApplicationApi(
    applicationId,
    { reason: reason.trim() },
    idempotencyKey,
    accessToken,
  );

  return toApprovedApplication(responseDto);
}

export async function rejectAdminApplication(
  { applicationId, reason, idempotencyKey }: ApplicationDecisionInput,
  accessToken: string,
): Promise<RejectedApplication> {
  const responseDto = await rejectAdminApplicationApi(
    applicationId,
    { reason: reason.trim() },
    idempotencyKey,
    accessToken,
  );

  return toRejectedApplication(responseDto);
}
