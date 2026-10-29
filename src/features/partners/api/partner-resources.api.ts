import axios from "axios";
import { API } from "@/lib/api";
import { partnerResourcePageResponseSchema } from "../schemas/partner-resource-response.schema";

// Pin the captured session: do not use the mutable axiosAuth interceptor.
export const partnerResourcesClient = axios.create({ timeout: 10_000 });

export async function getPartnerResourcesApi(accessToken: string, signal?: AbortSignal) {
  if (!accessToken) throw new Error("A current session is required");
  const { data } = await partnerResourcesClient.get<unknown>(`${API.partners}/me/resources`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal,
  });
  return partnerResourcePageResponseSchema.parse(data);
}
