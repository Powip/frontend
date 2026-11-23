"use client";

import { AlertTriangle, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ExtraRucSummary } from "@/features/sunat/extra-ruc/models/extra-ruc";
import { countActiveIssuers, formatSoles } from "@/features/sunat/extra-ruc/utils/ruc-slots";
import type { SunatProfile } from "@/features/sunat/sunat-profile/models/sunat-profile";

interface InactiveIssuersAlertProps {
  profiles: SunatProfile[];
  /** Precio mensual de cada RUC extra. */
  pricePerRuc: number;
  /** Cupos de la empresa. Sin resumen (p. ej. no es administrador) no se muestra el aviso de exceso. */
  summary?: ExtraRucSummary;
  onManage: () => void;
  /** Abre el pago del cupo de ese RUC (AddIssuerFlow). Al confirmarse el pago, el RUC queda activo. */
  onPay: (profile: SunatProfile) => void;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/** RUC con un cupo extra pagado y vigente (no se cobra de nuevo ni se cuenta como exceso). */
function paidRucs(summary: ExtraRucSummary): Set<string> {
  const today = todayIso();

  return new Set(
    summary.purchases
      .filter(
        (purchase) =>
          purchase.status === "PAID" &&
          purchase.activeUntil !== null &&
          purchase.activeUntil >= today,
      )
      .map((purchase) => purchase.ruc),
  );
}

/**
 * RUC activos que superan los cupos pagados. Es el mismo orden que usa ms-sunat para apagarlos: primero los
 * que no tienen cupo propio, y entre ellos el más nuevo. El RUC principal nunca entra.
 */
export function getOverLimitProfiles(
  profiles: SunatProfile[],
  summary: ExtraRucSummary | undefined,
): SunatProfile[] {
  if (!summary || summary.unlimited) {
    return [];
  }

  const excess = countActiveIssuers(profiles) - Math.max(1, summary.maxRucs);

  if (excess <= 0) {
    return [];
  }

  const paid = paidRucs(summary);

  return profiles
    .filter((profile) => profile.isActive && !profile.isDefault)
    .sort((a, b) => {
      const paidDiff = Number(paid.has(a.ruc)) - Number(paid.has(b.ruc));

      if (paidDiff !== 0) {
        return paidDiff;
      }

      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    })
    .slice(0, excess);
}

/**
 * Avisos de RUC sin cupo pagado:
 * - los que el sistema desactivó por falta de pago (UNPAID), con botón para pagar y reactivar;
 * - los activos que superan los cupos pagados (se desactivarán si no se paga);
 * - los que desactivó el usuario (cada RUC extra activo cuesta S/ 30/mes: se activan solo los que se usen).
 */
export function InactiveIssuersAlert({
  profiles,
  pricePerRuc,
  summary,
  onManage,
  onPay,
}: InactiveIssuersAlertProps) {
  const inactive = profiles.filter((profile) => !profile.isActive);
  const unpaid = inactive.filter((profile) => profile.deactivationReason === "UNPAID");
  const otherInactive = inactive.filter((profile) => profile.deactivationReason !== "UNPAID");
  const overLimit = getOverLimitProfiles(profiles, summary);

  if (inactive.length === 0 && overLimit.length === 0) {
    return null;
  }

  const price = formatSoles(pricePerRuc);

  return (
    <div className="space-y-2">
      {unpaid.length > 0 && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm dark:border-red-900 dark:bg-red-950/40"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />

          <div className="flex-1 space-y-2">
            <div>
              <span className="font-semibold">
                Desactivamos {unpaid.length} RUC por falta de pago.{" "}
              </span>
              Su cupo venció o no se pudo renovar. Paga el cupo (S/ {price}/mes) para volver a
              emitir con {unpaid.length === 1 ? "ese RUC" : "esos RUC"}.
            </div>

            <ul className="space-y-1">
              {unpaid.map((profile) => (
                <li key={profile.id} className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    {profile.razonSocial} · RUC {profile.ruc}
                  </span>
                  <Button size="sm" onClick={() => onPay(profile)}>
                    <CreditCard className="mr-1 h-4 w-4" />
                    Pagar y reactivar
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {overLimit.length > 0 && summary && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm dark:border-amber-900 dark:bg-amber-950/40"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />

          <div className="flex-1 space-y-2">
            <div>
              <span className="font-semibold">
                Tienes {countActiveIssuers(profiles)} RUC activos y {Math.max(1, summary.maxRucs)}{" "}
                cupo{Math.max(1, summary.maxRucs) === 1 ? "" : "s"} pagado
                {Math.max(1, summary.maxRucs) === 1 ? "" : "s"}.{" "}
              </span>
              Paga el cupo (S/ {price}/mes) o desactiva un RUC. Si no, se desactivará{" "}
              {overLimit.length === 1 ? "este RUC" : "estos RUC"}:
            </div>

            <ul className="space-y-1">
              {overLimit.map((profile) => (
                <li key={profile.id} className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    {profile.razonSocial} · RUC {profile.ruc}
                  </span>
                  <Button size="sm" onClick={() => onPay(profile)}>
                    <CreditCard className="mr-1 h-4 w-4" />
                    Pagar cupo
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {otherInactive.length > 0 && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm dark:border-amber-900 dark:bg-amber-950/40"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />

          <div className="flex-1">
            <span className="font-semibold">
              Tienes {otherInactive.length} RUC desactivado{otherInactive.length === 1 ? "" : "s"}.{" "}
            </span>
            Tu plan incluye 1 RUC; cada RUC extra cuesta S/ {price}/mes. Para seguir usando{" "}
            {otherInactive.length === 1 ? "ese RUC" : "esos RUC"} paga el cupo y actívalo. Puedes
            activar solo los que necesites y sumar los demás cuando quieras: (
            {otherInactive.map((profile) => profile.razonSocial).join(", ")})
          </div>

          <Button size="sm" variant="outline" onClick={onManage}>
            Ver Emisores (RUC)
          </Button>
        </div>
      )}
    </div>
  );
}
