"use client";
import { cn } from "@/lib/utils";
import { useCrmMe } from "@/hooks/useCrmMe";
import { useCrmPlan, useUpdateCrmPlan } from "@/hooks/useCrmPlan";
import type { CrmAccountType } from "@/services/crmPlanService";

const LABEL: Record<CrmAccountType, string> = { core: "Core + CRM", solo: "Solo CRM" };
const DOMAIN: Record<CrmAccountType, string> = { core: "app.powip.lat", solo: "crm.powip.lat" };

/** Etiqueta junto al logo (mockup 152): «Core + CRM» o «Solo CRM», según el plan del CRM. */
export function CrmPlanTag() {
  const plan = useCrmPlan();
  if (!plan.data) return null;
  return (
    <span
      data-testid="crm-plan-tag"
      className="whitespace-nowrap rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary"
    >
      {LABEL[plan.data.accountType]}
    </span>
  );
}

/**
 * Tipo de cuenta en la barra lateral (mockup 152, G9). Usa el mismo ajuste que
 * Ajustes › Plan y vendedoras; solo lo cambian los administradores.
 */
export function CrmAccountSwitch() {
  const plan = useCrmPlan();
  const update = useUpdateCrmPlan();
  const { isAdmin } = useCrmMe();
  if (!plan.data || !isAdmin) return null;
  const current = plan.data.accountType;
  return (
    <div data-testid="crm-account-switch" className="flex flex-col gap-1.5 border-t border-gray-200 pt-3 dark:border-gray-700">
      <span className="text-xs text-muted-foreground">Tipo de cuenta</span>
      <div role="group" aria-label="Tipo de cuenta" className="flex gap-1 rounded-lg border bg-muted p-0.5">
        {(["core", "solo"] as const).map((t) => (
          <button
            key={t}
            type="button"
            aria-pressed={current === t}
            disabled={update.isPending}
            onClick={() => current !== t && update.mutate({ accountType: t })}
            className={cn(
              "flex-1 rounded-md px-2 py-1 text-xs font-medium transition-colors",
              current === t ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {LABEL[t]}
          </button>
        ))}
      </div>
      <span className="font-mono text-[11px] text-muted-foreground">{DOMAIN[current]}</span>
    </div>
  );
}
