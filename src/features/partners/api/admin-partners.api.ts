import axios from "axios";
import { API } from "@/lib/api";
import type { AdminDashboardSummary } from "../models/admin-dashboard-summary";
import type {
  AdminPartner,
  AdminPartnerPage,
  PartnerApprovalStatus,
} from "../models/admin-partner";
import type { AdminPartnerActivityPage } from "../models/admin-partner-activity";
import type { AdminPartnerReferralPage } from "../models/admin-partner-referral";
import type { AdminReviewQueueOrigin, AdminReviewQueuePage } from "../models/admin-review-queue";
import {
  adminDashboardSummaryResponseSchema,
  adminPartnerActivityPageResponseSchema,
  adminPartnerReferralsPageResponseSchema,
  adminPartnerResponseSchema,
  adminPartnersPageResponseSchema,
  adminReviewQueuePageResponseSchema,
} from "../schemas/admin-partners-response.schema";

// Pin the initiating bearer; the global mutable auth interceptor must not replace it.
export const adminPartnersClient = axios.create({ timeout: 10_000 });

export interface AdminReadRequest {
  accessToken: string;
  signal?: AbortSignal;
}
export interface AdminPageRequest extends AdminReadRequest {
  cursor?: string | null;
  limit?: number;
}
export interface AdminPartnerRequest extends AdminReadRequest {
  partnerId: string;
}
export interface AdminPartnerPageRequest extends AdminPageRequest {
  partnerId: string;
}

function pageParams({ cursor, limit }: AdminPageRequest) {
  return { ...(cursor ? { cursor } : {}), ...(limit !== undefined ? { limit } : {}) };
}
function sessionOptions({ accessToken, signal }: AdminReadRequest) {
  return { headers: { Authorization: `Bearer ${accessToken}` }, signal };
}

export async function requestAdminPartners(
  request: AdminPageRequest & { status?: PartnerApprovalStatus | null },
): Promise<AdminPartnerPage> {
  const { data } = await adminPartnersClient.get<unknown>(`${API.partners}/admin/partners`, {
    ...sessionOptions(request),
    params: { ...pageParams(request), ...(request.status ? { status: request.status } : {}) },
  });
  return adminPartnersPageResponseSchema.parse(data);
}

export async function requestAdminPartner(request: AdminPartnerRequest): Promise<AdminPartner> {
  const { data } = await adminPartnersClient.get<unknown>(
    `${API.partners}/admin/partners/${encodeURIComponent(request.partnerId)}`,
    sessionOptions(request),
  );
  return adminPartnerResponseSchema.parse(data);
}

export async function requestAdminPartnerReferrals(
  request: AdminPartnerPageRequest,
): Promise<AdminPartnerReferralPage> {
  const { data } = await adminPartnersClient.get<unknown>(
    `${API.partners}/admin/partners/${encodeURIComponent(request.partnerId)}/referrals`,
    { ...sessionOptions(request), params: pageParams(request) },
  );
  return adminPartnerReferralsPageResponseSchema.parse(data);
}

export async function requestAdminPartnerActivity(
  request: AdminPartnerPageRequest,
): Promise<AdminPartnerActivityPage> {
  const { data } = await adminPartnersClient.get<unknown>(
    `${API.partners}/admin/partners/${encodeURIComponent(request.partnerId)}/activity`,
    { ...sessionOptions(request), params: pageParams(request) },
  );
  return adminPartnerActivityPageResponseSchema.parse(data);
}

export async function requestAdminDashboardSummary(
  request: AdminReadRequest,
): Promise<AdminDashboardSummary> {
  const { data } = await adminPartnersClient.get<unknown>(
    `${API.partners}/admin/dashboard-summary`,
    sessionOptions(request),
  );
  return adminDashboardSummaryResponseSchema.parse(data);
}

export async function requestAdminReviewQueue(
  request: AdminPageRequest & { origin?: AdminReviewQueueOrigin | null },
): Promise<AdminReviewQueuePage> {
  const { data } = await adminPartnersClient.get<unknown>(`${API.partners}/admin/review-queue`, {
    ...sessionOptions(request),
    params: { ...pageParams(request), ...(request.origin ? { origin: request.origin } : {}) },
  });
  return adminReviewQueuePageResponseSchema.parse(data);
}
