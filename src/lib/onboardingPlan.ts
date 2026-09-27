/**
 * Nombre del plan a contratar desde los parámetros de la landing (FEAT-11).
 * Los planes anuales de ms-subscription se llaman "<nombre> Anual"
 * (PlanCatalogSeeder): con annual=true, "Basic" pasa a "Basic Anual".
 */
export function resolveOnboardingPlanName(
  baseName: string | undefined,
  isAnnual: boolean,
): string | undefined {
  const name = baseName?.trim();
  if (!name) return undefined;
  return isAnnual && !/\banual$/i.test(name) ? `${name} Anual` : name;
}
