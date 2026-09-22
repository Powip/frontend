import { COMMISSION_LINES_MOCK } from "../mocks/commission-lines.mock";
import type { CommissionLine } from "../models/commission-line";

export async function getCommissionLines(): Promise<CommissionLine[]> {
  await new Promise((resolve) => setTimeout(resolve, 300));
  return COMMISSION_LINES_MOCK;
}
