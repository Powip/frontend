export interface CommissionOptionDetail {
  code: "A" | "B" | "C";
  label: string;
  description: string;
  firstMonthPct: number;
  recurringPct: number;
}
