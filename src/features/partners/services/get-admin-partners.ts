import { type AdminPageRequest, requestAdminPartners } from "../api/admin-partners.api";
import type { PartnerApprovalStatus } from "../models/admin-partner";

export function getAdminPartners(
  request: AdminPageRequest & { status?: PartnerApprovalStatus | null },
) {
  return requestAdminPartners(request);
}
