"use client";

import { Check } from "lucide-react";
import { basePlanName, isEnterprisePlan, plansForCycle } from "@/lib/onboardingPlan";
import { adaptPlans } from "@/lib/planCatalog";
import type { BackendPlan } from "@/types/onboarding";
import styles from "./onboarding-layout.module.css";

interface PlanPickerProps {
  plans: BackendPlan[];
  selectedPlanId: string;
  isAnnual: boolean;
  onSelect: (plan: BackendPlan) => void;
  onCycleChange: (isAnnual: boolean) => void;
  /** Enterprise no se paga online: abre el contacto con ventas. */
  onEnterprise: () => void;
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

/** Paso 2 del onboarding (FEAT-11): elección del plan y del ciclo de pago. */
export default function PlanPicker({
  plans,
  selectedPlanId,
  isAnnual,
  onSelect,
  onCycleChange,
  onEnterprise,
  isLoading = false,
  error,
  onRetry,
}: PlanPickerProps) {
  const cyclePlans = plansForCycle(plans, isAnnual);
  const visible = adaptPlans(cyclePlans);
  const period = isAnnual ? "año" : "mes";

  return (
    <div className={styles.planPicker}>
      <div className={styles.planHeader}>
        <h2 className={styles.planTitle}>Elige tu plan</h2>
        <fieldset className={styles.cycle} aria-label="Ciclo de facturación">
          {[false, true].map((annual) => (
            <button
              key={String(annual)}
              type="button"
              onClick={() => onCycleChange(annual)}
              className={styles.cycleButton}
              aria-pressed={isAnnual === annual}
            >
              {annual ? "Anual" : "Mensual"}
            </button>
          ))}
        </fieldset>
      </div>

      {error ? (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
        >
          <p>{error}</p>
          <button type="button" onClick={onRetry} className="mt-2 font-semibold underline">
            Reintentar carga de planes
          </button>
        </div>
      ) : isLoading ? (
        <p className="text-sm text-gray-500" role="status">
          Cargando planes...
        </p>
      ) : visible.length === 0 ? (
        <p className="text-sm text-gray-500" role="status">
          No hay planes disponibles para este ciclo. Prueba con {isAnnual ? "Mensual" : "Anual"}.
        </p>
      ) : (
        <div className={styles.planGrid}>
          {visible.map((plan, i) => {
            const enterprise = isEnterprisePlan(plan.name);
            const isSelected = plan.id === selectedPlanId;
            return (
              <button
                key={plan.id}
                type="button"
                aria-pressed={isSelected}
                onClick={() => (enterprise ? onEnterprise() : onSelect(cyclePlans[i]))}
                className={styles.planCard}
              >
                {plan.popular && <div className={styles.popular}>Más popular</div>}
                {isSelected && (
                  <div className={styles.selected} aria-hidden="true">
                    <Check className="w-3 h-3 text-white" />
                  </div>
                )}

                <h4 className={styles.planName}>{basePlanName(plan.name)}</h4>
                {plan.target && <p className={styles.planTarget}>{plan.target}</p>}
                <ul className={styles.planFeatures}>
                  {plan.features.slice(0, 3).map((feature) => (
                    <li key={feature} className={styles.planFeature}>
                      <Check size={13} aria-hidden="true" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <div className={styles.planPrice}>
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
