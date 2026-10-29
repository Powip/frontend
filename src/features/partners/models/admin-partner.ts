export type PartnerApprovalStatus = "APPLIED" | "ACTIVE" | "SUSPENDED" | "REJECTED";

export interface AdminPartner {
  id: string;
  displayName: string;
  country: string;
  currency: string;
  status: PartnerApprovalStatus;
  version: number;
  applicationReference: string;
  appliedAt: string;
  activatedAt: string | null;
  createdAt: string;
  updatedAt: string;
  referralCode: string | null;
  manualReferralsCount: number;
  linkAttributionsCount: number;
}

export interface AdminPage<T> {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
  limit: number;
}

export type AdminPartnerPage = AdminPage<AdminPartner>;
