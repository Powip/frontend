import type { OlvaSenderProfile } from "../models/olva-sender-profile";

/**
 * Olva needs the sender's first names and last name to register a shipment by RUC. Profiles
 * created before those fields existed have them null and must be completed with an update
 * before they can be used.
 */
export function isOlvaSenderProfileComplete(profile: OlvaSenderProfile): boolean {
  return Boolean(profile.firstNames?.trim()) && Boolean(profile.lastName?.trim());
}
