import { ADMIN_PARTNERS_MOCK } from "./admin-partners.mock";
import type { AdminPartner } from "../models/admin-partner";

let partners: AdminPartner[] = [...ADMIN_PARTNERS_MOCK];

export function listAdminPartners(): AdminPartner[] {
  return partners;
}

export function getAdminPartnerById(id: string): AdminPartner | undefined {
  return partners.find((partner) => partner.id === id);
}

export function addAdminPartner(partner: AdminPartner): void {
  partners = [...partners, partner];
}

export function updateAdminPartner(id: string, update: Partial<AdminPartner>): AdminPartner | undefined {
  let updated: AdminPartner | undefined;
  partners = partners.map((partner) => {
    if (partner.id !== id) return partner;
    updated = { ...partner, ...update };
    return updated;
  });
  return updated;
}

export function resetAdminPartnersStore(): void {
  partners = [...ADMIN_PARTNERS_MOCK];
}
