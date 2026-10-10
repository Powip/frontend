import type { PartnerTierLevel } from "./partner-tier";

export type PartnerProfile = "agencia" | "dev" | "creador";

export type PartnerApprovalStatus = "activo" | "por_aprobar" | "rechazado";

export interface AdminPartner {
  id: string;
  name: string;
  handle: string | null;
  code: string | null;
  profile: PartnerProfile;
  commissionOptionCode: "A" | "B" | "C" | null;
  status: PartnerApprovalStatus;
  tierLevel: PartnerTierLevel;
  joinedAt: string | null;
  payoutMethodLabel: string | null;
  referralsCount: number;
  activeReferralsCount: number;
  mrr: number;
  ticketPromedio: number;
  conversionPct: number;
  ltvEstimado: number;
  recurringCommissionMonthly: number;
}
