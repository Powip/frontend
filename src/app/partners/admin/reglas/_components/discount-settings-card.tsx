"use client";

import { AlertTriangle, CheckCircle2 } from "lucide-react";
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
import { Skeleton } from "@/components/ui/skeleton";
import { useUpdateAdminCommissionSettings } from "@/features/partners/hooks/use-update-admin-commission-settings";
import { estimateFirstMonthCommission } from "@/features/partners/utils/estimate-commission-earnings";
import { formatSoles } from "@/features/partners/utils/format-currency";
import type { AdminCommissionSettings } from "@/features/partners/models/admin-commission-settings";

const REFERENCE_PLAN_PRICE = 189;

const DURATION_OPTIONS = [
  { value: "primer_mes", label: "Solo 1er mes" },
  { value: "tres_meses", label: "3 meses" },
  { value: "fijo_mensual", label: "Fijo mensual" },
] as const;

interface DiscountSettingsCardProps {
  settings: AdminCommissionSettings | undefined;
  isLoading: boolean;
}

export function DiscountSettingsCard({ settings, isLoading }: DiscountSettingsCardProps) {
  const updateSettings = useUpdateAdminCommissionSettings();

  if (isLoading || !settings) {
    return (
      <Card className="rounded-2xl">
        <CardContent>
          <Skeleton className="h-40 w-full" />
        </CardContent>
      </Card>
    );
  }

  const { discount, commissionRules } = settings;
  const optionA = commissionRules.find((rule) => rule.code === "A");
  const netReference = REFERENCE_PLAN_PRICE * (1 - discount.pct / 100);
  const commissionCost = optionA
    ? estimateFirstMonthCommission(REFERENCE_PLAN_PRICE, optionA.firstMonthPct, discount.pct)
    : 0;
  const discountCost = discount.assumedBy === "powip" ? REFERENCE_PLAN_PRICE * (discount.pct / 100) : 0;
  const totalCost = commissionCost + discountCost;
  const isUnprofitable = totalCost >= netReference;

  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <CardTitle>Descuento al negocio referido</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="discount-pct">% de descuento</Label>
          <Input
            id="discount-pct"
            type="number"
            min={0}
            max={100}
            value={discount.pct}
            onChange={(event) =>
              updateSettings.mutate({ update: { discount: { ...discount, pct: Number(event.target.value) || 0 } } })
            }
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="discount-duration">Duración</Label>
          <Select
            value={discount.duration}
            onValueChange={(value) =>
              updateSettings.mutate({
                update: { discount: { ...discount, duration: value as AdminCommissionSettings["discount"]["duration"] } },
              })
            }
          >
            <SelectTrigger id="discount-duration" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DURATION_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="discount-assumed-by">¿Quién lo asume?</Label>
          <Select
            value={discount.assumedBy}
            onValueChange={(value) =>
              updateSettings.mutate({
                update: { discount: { ...discount, assumedBy: value as AdminCommissionSettings["discount"]["assumedBy"] } },
              })
            }
          >
            <SelectTrigger id="discount-assumed-by" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="powip">Lo absorbe POWIP</SelectItem>
              <SelectItem value="partner">Sale de comisión partner</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div
          className={`flex items-start gap-2 rounded-lg px-3 py-2 text-xs ${
            isUnprofitable
              ? "bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-300"
              : "bg-green-50 text-green-800 dark:bg-green-950/40 dark:text-green-300"
          }`}
        >
          {isUnprofitable ? (
            <AlertTriangle aria-hidden="true" className="mt-0.5 h-4 w-4 flex-shrink-0" />
          ) : (
            <CheckCircle2 aria-hidden="true" className="mt-0.5 h-4 w-4 flex-shrink-0" />
          )}
          {isUnprofitable ? (
            <span>
              <b>Alerta de rentabilidad:</b> en un plan de referencia de {formatSoles(REFERENCE_PLAN_PRICE)}, la
              comisión 1er mes ({formatSoles(commissionCost)}) + descuento dejan el primer mes en negativo
              (ingreso neto {formatSoles(netReference)}). Bajá el % o que lo asuma el partner.
            </span>
          ) : (
            <span>
              OK: ingreso neto 1er mes {formatSoles(netReference)} vs costo {formatSoles(totalCost)}{" "}
              (comisión{discount.assumedBy === "powip" ? " + descuento" : ""}).
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
