import { listAdminPartners } from "../mocks/admin-partners.store";
import type { AdminPartner } from "../models/admin-partner";

export async function getAdminPartners(): Promise<AdminPartner[]> {
  await new Promise((resolve) => setTimeout(resolve, 300));
  return listAdminPartners();
}
