import type { AdminPage } from "./admin-partner";

export interface AdminPartnerReferral {
  source: "MANUAL" | "CODE" | "LINK_LEGACY" | "LINK_ATTRIBUTION";
  id: string;
  companyId: string | null;
  businessName: string | null;
  origin: "MANUAL" | "CODE" | "LINK";
  state: string;
  capturedAt: string;
  companyCreatedAt: string | null;
  attributedAt: string | null;
}

export type AdminPartnerReferralPage = AdminPage<AdminPartnerReferral>;
