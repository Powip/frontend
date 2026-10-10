"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useUpdateAdminCommissionSettings } from "@/features/partners/hooks/use-update-admin-commission-settings";
import type {
  AdminCommissionSettings,
  CommissionRuleRow,
  TierThreshold,
} from "@/features/partners/models/admin-commission-settings";

const TIER_LABELS: Record<TierThreshold["level"], string> = {
  bronce: "🥉 Bronce",
  plata: "🥈 Plata",
  oro: "🥇 Oro",
};

const PROFILE_BY_CODE: Record<CommissionRuleRow["code"], string> = {
  A: "Agencia · Dev",
  C: "Creador",
  B: "Todos",
};

interface CommissionRulesEditorProps {
  settings: AdminCommissionSettings | undefined;
  isLoading: boolean;
}

export function CommissionRulesEditor({ settings, isLoading }: CommissionRulesEditorProps) {
  const updateSettings = useUpdateAdminCommissionSettings();
  const [rules, setRules] = useState<CommissionRuleRow[]>([]);
  const [tiers, setTiers] = useState<TierThreshold[]>([]);

  useEffect(() => {
    if (!settings) return;
    setRules(settings.commissionRules);
    setTiers(settings.tierThresholds);
  }, [settings]);

  function updateRule(code: CommissionRuleRow["code"], field: "firstMonthPct" | "recurringPct", value: number) {
    setRules((prev) => prev.map((rule) => (rule.code === code ? { ...rule, [field]: value } : rule)));
  }

  function updateTier(level: TierThreshold["level"], field: "fromMrr" | "extraResidualPct", value: number) {
    setTiers((prev) => prev.map((tier) => (tier.level === level ? { ...tier, [field]: value } : tier)));
  }

  function handleSave() {
    updateSettings.mutate({
      update: { commissionRules: rules, tierThresholds: tiers },
      successMessage: "Comisiones guardadas · aplicadas a nuevos referidos",
    });
  }

  if (isLoading || !settings || rules.length === 0) {
    return (
      <Card className="rounded-2xl">
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <CardTitle>Comisiones por opción</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Opción</TableHead>
              <TableHead>Perfil</TableHead>
              <TableHead className="text-right">1er mes</TableHead>
              <TableHead className="text-right">Recurrente</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rules.map((rule) => (
              <TableRow key={rule.code}>
                <TableCell className="font-medium text-foreground">{rule.code}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{PROFILE_BY_CODE[rule.code]}</TableCell>
                <TableCell className="text-right">
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    className="ml-auto w-20 text-right"
                    value={rule.firstMonthPct}
                    onChange={(event) => updateRule(rule.code, "firstMonthPct", Number(event.target.value) || 0)}
                  />
                </TableCell>
                <TableCell className="text-right">
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    step={0.5}
                    className="ml-auto w-20 text-right"
                    value={rule.recurringPct}
                    onChange={(event) => updateRule(rule.code, "recurringPct", Number(event.target.value) || 0)}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <div>
          <h3 className="mb-2 text-sm font-semibold text-foreground">Tramos por nivel (residual extra)</h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nivel</TableHead>
                <TableHead>Desde MRR</TableHead>
                <TableHead className="text-right">Extra %</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tiers.map((tier) => (
                <TableRow key={tier.level}>
                  <TableCell className="font-medium text-foreground">{TIER_LABELS[tier.level]}</TableCell>
                  <TableCell>
                    {tier.level === "bronce" ? (
                      <span className="text-muted-foreground">S/ 0</span>
                    ) : (
                      <Input
                        type="number"
                        min={0}
                        className="w-28"
                        value={tier.fromMrr}
                        onChange={(event) => updateTier(tier.level, "fromMrr", Number(event.target.value) || 0)}
                      />
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {tier.level === "bronce" ? (
                      <span className="text-muted-foreground">+0%</span>
                    ) : (
                      <Input
                        type="number"
                        min={0}
                        step={0.5}
                        className="ml-auto w-20 text-right"
                        value={tier.extraResidualPct}
                        onChange={(event) =>
                          updateTier(tier.level, "extraResidualPct", Number(event.target.value) || 0)
                        }
                      />
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <Button className="w-full" onClick={handleSave} disabled={updateSettings.isPending}>
          {updateSettings.isPending ? "Guardando..." : "Guardar comisiones"}
        </Button>
      </CardContent>
    </Card>
  );
}
