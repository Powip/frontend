/** Every backend the frontend talks to, keyed by what it is, not by its env var name. */
export const API_SERVICES = [
  "productos",
  "companies",
  "ventas",
  "courier",
  "inventory",
  "users",
  "subs",
  "integrations",
  "sunat",
] as const;

export type ApiService = (typeof API_SERVICES)[number];

/**
 * Where the suite points and what it is allowed to touch. A profile is data: moving to another
 * environment means adding a file, not changing specs or fixtures.
 */
export interface EnvironmentProfile {
  readonly name: string;
  /** Frontend the browser opens. */
  readonly frontendUrl: string;
  /** Hosts (with port) an `E2E_BASE_URL` override may point to. */
  readonly allowedFrontendHosts: readonly string[];
  /** Base URL of each API, exactly as `NEXT_PUBLIC_API_*` expects it. */
  readonly apis: Readonly<Record<ApiService, string>>;
  /** True when the suite starts the frontend from the local checkout itself. */
  readonly startFrontend: boolean;
}

/** Unique `host[:port]` of every API in the profile: the only hosts the suite may call. */
export function getApiHosts(profile: EnvironmentProfile): readonly string[] {
  return [...new Set(API_SERVICES.map((service) => new URL(profile.apis[service]).host))];
}
