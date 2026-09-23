import { UNOPENED_INVITATIONS_MOCK } from "../mocks/unopened-invitations.mock";
import type { UnopenedInvitation } from "../models/unopened-invitation";

export async function getUnopenedInvitations(): Promise<UnopenedInvitation[]> {
  await new Promise((resolve) => setTimeout(resolve, 300));
  return UNOPENED_INVITATIONS_MOCK;
}
