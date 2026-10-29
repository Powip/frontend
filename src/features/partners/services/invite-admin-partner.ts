import { requestCreateInvitation } from "../api/admin-invitations.api";
import type { AdminReadRequest } from "../api/admin-partners.api";
import {
  inviteAdminPartnerSchema,
  type InviteAdminPartnerFormValues,
} from "../schemas/invite-admin-partner.schema";

export async function inviteAdminPartner(
  input: InviteAdminPartnerFormValues,
  request: AdminReadRequest & { idempotencyKey: string },
) {
  const form = inviteAdminPartnerSchema.parse(input);
  const profile = { agencia: "AGENCY", dev: "DEVELOPER", creador: "CREATOR" } as const;
  return requestCreateInvitation({
    ...request,
    command: {
      email: form.email,
      displayName: form.name,
      country: "PE",
      profile: profile[form.profile],
    },
  });
}
