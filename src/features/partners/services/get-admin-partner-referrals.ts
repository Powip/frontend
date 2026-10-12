import {
  type AdminPartnerPageRequest,
  requestAdminPartnerReferrals,
} from "../api/admin-partners.api";

export function getAdminPartnerReferrals(request: AdminPartnerPageRequest) {
  return requestAdminPartnerReferrals(request);
}
