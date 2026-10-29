export interface AdminDashboardSummary {
  asOf: string;
  counts: {
    partnersTotal: number;
    partnersActive: number;
    partnersSuspended: number;
    applicationsPending: number;
    applicationsRejected: number;
    manualReferrals: number;
    codeReferrals: number;
    legacyLinkReferrals: number;
    linkAttributions: number;
    capturedClaims: number;
    attachedClaims: number;
  };
  financial: {
    availability: "NOT_AVAILABLE";
    reason: "FINANCIAL_ENGINE_NOT_IMPLEMENTED";
    referredMrr: null;
    monthlyCommissions: null;
    discountsGiven: null;
    channelCost: null;
    ltvBrought: null;
    channelRoiMultiplier: null;
  };
}
