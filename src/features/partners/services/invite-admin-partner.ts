import type { AdminPartner } from "../models/admin-partner";
import type { InviteAdminPartnerFormValues } from "../schemas/invite-admin-partner.schema";
import { unavailablePartnersFeature } from "../utils/unavailable-partners-feature";

export async function inviteAdminPartner(
  input: InviteAdminPartnerFormValues,
): Promise<AdminPartner> {
  void input;
  return unavailablePartnersFeature("Enviar una invitación a partner");
}
