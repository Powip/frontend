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

export async function approveAdminApplication({
  applicationId,
  reason,
  idempotencyKey,
}: ApplicationDecisionInput): Promise<ApprovedApplication> {
  const responseDto = await approveAdminApplicationApi(
    applicationId,
    { reason: reason.trim() },
    idempotencyKey,
  );

  return toApprovedApplication(responseDto);
}

export async function rejectAdminApplication({
  applicationId,
  reason,
  idempotencyKey,
}: ApplicationDecisionInput): Promise<RejectedApplication> {
  const responseDto = await rejectAdminApplicationApi(
    applicationId,
    { reason: reason.trim() },
    idempotencyKey,
  );

  return toRejectedApplication(responseDto);
}
