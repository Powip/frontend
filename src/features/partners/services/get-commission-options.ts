import { COMMISSION_OPTIONS_MOCK } from "../mocks/commission-options.mock";
import type { CommissionOptionDetail } from "../models/commission-option-detail";

export async function getCommissionOptions(): Promise<CommissionOptionDetail[]> {
  await new Promise((resolve) => setTimeout(resolve, 300));
  return COMMISSION_OPTIONS_MOCK;
}
