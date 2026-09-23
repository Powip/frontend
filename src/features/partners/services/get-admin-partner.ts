import { getAdminPartnerById } from "../mocks/admin-partners.store";
import type { AdminPartner } from "../models/admin-partner";

export async function getAdminPartner(id: string): Promise<AdminPartner | null> {
  await new Promise((resolve) => setTimeout(resolve, 300));
  return getAdminPartnerById(id) ?? null;
}
