"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatSoles } from "@/features/sunat/extra-ruc/utils/ruc-slots";
import type { SunatProfile } from "@/features/sunat/sunat-profile/models/sunat-profile";

interface InactiveIssuersAlertProps {
  profiles: SunatProfile[];
  /** Precio mensual de cada RUC extra. */
  pricePerRuc: number;
  onManage: () => void;
}

/**
 * Aviso para las empresas que tienen RUC desactivados (p. ej. los extra que ya tenían antes de que los RUC extra
 * se pagaran). Cada RUC activo extra cuesta S/ 30/mes: se activan solo los que se quieran usar.
 */
export function InactiveIssuersAlert({
  profiles,
  pricePerRuc,
  onManage,
}: InactiveIssuersAlertProps) {
  const inactive = profiles.filter((profile) => !profile.isActive);

  if (inactive.length === 0) {
    return null;
  }

  const price = formatSoles(pricePerRuc);

  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm dark:border-amber-900 dark:bg-amber-950/40"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />

      <div className="flex-1">
        <span className="font-semibold">
          Tienes {inactive.length} RUC desactivado{inactive.length === 1 ? "" : "s"}.{" "}
        </span>
        Tu plan incluye 1 RUC; cada RUC extra cuesta S/ {price}/mes. Para seguir usando{" "}
        {inactive.length === 1 ? "ese RUC" : "esos RUC"} paga el cupo y actívalo. Puedes activar
        solo los que necesites y sumar los demás cuando quieras: (
        {inactive.map((profile) => profile.razonSocial).join(", ")})
      </div>

      <Button size="sm" variant="outline" onClick={onManage}>
        Ver Emisores (RUC)
      </Button>
    </div>
  );
}
