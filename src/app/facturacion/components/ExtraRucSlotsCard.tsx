"use client";

import { CreditCard } from "lucide-react";
import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCancelExtraRuc } from "@/features/sunat/extra-ruc/hooks/use-cancel-extra-ruc";
import { useExtraRucSummary } from "@/features/sunat/extra-ruc/hooks/use-extra-ruc-summary";
import type { ExtraRucPurchase } from "@/features/sunat/extra-ruc/models/extra-ruc";
import { formatSoles } from "@/features/sunat/extra-ruc/utils/ruc-slots";

function formatDay(value: string | null): string {
  if (!value) {
    return "—";
  }

  const [year, month, day] = value.split("-");

  return `${day}/${month}/${year}`;
}

/**
 * Cupos de RUC extra que la empresa paga (S/ 30/mes cada uno, siempre mensual). Aquí se da de baja un cupo: deja
 * de cobrarse y vale hasta el final del período ya pagado. No aparece si la empresa no tiene ninguno.
 */
export function ExtraRucSlotsCard() {
  const { data: summary } = useExtraRucSummary();
  const cancel = useCancelExtraRuc();
  const [toCancel, setToCancel] = useState<ExtraRucPurchase | null>(null);

  const paid = (summary?.purchases ?? []).filter((purchase) => purchase.status === "PAID");

  if (!summary || paid.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <CreditCard className="h-4 w-4" />
          Cupos de RUC extra
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          1 RUC está incluido en tu plan. Cada RUC extra cuesta S/{" "}
          {formatSoles(summary.pricePerRuc)}
          /mes. Ahora pagas <b>S/ {formatSoles(summary.monthlyExtraTotal)}/mes</b> por{" "}
          {summary.renewingRucs} RUC extra.
        </p>
      </CardHeader>

      <CardContent className="space-y-2">
        {paid.map((purchase) => (
          <div
            key={purchase.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm"
          >
            <div>
              <div className="font-semibold">{purchase.razonSocial}</div>
              <div className="text-xs text-muted-foreground">
                RUC {purchase.ruc} · pagado hasta {formatDay(purchase.activeUntil)}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {purchase.renewing ? (
                <Badge variant="secondary">Se renueva cada mes</Badge>
              ) : (
                <Badge variant="outline">Dado de baja</Badge>
              )}

              {purchase.renewing && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={cancel.isPending}
                  onClick={() => setToCancel(purchase)}
                >
                  Dar de baja
                </Button>
              )}
            </div>
          </div>
        ))}
      </CardContent>

      <AlertDialog open={toCancel !== null} onOpenChange={(open) => !open && setToCancel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Dar de baja este RUC extra?</AlertDialogTitle>
            <AlertDialogDescription>
              Dejará de cobrarse cada mes. Sigues pudiendo usar el RUC hasta el{" "}
              {formatDay(toCancel?.activeUntil ?? null)}, que es hasta donde ya pagaste. Después, si
              ese RUC está activo, tendrás que desactivarlo o volver a pagar el cupo.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel>Mantener</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (toCancel) {
                  cancel.mutate(toCancel.id);
                }
                setToCancel(null);
              }}
            >
              Dar de baja
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
