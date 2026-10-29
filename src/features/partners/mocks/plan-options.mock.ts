import type { PlanOption } from "../models/plan-option";

// Test fixtures only; the production portal has no confirmed catalog yet.
export const PARTNER_PLAN_OPTIONS_MOCK: PlanOption[] = [
  { value: "basic", label: "Basic", monthlyPrice: 99 },
  { value: "standard", label: "Standard", monthlyPrice: 189 },
  { value: "full", label: "Full", monthlyPrice: 269 },
];
