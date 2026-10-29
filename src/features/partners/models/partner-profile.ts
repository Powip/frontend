import type { PartnerPermission } from "./partner-permission.enum";
import type { PartnerStatus } from "./partner-status.enum";

export interface PartnerProfile {
  id: string;
  status: PartnerStatus;
  displayName: string;
  country: string;
  currency: string;
  referralLink: string | null;
  referralCode: string | null;
  permissions: PartnerPermission[];
}
