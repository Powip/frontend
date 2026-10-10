import type { PartnerMeResponseDto } from "../dto/partner-me-response.dto";
import { PARTNER_PERMISSIONS, type PartnerPermission } from "../models/partner-permission.enum";
import type { PartnerProfile } from "../models/partner-profile";
import type { PartnerStatus } from "../models/partner-status.enum";

const STATUS_BY_DTO = new Map<string, PartnerStatus>([
  ["ACTIVE", "active"],
  ["SUSPENDED", "suspended"],
  ["APPLIED", "pending"],
  ["REJECTED", "rejected"],
]);

function isPartnerPermission(value: string): value is PartnerPermission {
  return (PARTNER_PERMISSIONS as string[]).includes(value);
}

export function toPartnerStatus(status: unknown): PartnerStatus {
  if (typeof status !== "string") return "unknown";
  return STATUS_BY_DTO.get(status) ?? "unknown";
}

export function toPartnerPermissions(permissions: unknown): PartnerPermission[] {
  if (!Array.isArray(permissions)) return [];
  return [
    ...new Set(
      permissions.filter(
        (permission): permission is PartnerPermission =>
          typeof permission === "string" && isPartnerPermission(permission),
      ),
    ),
  ];
}

export function toPartnerProfile(dto: PartnerMeResponseDto): PartnerProfile {
  return {
    id: dto.id,
    status: toPartnerStatus(dto.status),
    displayName: dto.displayName,
    country: dto.country,
    currency: dto.currency,
    referralLink: dto.referralLink ?? null,
    referralCode: dto.referralCode ?? null,
    permissions: toPartnerPermissions(dto.permissions),
  };
}
