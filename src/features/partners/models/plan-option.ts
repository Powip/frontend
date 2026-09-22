export interface PlanOption {
  value: string;
  label: string;
  monthlyPrice: number;
}

export const PARTNER_PLAN_OPTIONS: PlanOption[] = [
  { value: "basic", label: "Basic", monthlyPrice: 99 },
  { value: "standard", label: "Standard", monthlyPrice: 189 },
  { value: "full", label: "Full", monthlyPrice: 269 },
];
