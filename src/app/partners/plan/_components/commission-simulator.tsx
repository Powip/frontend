"use client";

import { useMemo, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PARTNER_PLAN_OPTIONS } from "@/features/partners/models/plan-option";
import { estimateCommissionEarnings } from "@/features/partners/utils/estimate-commission-earnings";
import { formatSoles } from "@/features/partners/utils/format-currency";
import type { CommissionOptionDetail } from "@/features/partners/models/commission-option-detail";

interface CommissionSimulatorProps {
  options: CommissionOptionDetail[] | undefined;
  selectedCode: string;
  discountPct: number;
}

export function CommissionSimulator({ options, selectedCode, discountPct }: CommissionSimulatorProps) {
  const [referralsCount, setReferralsCount] = useState(10);
  const [planValue, setPlanValue] = useState(PARTNER_PLAN_OPTIONS[1].value);
  const [retentionMonths, setRetentionMonths] = useState(18);

  const selectedOption = options?.find((option) => option.code === selectedCode);
  const selectedPlan = PARTNER_PLAN_OPTIONS.find((plan) => plan.value === planValue);

  const estimate = useMemo(() => {
    if (!selectedOption || !selectedPlan) return null;
    return estimateCommissionEarnings({
      referralsCount,
      monthlyPlanPrice: selectedPlan.monthlyPrice,
      retentionMonths,
      firstMonthPct: selectedOption.firstMonthPct,
      recurringPct: selectedOption.recurringPct,
      discountPct,
    });
  }, [selectedOption, selectedPlan, referralsCount, retentionMonths, discountPct]);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle>Simulador de ingresos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="sim-referrals">¿Cuántos negocios referís?</Label>
            <Input
              id="sim-referrals"
              type="number"
              min={1}
              value={referralsCount}
              onChange={(event) => setReferralsCount(Math.max(1, Number(event.target.value) || 1))}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sim-plan">Plan promedio</Label>
            <Select value={planValue} onValueChange={setPlanValue}>
              <SelectTrigger id="sim-plan" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PARTNER_PLAN_OPTIONS.map((plan) => (
                  <SelectItem key={plan.value} value={plan.value}>
                    {plan.label} · {formatSoles(plan.monthlyPrice)}/mes
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sim-retention">Retención esperada (meses)</Label>
            <Input
              id="sim-retention"
              type="number"
              min={1}
              value={retentionMonths}
              onChange={(event) => setRetentionMonths(Math.max(1, Number(event.target.value) || 1))}
            />
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <div className="rounded-2xl bg-gradient-to-br from-primary to-primary/80 p-5 text-primary-foreground">
          <p className="text-xs font-medium uppercase tracking-wide opacity-85">Total proyectado (estimado)</p>
          <p className="mt-1.5 text-3xl font-extrabold">
            {estimate ? formatSoles(estimate.projectedTotal) : "—"}
          </p>
          <div className="mt-3 divide-y divide-white/15 border-t border-white/15">
            <div className="flex justify-between py-2 text-sm">
              <span className="opacity-90">Comisión 1er mes (one-time) × N</span>
              <span className="font-semibold">{estimate ? formatSoles(estimate.firstMonthTotal) : "—"}</span>
            </div>
            <div className="flex justify-between py-2 text-sm">
              <span className="opacity-90">Recurrente / mes (todos activos)</span>
              <span className="font-semibold">{estimate ? formatSoles(estimate.monthlyRecurringTotal) : "—"}</span>
            </div>
          </div>
        </div>

        <Alert variant="destructive">
          <AlertTriangle aria-hidden="true" />
          <AlertDescription>
            Esto es una <b>estimación</b> para ayudarte a proyectar, no es tu comisión real. La
            comisión real la calcula y confirma Powip cuando el referido paga.
          </AlertDescription>
        </Alert>
      </div>
    </div>
  );
}
