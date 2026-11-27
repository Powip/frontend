import type { OlvaSenderProfile } from "../models/olva-sender-profile";

/**
 * The default profile is already the default, so there is nothing to set.
 * The backend treats PUT /:id/default as idempotent, but the UI should not offer a no-op.
 */
export function canSetDefaultOlvaSenderProfile(profile: OlvaSenderProfile): boolean {
  return !profile.isDefault;
}

/**
 * The backend refuses to archive the default profile (SENDER_PROFILE_CANNOT_ARCHIVE_DEFAULT):
 * another profile has to become the default first.
 */
export function canArchiveOlvaSenderProfile(profile: OlvaSenderProfile): boolean {
  return !profile.isDefault;
}

/**
 * The first active profile of a company has to be the default: there is no other profile that
 * could be. `undefined` means the list has not loaded, so nothing is locked yet.
 */
export function isFirstOlvaSenderProfile(
  existingProfiles: readonly OlvaSenderProfile[] | undefined,
): boolean {
  return existingProfiles !== undefined && existingProfiles.length === 0;
}
