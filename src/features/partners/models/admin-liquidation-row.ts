export interface AdminLiquidationRow {
  id: string;
  partnerName: string;
  firstMonthAmount: number;
  recurringAmount: number;
  totalAmount: number;
  paid: boolean;
}

export interface AdminClawback {
  id: string;
  partnerName: string;
  note: string;
  amount: number;
}

export interface AdminThresholdQueueItem {
  id: string;
  partnerName: string;
  amount: number;
  threshold: number;
}
