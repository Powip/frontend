"use client";

import { Check } from "lucide-react";
import type { BackendPlan } from "@/types/onboarding";
import { basePlanName, isEnterprisePlan, plansForCycle } from "@/lib/onboardingPlan";
import { adaptPlans } from "@/lib/planCatalog";

interface PlanPickerProps {
  plans: BackendPlan[];
  selectedPlanId: string;
  isAnnual: boolean;
  onSelect: (plan: BackendPlan) => void;
  onCycleChange: (isAnnual: boolean) => void;
  /** Enterprise no se paga online: abre el contacto con ventas. */
  onEnterprise: () => void;
}

/** Paso 2 del onboarding (FEAT-11): elección del plan y del ciclo de pago. */
export default function PlanPicker({
  plans,
  selectedPlanId,
  isAnnual,
  onSelect,
  onCycleChange,
  onEnterprise,
}: PlanPickerProps) {
  const cyclePlans = plansForCycle(plans, isAnnual);
  const visible = adaptPlans(cyclePlans);
  const period = isAnnual ? "año" : "mes";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-bold text-xl text-gray-900">Elige tu plan</h3>
        <div className="flex rounded-lg p-1" style={{ background: "#ede9ff" }}>
          {[false, true].map((annual) => (
            <button
              key={String(annual)}
              type="button"
              onClick={() => onCycleChange(annual)}
              className="px-3 py-1 rounded-md text-xs font-semibold transition-colors"
              style={{
                background: isAnnual === annual ? "#4F3A96" : "transparent",
                color: isAnnual === annual ? "white" : "#4F3A96",
              }}
            >
              {annual ? "Anual" : "Mensual"}
            </button>
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="text-sm text-gray-500">Cargando planes...</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {visible.map((plan, i) => {
            const enterprise = isEnterprisePlan(plan.name);
            const isSelected = plan.id === selectedPlanId;
            return (
              <button
                key={plan.id}
                type="button"
                aria-pressed={isSelected}
                onClick={() => (enterprise ? onEnterprise() : onSelect(cyclePlans[i]))}
                className="relative text-left rounded-2xl border-2 p-4 transition-all duration-200 cursor-pointer"
                style={{
                  borderColor: isSelected ? "#4F3A96" : "#e5e7eb",
                  background: isSelected ? "#f5f2ff" : "white",
                  boxShadow: isSelected
                    ? "0 0 0 4px rgba(79,58,150,0.08), 0 1px 3px rgba(0,0,0,0.04)"
                    : "0 1px 3px rgba(0,0,0,0.04)",
                }}
              >
                {plan.popular && (
                  <div
                    className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap"
                    style={{ background: "#4F3A96", color: "white" }}
                  >
                    Más popular
                  </div>
                )}
                {isSelected && (
                  <div
                    className="absolute top-3 right-3 w-5 h-5 rounded-full flex items-center justify-center"
                    style={{ background: "#4F3A96" }}
                  >
                    <Check className="w-3 h-3 text-white" />
                  </div>
                )}

                <h4 className="font-bold text-gray-900 text-sm leading-tight">
                  {basePlanName(plan.name)}
                </h4>
                {plan.target && (
                  <p className="text-xs text-gray-500 mt-1 leading-relaxed">{plan.target}</p>
                )}
                <ul className="mt-2 space-y-1">
                  {plan.features.slice(0, 3).map((feature) => (
                    <li key={feature} className="flex items-start gap-1.5 text-[11px] text-gray-500">
                      <Check className="w-3 h-3 mt-0.5 shrink-0" style={{ color: "#4F3A96" }} />
                      {feature}
                    </li>
                  ))}
                </ul>
                <div className="font-bold text-sm mt-3" style={{ color: "#4F3A96" }}>
                  {enterprise ? (
                    "Contactar con ventas"
                  ) : (
                    <>
                      <span>S/ {plan.price}</span>/{period}
                    </>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
