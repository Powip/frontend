import axios from "axios";
import { API } from "@/lib/api";
import { commissionPageParamsSchema } from "../schemas/commission-read.schema";
import {
  financialLedgerBalanceSchema,
  financialLedgerPageSchema,
  financialLedgerPartnerIdSchema,
} from "../schemas/financial-ledger.schema";

export const financialLedgerClient = axios.create({ timeout: 10_000 });
interface SessionRequest {
  accessToken: string;
  signal?: AbortSignal;
}
interface PageRequest extends SessionRequest {
  cursor?: string | null;
  limit?: number;
}
interface AdminBalanceRequest extends SessionRequest {
  partnerId: string;
}
interface AdminPageRequest extends PageRequest {
  partnerId: string;
}
function sessionOptions(request: SessionRequest, allowed: string[]) {
  if (
    !request.accessToken ||
    request.accessToken.trim() !== request.accessToken ||
    Object.keys(request).some((key) => !allowed.includes(key))
  )
    throw new Error("An exact current own ledger session is required.");
  return {
    headers: { Authorization: `Bearer ${request.accessToken}` },
    signal: request.signal,
  };
}
export async function requestOwnFinancialLedger(request: PageRequest) {
  const config = sessionOptions(request, ["accessToken", "signal", "cursor", "limit"]);
  const params = commissionPageParamsSchema.parse({ cursor: request.cursor, limit: request.limit });
  const limit = params.limit ?? 20;
  const { data } = await financialLedgerClient.get<unknown>(`${API.partners}/me/financial-ledger`, {
    ...config,
    params: { ...(params.cursor ? { cursor: params.cursor } : {}), limit },
  });
  const page = financialLedgerPageSchema.parse(data);
  if (page.limit !== limit || (request.cursor && request.cursor === page.nextCursor))
    throw new Error("The ledger cursor does not match the requested page.");
  return page;
}
export async function requestOwnFinancialBalance(request: SessionRequest) {
  const config = sessionOptions(request, ["accessToken", "signal"]);
  const { data } = await financialLedgerClient.get<unknown>(
    `${API.partners}/me/financial-balance`,
    config,
  );
  return financialLedgerBalanceSchema.parse(data);
}

export async function requestAdminFinancialLedger(request: AdminPageRequest) {
  const config = sessionOptions(request, ["accessToken", "signal", "partnerId", "cursor", "limit"]);
  const partnerId = financialLedgerPartnerIdSchema.parse(request.partnerId);
  const params = commissionPageParamsSchema.parse({ cursor: request.cursor, limit: request.limit });
  const limit = params.limit ?? 20;
  const { data } = await financialLedgerClient.get<unknown>(
    `${API.partners}/admin/financial-ledger`,
    {
      ...config,
      params: {
        partnerId,
        currency: "PEN",
        ...(params.cursor ? { cursor: params.cursor } : {}),
        limit,
      },
    },
  );
  const page = financialLedgerPageSchema.parse(data);
  if (
    page.limit !== limit ||
    (request.cursor && request.cursor === page.nextCursor) ||
    page.items.some((item) => item.partnerId !== partnerId)
  )
    throw new Error("The administrative ledger page does not match its requested partner scope.");
  return page;
}

export async function requestAdminFinancialBalance(request: AdminBalanceRequest) {
  const config = sessionOptions(request, ["accessToken", "signal", "partnerId"]);
  const partnerId = financialLedgerPartnerIdSchema.parse(request.partnerId);
  const { data } = await financialLedgerClient.get<unknown>(
    `${API.partners}/admin/financial-balance`,
    { ...config, params: { partnerId, currency: "PEN" } },
  );
  const balance = financialLedgerBalanceSchema.parse(data);
  if (balance.partnerId !== partnerId)
    throw new Error("The administrative balance does not match its requested partner scope.");
  return balance;
}
