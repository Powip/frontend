export type ApplicationDecisionAction = "approve" | "reject";

export interface ApprovedApplication {
  applicationId: string;
  partnerId: string;
  partnerStatus: string;
  code: string;
}

export interface RejectedApplication {
  applicationId: string;
  status: string;
}
