import type { ReferralOriginDto } from "./partner-referral-response.dto";

export interface RegisterReferralResponseDto {
  id: string;
  origin: ReferralOriginDto;
  state: string;
  capturedAt: string;
  expiresAt?: string | null;
}
