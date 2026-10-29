export type PartnerPermission =
  | "REFERRALS_READ"
  | "REFERRALS_CREATE"
  | "COMMISSIONS_READ"
  | "PAYOUTS_READ";

export const PARTNER_PERMISSIONS: PartnerPermission[] = [
  "REFERRALS_READ",
  "REFERRALS_CREATE",
  "COMMISSIONS_READ",
  "PAYOUTS_READ",
];
