import axios from "axios";
import { API } from "@/lib/api";
import { partnerReferralMetricsSchema } from "../schemas/partner-referral-metrics.schema";

export const partnerReferralMetricsClient = axios.create({ timeout: 10_000 });

export interface PartnerReferralMetricsRequest {
  accessToken: string;
  signal?: AbortSignal;
}

export async function requestPartnerReferralMetrics(request: PartnerReferralMetricsRequest) {
  if (!request.accessToken || request.accessToken.trim() !== request.accessToken)
    throw new Error("A current session is required");
  const { data } = await partnerReferralMetricsClient.get<unknown>(
    `${API.partners}/me/referral-metrics`,
    { headers: { Authorization: `Bearer ${request.accessToken}` }, signal: request.signal },
  );
  return partnerReferralMetricsSchema.parse(data);
}
