import type { PartnerApprovalStatus } from "./admin-partner";

export type AdminReviewQueueOrigin = "MANUAL" | "CODE";
export interface AdminReviewQueueItem {
  id: string;
  partnerId: string;
  partnerDisplayName: string;
  partnerStatus: PartnerApprovalStatus;
  origin: AdminReviewQueueOrigin;
  state: "CAPTURED" | "UNDER_REVIEW";
  version: number;
  businessName: string;
  capturedAt: string;
  expiresAt: string | null;
}
export interface AdminReviewQueuePage {
  items: AdminReviewQueueItem[];
  nextCursor: string | null;
  hasMore: boolean;
  limit: number;
}
