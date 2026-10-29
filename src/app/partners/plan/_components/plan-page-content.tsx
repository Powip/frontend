"use client";

import { ProgramPreferencesCard } from "@/components/partners/program-preferences-card";

export function PlanPageContent() {
  return (
    <div className="space-y-5 p-6">
      <h2 className="text-base font-semibold text-foreground">Mi plan</h2>
      <ProgramPreferencesCard />
      <p className="text-sm text-muted-foreground">
        MRR atribuido y nivel del programa: no disponibles. No se muestran precios ni ingresos
        estimados.
      </p>
    </div>
  );
}
