export type CommissionLineStatus = "activa" | "pendiente" | "reverso";

export interface CommissionLine {
  id: string;
  businessName: string;
  planName: string | null;
  netFirstMonthAmount: number | null;
  firstMonthCommission: number | null;
  recurringCommission: number | null;
  status: CommissionLineStatus;
}
