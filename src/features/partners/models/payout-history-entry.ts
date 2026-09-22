export type PayoutHistoryStatus = "programado" | "pagado";

export interface PayoutHistoryEntry {
  id: string;
  date: string;
  concept: string;
  amount: number;
  status: PayoutHistoryStatus;
}
