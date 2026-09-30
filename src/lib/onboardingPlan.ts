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

/** Plan anual de ms-subscription: "<nombre> Anual". */
export function isAnnualPlanName(name: string): boolean {
  return /\banual$/i.test(name.trim());
}

/** Nombre sin el sufijo " Anual" ("Basic Anual" → "Basic"). */
export function basePlanName(name: string): string {
  return name.trim().replace(/\s+anual$/i, "");
}

/** Enterprise no se contrata online: va a ventas. */
export function isEnterprisePlan(name: string): boolean {
  return /enterprise/i.test(name);
}

interface CatalogPlan {
  name: string;
  price: number;
}

/** Planes del ciclo elegido, del más barato al más caro, con Enterprise al final. */
export function plansForCycle<T extends CatalogPlan>(plans: T[], isAnnual: boolean): T[] {
  return plans
    .filter((p) => isAnnualPlanName(p.name) === isAnnual)
    .sort(
      (a, b) =>
        Number(isEnterprisePlan(a.name)) - Number(isEnterprisePlan(b.name)) || a.price - b.price,
    );
}

/** El mismo plan en el otro ciclo (Basic ↔ Basic Anual), si existe. */
export function counterpartPlan<T extends CatalogPlan>(
  plans: T[],
  name: string,
  toAnnual: boolean,
): T | undefined {
  const base = basePlanName(name).toLowerCase();
  return plans.find(
    (p) => isAnnualPlanName(p.name) === toAnnual && basePlanName(p.name).toLowerCase() === base,
  );
}
