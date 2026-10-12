import {
  type AdminPartnerPageRequest,
  requestAdminPartnerActivity,
} from "../api/admin-partners.api";

export function getAdminPartnerActivity(request: AdminPartnerPageRequest) {
  return requestAdminPartnerActivity(request);
}
