import type { E2EEnv } from "./env";
import { type EnvironmentProfile, getApiHosts } from "./environments";
import { EnvironmentGuardError } from "./errors";

/** Origin and path only: query strings can carry tokens and must not reach error messages. */
function describeUrl(url: string): string {
  try {
    const { origin, pathname } = new URL(url);

    return `${origin}${pathname}`;
  } catch {
    return "<invalid url>";
  }
}

/** Whether `url` points at one of the APIs of the profile (same host and port). */
export function isAllowedApiUrl(url: string, profile: EnvironmentProfile): boolean {
  try {
    return getApiHosts(profile).includes(new URL(url).host);
  } catch {
    return false;
  }
}

export function assertAllowedApiUrl(url: string, profile: EnvironmentProfile): void {
  if (isAllowedApiUrl(url, profile)) return;

  throw new EnvironmentGuardError(
    `Refusing to call ${describeUrl(url)}: its host is not an API of the "${profile.name}" profile.`,
  );
}

/** The frontend origin to open: the override when given, else the profile's. */
export function resolveFrontendUrl(
  env: Pick<E2EEnv, "E2E_BASE_URL">,
  profile: EnvironmentProfile,
): string {
  const candidate = env.E2E_BASE_URL ?? profile.frontendUrl;
  const { host, origin } = new URL(candidate);

  if (!profile.allowedFrontendHosts.includes(host)) {
    throw new EnvironmentGuardError(
      `E2E_BASE_URL host "${host}" is not allowed by the "${profile.name}" profile ` +
        `(allowed: ${profile.allowedFrontendHosts.join(", ")}).`,
    );
  }

  return origin;
}

/** Tenant lock: call with the company of the logged-in user before the first write. */
export function assertTenant(actualCompanyId: string | null | undefined, expected: string): void {
  if (actualCompanyId === expected) return;

  throw new EnvironmentGuardError(
    `Tenant lock: the logged-in company is "${actualCompanyId ?? "none"}" but E2E_COMPANY_ID is ` +
      `"${expected}". Aborting before any write.`,
  );
}

/** Gate for anything that registers a real shipment in Olva. */
export function assertRealShipmentsAllowed(env: Pick<E2EEnv, "E2E_ALLOW_REAL_SHIPMENTS">): void {
  if (env.E2E_ALLOW_REAL_SHIPMENTS) return;

  throw new EnvironmentGuardError(
    "This would register a real shipment in Olva. Set E2E_ALLOW_REAL_SHIPMENTS=true to allow it.",
  );
}
