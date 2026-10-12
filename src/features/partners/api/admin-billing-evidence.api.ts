import axios from "axios";
import { API } from "@/lib/api";
import {
  type AdminBillingEvidence,
  type AdminBillingEvidencePage,
  adminBillingEvidencePageSchema,
  adminBillingEvidenceSchema,
  type BillingEvidenceState,
} from "../schemas/admin-billing-evidence.schema";

// No global mutable Authorization interceptor: pin the initiating session at dispatch.
export const adminBillingEvidenceClient = axios.create({ timeout: 10_000 });
interface BillingReadRequest {
  accessToken: string;
  signal?: AbortSignal;
}
export async function requestAdminBillingEvidence(
  request: BillingReadRequest & {
    cursor?: string | null;
    limit?: number;
    state?: BillingEvidenceState | null;
  },
): Promise<AdminBillingEvidencePage> {
  const { data } = await adminBillingEvidenceClient.get<unknown>(
    `${API.partners}/admin/billing-evidence`,
    {
      headers: { Authorization: `Bearer ${request.accessToken}` },
      signal: request.signal,
      params: {
        ...(request.cursor ? { cursor: request.cursor } : {}),
        ...(request.limit !== undefined ? { limit: request.limit } : {}),
        ...(request.state ? { state: request.state } : {}),
      },
    },
  );
  return adminBillingEvidencePageSchema.parse(data);
}
export async function requestAdminBillingEvidenceDetail(
  request: BillingReadRequest & {
    evidenceId: string;
  },
): Promise<AdminBillingEvidence> {
  const { data } = await adminBillingEvidenceClient.get<unknown>(
    `${API.partners}/admin/billing-evidence/${encodeURIComponent(request.evidenceId)}`,
    {
      headers: { Authorization: `Bearer ${request.accessToken}` },
      signal: request.signal,
    },
  );
  return adminBillingEvidenceSchema.parse(data);
}
