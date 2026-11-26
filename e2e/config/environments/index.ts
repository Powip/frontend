import { hybrid } from "./hybrid";
import type { EnvironmentProfile } from "./profile";

/** Add a profile here (and a file next to this one) to target another environment. */
const PROFILES = { hybrid } satisfies Record<string, EnvironmentProfile>;

export type ProfileName = keyof typeof PROFILES;

export const PROFILE_NAMES = Object.keys(PROFILES) as [ProfileName, ...ProfileName[]];

export const DEFAULT_PROFILE_NAME: ProfileName = "hybrid";

export function getProfile(name: ProfileName): EnvironmentProfile {
  return PROFILES[name];
}

export { NEXT_PUBLIC_API_VARS, toNextPublicEnv } from "./next-public-env";
export { API_SERVICES, type ApiService, type EnvironmentProfile, getApiHosts } from "./profile";
