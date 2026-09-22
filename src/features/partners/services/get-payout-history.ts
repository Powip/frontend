import { PAYOUT_HISTORY_MOCK } from "../mocks/payout-history.mock";
import type { PayoutHistoryEntry } from "../models/payout-history-entry";

export async function getPayoutHistory(): Promise<PayoutHistoryEntry[]> {
  await new Promise((resolve) => setTimeout(resolve, 300));
  return PAYOUT_HISTORY_MOCK;
}
