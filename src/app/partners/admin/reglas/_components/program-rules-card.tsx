"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useUpdateAdminCommissionSettings } from "@/features/partners/hooks/use-update-admin-commission-settings";
import type { AdminCommissionSettings } from "@/features/partners/models/admin-commission-settings";

interface ProgramRulesCardProps {
  settings: AdminCommissionSettings | undefined;
  isLoading: boolean;
}

const ATTRIBUTION_WINDOW_OPTIONS = [30, 60, 90];
const EXPIRATION_OPTIONS = [30, 60];

export function ProgramRulesCard({ settings, isLoading }: ProgramRulesCardProps) {
  const updateSettings = useUpdateAdminCommissionSettings();

  if (isLoading || !settings) {
    return (
      <Card className="rounded-2xl">
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  const { programRules } = settings;

  function updateRules(update: Partial<AdminCommissionSettings["programRules"]>) {
    updateSettings.mutate({
      update: { programRules: { ...programRules, ...update } },
      successMessage: "Regla actualizada",
    });
  }

  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <CardTitle>Reglas & correos</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-foreground">Identidad del referido</span>
          <Badge variant="secondary">Email + correo de activación</Badge>
        </div>

        <div className="flex items-center justify-between">
          <label htmlFor="auto-approve" className="text-sm text-foreground">
            Auto-aprobar link sin conflicto
          </label>
          <Switch
            id="auto-approve"
            checked={programRules.autoApproveLinkWithoutConflict}
            onCheckedChange={(checked) => updateRules({ autoApproveLinkWithoutConflict: checked })}
          />
        </div>

        <div className="flex items-center justify-between">
          <label htmlFor="block-self-referral" className="text-sm text-foreground">
            Bloquear auto-referido (email/teléfono)
          </label>
          <Switch
            id="block-self-referral"
            checked={programRules.blockSelfReferral}
            onCheckedChange={(checked) => updateRules({ blockSelfReferral: checked })}
          />
        </div>

        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-foreground">Ventana de atribución</span>
          <Select
            value={String(programRules.attributionWindowDays)}
            onValueChange={(value) => updateRules({ attributionWindowDays: Number(value) })}
          >
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ATTRIBUTION_WINDOW_OPTIONS.map((days) => (
                <SelectItem key={days} value={String(days)}>
                  {days} días
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-foreground">Expiración de invitación/código</span>
          <Select
            value={String(programRules.invitationExpirationDays)}
            onValueChange={(value) => updateRules({ invitationExpirationDays: Number(value) })}
          >
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {EXPIRATION_OPTIONS.map((days) => (
                <SelectItem key={days} value={String(days)}>
                  {days} días
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center justify-between gap-3">
          <label htmlFor="min-payout-threshold" className="text-sm text-foreground">
            Umbral mínimo de pago
          </label>
          <Input
            id="min-payout-threshold"
            type="number"
            min={0}
            className="w-28"
            defaultValue={programRules.minimumPayoutThreshold}
            onBlur={(event) => updateRules({ minimumPayoutThreshold: Number(event.target.value) || 0 })}
          />
        </div>
      </CardContent>
    </Card>
  );
}
