import type { UnopenedInvitation } from "../models/unopened-invitation";
import { unavailablePartnersFeature } from "../utils/unavailable-partners-feature";

export async function getUnopenedInvitations(): Promise<UnopenedInvitation[]> {
  return unavailablePartnersFeature("Consultar invitaciones");
}
