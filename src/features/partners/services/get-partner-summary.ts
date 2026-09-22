import { PARTNER_SUMMARY_MOCK } from "../mocks/partner-summary.mock";
import type { PartnerSummary } from "../models/partner-summary";

export async function getPartnerSummary(): Promise<PartnerSummary> {
  await new Promise((resolve) => setTimeout(resolve, 300));
  return PARTNER_SUMMARY_MOCK;
}
