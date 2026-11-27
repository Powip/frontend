import type { SunatProfile } from "@/features/sunat/sunat-profile/models/sunat-profile";
import type { ExtraRucSummary } from "../models/extra-ruc";

/** Precio mensual de cada RUC extra mientras no se sepa el real (el servidor manda pricePerRuc). */
export const DEFAULT_EXTRA_RUC_PRICE = 15;

/** Cuántos RUC están activos (los desactivados no gastan cupo). */
export function countActiveIssuers(profiles: SunatProfile[]): number {
  return profiles.filter((profile) => profile.isActive).length;
}

/**
 * Si la empresa puede tener un RUC activo más sin pagar. Sin resumen (p. ej. un usuario que no es
 * administrador) se devuelve null: no se sabe, y el servidor decide al crearlo.
 */
export function hasFreeRucSlot(
  summary: ExtraRucSummary | undefined,
  profiles: SunatProfile[],
): boolean | null {
  if (!summary) {
    return null;
  }

  if (summary.unlimited) {
    return true;
  }

  return countActiveIssuers(profiles) < summary.maxRucs;
}

export function formatSoles(amount: number): string {
  return Number.isInteger(amount) ? String(amount) : amount.toFixed(2);
}
