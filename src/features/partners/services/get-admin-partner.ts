import type { AdminPartner } from "../models/admin-partner";
import { unavailablePartnersFeature } from "../utils/unavailable-partners-feature";

export async function getAdminPartner(id: string): Promise<AdminPartner | null> {
  void id;
  return unavailablePartnersFeature("Consultar la ficha del partner");
}
