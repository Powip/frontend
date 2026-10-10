"use client";

import { PartnerSectionError } from "@/components/partners/partner-section-error";

export function PlanPageContent() {
  return (
    <div className="space-y-5 p-6">
      <h2 className="text-base font-semibold text-foreground">Mi plan</h2>
      <PartnerSectionError message="Mi Plan todavía no está implementado: faltan el catálogo real y las condiciones aprobadas del programa. No se muestran precios, descuentos ni comisiones de ejemplo." />
    </div>
  );
}
