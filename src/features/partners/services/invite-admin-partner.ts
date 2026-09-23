import { addAdminPartner } from "../mocks/admin-partners.store";
import type { AdminPartner } from "../models/admin-partner";
import type { InviteAdminPartnerFormValues } from "../schemas/invite-admin-partner.schema";

export async function inviteAdminPartner(input: InviteAdminPartnerFormValues): Promise<AdminPartner> {
  await new Promise((resolve) => setTimeout(resolve, 300));

  const partner: AdminPartner = {
    id: `partner-${Date.now()}`,
    name: input.name,
    handle: null,
    code: null,
    profile: input.profile,
    commissionOptionCode: null,
    status: "por_aprobar",
    tierLevel: "bronce",
    joinedAt: null,
    payoutMethodLabel: null,
    referralsCount: 0,
    activeReferralsCount: 0,
    mrr: 0,
    ticketPromedio: 0,
    conversionPct: 0,
    ltvEstimado: 0,
    recurringCommissionMonthly: 0,
  };

  addAdminPartner(partner);

  return partner;
}
