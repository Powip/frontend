import type { PartnerProfile } from "./partner-profile";
import type { PartnerStatus } from "./partner-status.enum";

export type PartnerIdentity =
  | { kind: "partner"; profile: PartnerProfile }
  | { kind: "not_partner" }
  | { kind: "not_active"; status: PartnerStatus };
