import type { RegisterReferralResponseDto } from "../dto/register-referral-response.dto";
import type { RegisteredReferral } from "../models/registered-referral";
import { toReferralOrigin, toReferralStatus } from "./to-partner-referral";

export function toRegisteredReferral(dto: RegisterReferralResponseDto): RegisteredReferral {
  return {
    id: dto.id,
    origin: toReferralOrigin(dto.origin),
    status: toReferralStatus(dto.state),
    registeredAt: dto.capturedAt,
    expiresAt: dto.expiresAt ?? null,
  };
}
