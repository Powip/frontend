import { PARTNER_LINK_MOCK } from "../mocks/partner-link.mock";
import type { PartnerLink } from "../models/partner-link";

export async function getPartnerLink(): Promise<PartnerLink> {
  await new Promise((resolve) => setTimeout(resolve, 300));
  return PARTNER_LINK_MOCK;
}
