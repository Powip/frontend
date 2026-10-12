import axios from "axios";
import { API } from "@/lib/api";
import type { AdminCommissionPolicyDraftCommand } from "../models/admin-commission-policy";
import {
  adminCommissionPolicyDraftCommandSchema,
  adminCommissionPolicyPageSchema,
  adminCommissionPolicyVersionSchema,
} from "../schemas/admin-commission-policy.schema";
import type { AdminPageRequest, AdminReadRequest } from "./admin-partners.api";

export const adminCommissionPolicyClient = axios.create({ timeout: 10_000 });
const endpoint = () => `${API.partners}/admin/commission-policy-versions`;

export async function requestAdminCommissionPolicyVersions(request: AdminPageRequest) {
  const { data } = await adminCommissionPolicyClient.get<unknown>(endpoint(), {
    headers: { Authorization: `Bearer ${request.accessToken}` },
    signal: request.signal,
    params: {
      ...(request.cursor ? { cursor: request.cursor } : {}),
      ...(request.limit !== undefined ? { limit: request.limit } : {}),
    },
  });
  return adminCommissionPolicyPageSchema.parse(data);
}

export async function requestCreateAdminCommissionPolicyDraft(
  request: AdminReadRequest & {
    command: AdminCommissionPolicyDraftCommand;
    idempotencyKey: string;
  },
) {
  const command = adminCommissionPolicyDraftCommandSchema.parse(request.command);
  const { data } = await adminCommissionPolicyClient.post<unknown>(endpoint(), command, {
    headers: {
      Authorization: `Bearer ${request.accessToken}`,
      "Idempotency-Key": request.idempotencyKey,
    },
    signal: request.signal,
  });
  return adminCommissionPolicyVersionSchema.parse(data);
}
