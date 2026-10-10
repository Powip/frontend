import { isAxiosError } from "axios";
import type { PartnersApiErrorDto } from "../dto/partners-api-error.dto";
import type { PartnerIdentity } from "../models/partner-identity";
import { toPartnerStatus } from "./to-partner-profile";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function getHttpStatus(error: unknown): number | null {
  return isAxiosError(error) ? (error.response?.status ?? null) : null;
}

export function toPartnersApiError(error: unknown): PartnersApiErrorDto | null {
  if (!isAxiosError(error)) return null;
  const body = error.response?.data;
  if (!isRecord(body) || typeof body.code !== "string") return null;

  return {
    code: body.code,
    message: typeof body.message === "string" ? body.message : "",
    correlationId: typeof body.correlationId === "string" ? body.correlationId : null,
    details: isRecord(body.details) ? body.details : {},
  };
}

export function toPartnerIdentityFromError(error: unknown): PartnerIdentity | null {
  const status = getHttpStatus(error);

  if (status === 404) {
    return { kind: "not_partner" };
  }

  if (status !== 403) {
    return null;
  }

  const apiError = toPartnersApiError(error);

  if (apiError?.code !== "PARTNER_NOT_ACTIVE") {
    return { kind: "not_partner" };
  }

  const body = isAxiosError(error) ? error.response?.data : undefined;
  const reportedStatus = apiError.details.status ?? (isRecord(body) ? body.status : undefined);

  return { kind: "not_active", status: toPartnerStatus(reportedStatus) };
}
