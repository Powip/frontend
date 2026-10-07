import { API } from "@/lib/api";
import axiosAuth from "@/lib/axiosAuth";
import type { PartnerReferralPageResponseDto } from "../dto/partner-referral-response.dto";
import type { RegisterReferralRequestDto } from "../dto/register-referral-request.dto";
import type { RegisterReferralResponseDto } from "../dto/register-referral-response.dto";

export async function getPartnerReferralsApi(
  cursor: string | null,
  limit?: number,
): Promise<PartnerReferralPageResponseDto> {
  const params = {
    ...(cursor ? { cursor } : {}),
    ...(limit !== undefined ? { limit } : {}),
  };
  const { data } = await axiosAuth.get<PartnerReferralPageResponseDto>(
    `${API.partners}/me/referrals`,
    { params: Object.keys(params).length > 0 ? params : undefined },
  );

  return data;
}

export async function registerPartnerReferralApi(
  requestDto: RegisterReferralRequestDto,
  idempotencyKey: string,
): Promise<RegisterReferralResponseDto> {
  const { data } = await axiosAuth.post<RegisterReferralResponseDto>(
    `${API.partners}/me/referrals`,
    requestDto,
    { headers: { "Idempotency-Key": idempotencyKey } },
  );

  return data;
}
