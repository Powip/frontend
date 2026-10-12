import { requestPendingInvitations } from "../api/admin-invitations.api";
import type { AdminPageRequest } from "../api/admin-partners.api";
import type { InvitationStateFilter } from "../schemas/admin-invitations.schema";

export async function getUnopenedInvitations(
  request: AdminPageRequest & { state?: InvitationStateFilter },
) {
  return requestPendingInvitations(request);
}
