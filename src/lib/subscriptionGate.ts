/**
 * Bloqueo "sin pago no se entra" (FEAT-11).
 *
 * Aplica SOLO a usuarios sin empresa: los dueños y el personal existentes tienen
 * empresa (o companyId en el JWT) y no se ven afectados; el personal operativo no
 * tiene suscripción propia y usa la de su empresa. Esto es lo que rompía el intento
 * anterior de develop (hasSubscription forzado a true).
 *
 * - Sin empresa y sin plan vigente → solo /sin-plan (elegir plan) y /onboarding (pagar).
 * - Sin empresa y con plan vigente → solo /new-company.
 */
export const PAYWALL_ROUTE = "/sin-plan";
export const CREATE_COMPANY_ROUTE = "/new-company";
const ONBOARDING_ROUTE = "/onboarding";

const PLAN_STATUSES = new Set(["ACTIVE", "PENDING_RENEWAL"]);

export interface GateInput {
  pathname: string;
  isSuperadmin: boolean;
  hasCompany: boolean;
  subscriptionStatus: string | null | undefined;
}

const startsWith = (pathname: string, route: string) => pathname === route || pathname.startsWith(`${route}/`);

export function hasActivePlan(status: string | null | undefined): boolean {
  return !!status && PLAN_STATUSES.has(status);
}

/** Ruta a la que hay que mandar al usuario autenticado, o null si puede quedarse. */
export function resolveSubscriptionRedirect({
  pathname,
  isSuperadmin,
  hasCompany,
  subscriptionStatus,
}: GateInput): string | null {
  if (isSuperadmin || hasCompany) return null;

  if (hasActivePlan(subscriptionStatus)) {
    return startsWith(pathname, CREATE_COMPANY_ROUTE) ? null : CREATE_COMPANY_ROUTE;
  }
  if (startsWith(pathname, PAYWALL_ROUTE) || startsWith(pathname, ONBOARDING_ROUTE)) return null;
  return PAYWALL_ROUTE;
}

/** Destino tras el login según empresa/plan (mismo criterio que el guard). */
export function postLoginRoute(hasCompany: boolean, subscriptionStatus: string | null | undefined): string {
  if (hasCompany) return "/";
  return hasActivePlan(subscriptionStatus) ? CREATE_COMPANY_ROUTE : PAYWALL_ROUTE;
}
