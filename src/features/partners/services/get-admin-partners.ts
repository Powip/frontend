import type { AdminPartner } from "../models/admin-partner";
import { unavailablePartnersFeature } from "../utils/unavailable-partners-feature";

export async function getAdminPartners(): Promise<AdminPartner[]> {
  return unavailablePartnersFeature("Consultar el listado de partners");
}
