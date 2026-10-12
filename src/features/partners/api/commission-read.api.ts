import axios from "axios";
import { API } from "@/lib/api";
import {
  commissionEvaluationsPageSchema,
  commissionItemsPageSchema,
  commissionPageParamsSchema,
} from "../schemas/commission-read.schema";

export const commissionReadClient = axios.create({ timeout: 10_000 });
export interface CommissionPageRequest {
  accessToken: string;
  signal?: AbortSignal;
  cursor?: string | null;
  limit?: number;
}

function options(request: CommissionPageRequest) {
  if (
    !request.accessToken ||
    request.accessToken.trim() !== request.accessToken ||
    Object.keys(request).some((key) => !["accessToken", "signal", "cursor", "limit"].includes(key))
  )
    throw new Error("A current own commission session is required");
  const params = commissionPageParamsSchema.parse({ cursor: request.cursor, limit: request.limit });
  return {
    headers: { Authorization: `Bearer ${request.accessToken}` },
    signal: request.signal,
    params: { ...(params.cursor ? { cursor: params.cursor } : {}), limit: params.limit ?? 20 },
  };
}

export async function requestOwnCommissionItems(request: CommissionPageRequest) {
  const config = options(request);
  const { data } = await commissionReadClient.get<unknown>(
    `${API.partners}/me/commissions`,
    config,
  );
  const page = commissionItemsPageSchema.parse(data);
  if (page.limit !== config.params.limit || (request.cursor && page.nextCursor === request.cursor))
    throw new Error("The commission page does not match the requested bounded pagination");
  return page;
}

export async function requestOwnCommissionEvaluations(request: CommissionPageRequest) {
  const config = options(request);
  const { data } = await commissionReadClient.get<unknown>(
    `${API.partners}/me/commission-evaluations`,
    config,
  );
  const page = commissionEvaluationsPageSchema.parse(data);
  if (page.limit !== config.params.limit || (request.cursor && page.nextCursor === request.cursor))
    throw new Error("The evaluation page does not match the requested bounded pagination");
  return page;
}
