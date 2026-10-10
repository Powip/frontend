export interface AdminDashboardSummary {
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
