// Historical test fixtures only. Live administrative views use the API models.
export interface LegacyAdminPartner {
  id: string;
  name: string;
  handle: string | null;
  code: string | null;
  profile: "agencia" | "dev" | "creador";
  commissionOptionCode: "A" | "B" | "C" | null;
  status: "activo" | "por_aprobar" | "rechazado";
  tierLevel: "bronce" | "plata" | "oro";
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

export interface LegacyAdminPartnerReferral {
  id: string;
  businessName: string;
  origin: "manual" | "codigo" | "link";
  registeredAt: string;
  planName: string | null;
  price: number;
  billingCycle: "mensual" | "anual" | null;
  status: "activo_sin_pago" | "pagando" | "cancelado" | "en_revision";
  firstMonthCommission: number | null;
  recurringCommission: number | null;
}

export interface LegacyAdminDashboardSummary {
  referredMrr: number;
  monthlyCommissions: number;
  discountsGiven: number;
  channelCost: number;
  ltvBrought: number;
  channelRoiMultiplier: number;
  monthlyMrr: { month: string; mrr: number }[];
  referralsByOrigin: { link: number; manual: number; codigo: number };
  clickToPayConversionPct: number;
  funnel: { label: string; count: number }[];
}
