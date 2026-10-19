"use client";

import { ArrowRight, Check } from "lucide-react";
import { formatLimaDate } from "@/lib/flowMigration";

/**
 * Éxito de la migración a Flow (FEAT-25). Con firstChargeDate quedó programada (hoy no se cobró);
 * sin ella, se cobró en el momento y el plan ya está activo. Siempre vuelve a Powip, nunca a
 * configurar la empresa: es un cliente que ya la tiene.
 */
export default function MigrationScheduledSuccess({
  firstChargeDate,
  onGoToDashboard,
}: {
  firstChargeDate: string | null;
  onGoToDashboard: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-4 pt-2 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full" style={{ background: "#dcfce7" }}>
        <Check className="h-8 w-8" style={{ color: "#16a34a" }} aria-hidden="true" />
      </div>
      <div>
        <h3 className="text-xl font-bold text-gray-900">¡Listo, ya estás en Flow!</h3>
        <p className="mt-1 text-sm text-gray-500">
          {firstChargeDate
            ? `Tu primer cobro es el ${formatLimaDate(firstChargeDate)}. Hasta entonces sigues con tu plan actual.`
            : "Tu plan está activo."}
        </p>
      </div>
      <button
        type="button"
        onClick={onGoToDashboard}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#4F3A96] px-5 py-3 text-sm font-semibold text-white"
      >
        Ir a Powip
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}
