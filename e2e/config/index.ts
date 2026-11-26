import { type E2EEnv, parseEnv } from "./env";
import { resolveFrontendUrl } from "./environment-guard";
import { type EnvironmentProfile, getProfile } from "./environments";
import { loadE2EEnvFile } from "./load-env-file";

export interface E2EConfig {
  readonly env: E2EEnv;
  readonly profile: EnvironmentProfile;
  /** Origin of the frontend under test (override applied and checked against the profile). */
  readonly frontendUrl: string;
}

/** Pure: builds the config from a raw env. Throws `E2EConfigError` / `EnvironmentGuardError`. */
export function buildE2EConfig(raw: NodeJS.ProcessEnv): E2EConfig {
  const env = parseEnv(raw);
  const profile = getProfile(env.E2E_PROFILE);

  return { env, profile, frontendUrl: resolveFrontendUrl(env, profile) };
}

let cached: E2EConfig | undefined;

/** Loads `.env.e2e`, validates it once and shares the result with the whole run. */
export function getE2EConfig(): E2EConfig {
  if (!cached) {
    loadE2EEnvFile();
    cached = buildE2EConfig(process.env);
  }

  return cached;
}

export * from "./environment-guard";
export * from "./errors";
export { TAGS, resolveGrepInvert } from "./tags";
export type { E2EEnv };
