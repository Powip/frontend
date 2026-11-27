/**
 * Pasos con los que arranca el onboarding (tabla public.onboarding_progress) de una
 * empresa recién dada de alta desde el CRM del superadmin. Los usa
 * POST /api/superadmin/businesses/:id/onboarding (FEAT-23 T16).
 */
export const INITIAL_ONBOARDING_STEPS = [
  "business_profile",
  "store_config",
  "inventory_init",
  "first_order",
  "integrations",
  "final_training",
] as const;
