export interface CommercialLeadReportParams {
  storeId?: string;
  storeIds?: string;
  fromDate?: string;
  toDate?: string;
  typeCode?: string;
  assignedSellerId?: string;
  includeUnassignedStore?: boolean;
}
export interface CommercialLeadReportCounts {
  received: number;
  open: number;
  lost: number;
  converted: number;
  sellerConverted: number;
  webPrepaidConverted: number;
  legacyConverted: number;
  conversionRate: number;
  pipelineReceived: number;
  pipelineConversionRate: number;
}
export interface CommercialLeadReport {
  period: {
    fromDate: string;
    toDate: string;
    timeZone: "America/Lima";
    cohort: "RECEIVED";
    conversionBasis: "CURRENT_STATUS";
  };
  scope: { storeIds: string[]; includeUnassignedStore: boolean };
  totals: CommercialLeadReportCounts;
  byType: Array<
    CommercialLeadReportCounts & {
      typeCode: string;
      name: string;
      active: boolean;
    }
  >;
  /** Distribution by currently assigned seller; it does not identify who confirmed. */
  bySeller: Array<CommercialLeadReportCounts & { sellerId: string | null }>;
  byConfirmer: Array<{
    confirmerId: string | null;
    basis: "SELLER" | "WEB_PREPAID" | "LEGACY_VERIFIED";
    count: number;
  }>;
  amountsByCurrency: Array<{
    currency: string;
    estimatedAmount: string;
    convertedEstimatedAmount: string;
  }>;
  daily: Array<{ date: string; received: number; converted: number }>;
  confirmedInPeriod: {
    count: number;
    seller: number;
    webPrepaid: number;
    legacy: number;
    withoutDate: number;
  };
  coverage: {
    classifiedOrders: number;
    legacyUnclassifiedOrders: number;
    ordersDateBasis: "CREATED";
    withoutConfirmationDateScope: "ALL_SCOPED_CONVERTED_LEADS";
    unknownCurrencyRecords: number;
  };
}

export interface CommercialCashReportParams extends CommercialLeadReportParams {
  currency?: string;
  status?: "PAID" | "PENDING" | "LOST";
}
export interface CommercialCashReport {
  period: {
    fromDate: string;
    toDate: string;
    timeZone: "America/Lima";
    dateBasis: "PAYMENT_DATE";
  };
  scope: { storeIds: string[]; includeUnassignedStore: boolean };
  totalsByCurrency: Array<{
    currency: string | null;
    paymentCount: number;
    paidCount: number;
    pendingCount: number;
    lostCount: number;
    paidAmount: string;
    pendingAmount: string;
    lostAmount: string;
    withoutOrderCount: number;
    withoutOrderPaidAmount: string;
    leadPaymentCount: number;
  }>;
  dailyByCurrency: Array<{
    date: string;
    currency: string | null;
    paymentCount: number;
    paidAmount: string;
    pendingAmount: string;
    lostAmount: string;
  }>;
  coverage: {
    paymentCount: number;
    withoutOrderCount: number;
    unknownCurrencyCount: number;
  };
}
