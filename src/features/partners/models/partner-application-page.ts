import type { PartnerApplication } from "./partner-application";

export interface PartnerApplicationPage {
  items: PartnerApplication[];
  nextCursor: string | null;
}
