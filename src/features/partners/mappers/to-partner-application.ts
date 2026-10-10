import type {
  AdminApplicationPageResponseDto,
  AdminApplicationResponseDto,
} from "../dto/admin-application-response.dto";
import type { PartnerApplication, PartnerApplicationStatus } from "../models/partner-application";
import type { PartnerApplicationPage } from "../models/partner-application-page";

const STATUS_BY_DTO = new Map<string, PartnerApplicationStatus>([
  ["APPLIED", "applied"],
  ["ACTIVE", "approved"],
  ["REJECTED", "rejected"],
]);

export function toPartnerApplicationStatus(status: string): PartnerApplicationStatus {
  return STATUS_BY_DTO.get(status) ?? "unknown";
}

export function toPartnerApplication(dto: AdminApplicationResponseDto): PartnerApplication {
  return {
    id: dto.id,
    reference: dto.applicationReference,
    email: dto.email,
    displayName: dto.displayName,
    country: dto.country,
    status: toPartnerApplicationStatus(dto.status),
    rawStatus: dto.status,
    appliedAt: dto.appliedAt,
  };
}

export function toPartnerApplicationPage(
  dto: AdminApplicationPageResponseDto,
): PartnerApplicationPage {
  return {
    items: dto.items.map(toPartnerApplication),
    nextCursor: dto.nextCursor ?? null,
  };
}
