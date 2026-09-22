import type { PayoutHistoryEntry } from "../models/payout-history-entry";

export const PAYOUT_HISTORY_MOCK: PayoutHistoryEntry[] = [
  {
    id: "payout-2026-08-25",
    date: "2026-08-25",
    concept: "1er mes + 2 recurrentes",
    amount: 95.52,
    status: "programado",
  },
  {
    id: "payout-2026-08-10",
    date: "2026-08-10",
    concept: "Anual · Distribuidora Sur",
    amount: 799.6,
    status: "pagado",
  },
  {
    id: "payout-2026-07-25",
    date: "2026-07-25",
    concept: "2 recurrentes",
    amount: 27.48,
    status: "pagado",
  },
];

export const EMPTY_PAYOUT_HISTORY: PayoutHistoryEntry[] = [];
