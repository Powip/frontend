import type { AdminInvitation } from "../schemas/admin-invitations.schema";
// Historical name: pending acceptance does not imply an unopened email.
export type UnopenedInvitation = AdminInvitation;
