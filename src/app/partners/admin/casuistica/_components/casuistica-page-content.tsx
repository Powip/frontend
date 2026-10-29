"use client";

import { PartnerSectionError } from "@/components/partners/partner-section-error";

export function CasuisticaPageContent() {
  return (
    <div className="space-y-4 p-6">
      <h2 className="text-base font-semibold text-foreground">Casuística del programa</h2>
      <PartnerSectionError message="La casuística todavía no está implementada: sus reglas requieren confirmación del programa. No se presentan reglas de ejemplo como decisiones aprobadas." />
    </div>
  );
}
