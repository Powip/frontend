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

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Vencido: el último día pagado ya pasó. */
export function isExpired(purchase: ExtraRucPurchase, today = todayIso()): boolean {
  return purchase.activeUntil !== null && purchase.activeUntil < today;
}

/**
 * Se puede volver a pagar un cupo dado de baja o vencido, salvo que ese RUC ya tenga otro cupo vigente que se
 * renueva (no se cobra dos veces el mismo RUC) o un cupo pagado más nuevo (el botón sale una vez por RUC).
 */
export function canRepay(
  purchase: ExtraRucPurchase,
  all: ExtraRucPurchase[],
  today = todayIso(),
): boolean {
  if (purchase.renewing && !isExpired(purchase, today)) {
    return false;
  }

  return !all.some(
    (other) =>
      other.id !== purchase.id &&
      other.ruc === purchase.ruc &&
      other.status === "PAID" &&
      ((other.renewing && !isExpired(other, today)) || other.createdAt > purchase.createdAt),
  );
}

/** Dado de baja pero aún dentro del período pagado: sigue activo hasta activeUntil y no se renueva. */
export function isPaidNotRenewing(purchase: ExtraRucPurchase, today = todayIso()): boolean {
  return !purchase.renewing && !isExpired(purchase, today);
}

interface ExtraRucSlotsCardProps {
  /** Abre el pago de un cupo nuevo para ese RUC (AddIssuerFlow). */
  onRepay?: (purchase: ExtraRucPurchase) => void;
}

function formatDay(value: string | null): string {
  if (!value) {
    return "—";
  }

  const [year, month, day] = value.split("-");

  return `${day}/${month}/${year}`;
}

/**
 * Cupos de RUC extra que la empresa paga (S/ 15/mes cada uno, siempre mensual). Aquí se da de baja un cupo: deja
 * de cobrarse y vale hasta el final del período ya pagado. Los cupos dados de baja o vencidos se pueden volver a
 * pagar. No aparece si la empresa no tiene ninguno.
 */
export function ExtraRucSlotsCard({ onRepay }: ExtraRucSlotsCardProps = {}) {
  const { data: summary } = useExtraRucSummary();
  const cancel = useCancelExtraRuc();
  const [toCancel, setToCancel] = useState<ExtraRucPurchase | null>(null);

  const paid = (summary?.purchases ?? []).filter((purchase) => purchase.status === "PAID");

  if (!summary || paid.length === 0) {
    return null;
  }

  const notRenewing = paid.filter((purchase) => isPaidNotRenewing(purchase)).length;

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
          /mes. Tienes <b>{summary.extraRucsPaid}</b> RUC extra pagado
          {summary.extraRucsPaid === 1 ? "" : "s"} y vigente{summary.extraRucsPaid === 1 ? "" : "s"}
          . Se cobra cada mes: <b>S/ {formatSoles(summary.monthlyExtraTotal)}/mes</b> (
          {summary.renewingRucs} RUC).
          {notRenewing > 0 &&
            ` ${notRenewing} no se renueva${notRenewing === 1 ? "" : "n"}: sigue${notRenewing === 1 ? "" : "n"} activo${notRenewing === 1 ? "" : "s"} hasta la fecha que se indica.`}
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
                RUC {purchase.ruc} ·{" "}
                {isExpired(purchase)
                  ? `venció el ${formatDay(purchase.activeUntil)}`
                  : purchase.renewing
                    ? `pagado hasta ${formatDay(purchase.activeUntil)}`
                    : `activo hasta ${formatDay(purchase.activeUntil)} · no se renueva`}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {isExpired(purchase) ? (
                <Badge variant="outline">Vencido</Badge>
              ) : purchase.renewing ? (
                <Badge variant="secondary">Se renueva cada mes</Badge>
              ) : (
                <Badge variant="outline">No se renueva</Badge>
              )}

              {onRepay && canRepay(purchase, paid) && (
                <Button size="sm" onClick={() => onRepay(purchase)}>
                  {isPaidNotRenewing(purchase) ? "Renovar" : "Volver a pagar"}
                </Button>
              )}

              {purchase.renewing && !isExpired(purchase) && (
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
