import { type AdminPartnerRequest, requestAdminPartner } from "../api/admin-partners.api";

export function getAdminPartner(request: AdminPartnerRequest) {
  return requestAdminPartner(request);
}
