import { API_SERVICES, type ApiService, type EnvironmentProfile } from "./profile";

/** The `NEXT_PUBLIC_*` variable the frontend reads for each API (see `src/lib/api.ts`). */
export const NEXT_PUBLIC_API_VARS = {
  productos: "NEXT_PUBLIC_API_PRODUCTOS",
  companies: "NEXT_PUBLIC_API_COMPANY",
  ventas: "NEXT_PUBLIC_API_VENTAS",
  courier: "NEXT_PUBLIC_API_COURIER",
  inventory: "NEXT_PUBLIC_API_INVENTORY",
  users: "NEXT_PUBLIC_API_USERS",
  subs: "NEXT_PUBLIC_API_SUBS",
  integrations: "NEXT_PUBLIC_API_INTEGRATIONS",
  sunat: "NEXT_PUBLIC_API_SUNAT",
} as const satisfies Record<ApiService, string>;

/**
 * Env for the `next dev` process the suite starts. Process env beats `.env.local`, so these
 * values decide where the app points regardless of what a developer has in their local file.
 * Anything not listed here (Mercado Pago key, landing URL...) still comes from `.env.local`.
 */
export function toNextPublicEnv(
  profile: EnvironmentProfile,
  frontendUrl: string,
): Record<string, string> {
  const apiVars = API_SERVICES.map(
    (service) => [NEXT_PUBLIC_API_VARS[service], profile.apis[service]] as const,
  );

  return { ...Object.fromEntries(apiVars), NEXT_PUBLIC_FRONTEND_URL: frontendUrl };
}
