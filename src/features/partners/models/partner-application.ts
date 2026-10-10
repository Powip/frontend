export type PartnerApplicationStatus = "applied" | "approved" | "rejected" | "unknown";

export interface PartnerApplication {
  id: string;
  reference: string;
  email: string;
  displayName: string;
  country: string;
  status: PartnerApplicationStatus;
  rawStatus: string;
  appliedAt: string;
}
