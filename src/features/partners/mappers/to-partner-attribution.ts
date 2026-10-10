import type { PartnerAttributionPageResponseDto, PartnerAttributionResponseDto } from "../dto/partner-attribution-response.dto";
import type { PartnerAttribution, PartnerAttributionPage } from "../models/partner-attribution";

export function toPartnerAttribution(dto: PartnerAttributionResponseDto): PartnerAttribution {
  return {
    id: dto.id,
    companyId: dto.companyId,
    state: dto.state,
    source: dto.source,
    reason: dto.reason,
    capturedAt: dto.capturedAt,
    expiresAt: dto.expiresAt,
    companyCreatedAt: dto.companyCreatedAt,
    confirmedAt: dto.confirmedAt,
    resolutionVersion: dto.resolutionVersion,
  };
}

export function toPartnerAttributionPage(dto: PartnerAttributionPageResponseDto): PartnerAttributionPage {
  return { items: dto.items.map(toPartnerAttribution), nextCursor: dto.nextCursor };
}
