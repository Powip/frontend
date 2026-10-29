import axios from "axios";
import { API } from "@/lib/api";
import type { PartnerAttributionPageResponseDto } from "../dto/partner-attribution-response.dto";
import { partnerAttributionPageResponseSchema } from "../schemas/partner-attribution-response.schema";

// A captured session bearer must not be replaced by the mutable auth interceptor.
export const partnerAttributionsClient = axios.create({ timeout: 10_000 });

export async function getPartnerAttributionsApi(
  cursor: string | null,
  accessToken: string,
  signal?: AbortSignal,
): Promise<PartnerAttributionPageResponseDto> {
  const { data } = await partnerAttributionsClient.get<unknown>(`${API.partners}/me/attributions`, {
    params: cursor ? { cursor } : undefined,
    headers: { Authorization: `Bearer ${accessToken}` },
    signal,
  });
  return partnerAttributionPageResponseSchema.parse(data);
}
