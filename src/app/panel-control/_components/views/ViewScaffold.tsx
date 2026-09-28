"use client";

import { Construction } from "lucide-react";
import { PanelCard } from "@/components/panel-control/PanelCard";
import { contractsForView } from "@/features/panel-control/shared/config/view-contracts.config";
import type {
  PanelSubtabId,
  PanelTabId,
} from "@/features/panel-control/shared/models/panel-navigation.model";
import { ContractStatusTable } from "./ContractStatusTable";

const ETAPA: Partial<Record<PanelTabId, string>> = {
  resumen: "Se construye en la siguiente etapa: Resumen completo.",
};

interface ViewScaffoldProps {
  tab: PanelTabId;
  subtab: PanelSubtabId | null;
}

export function ViewScaffold({ tab, subtab }: ViewScaffoldProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 rounded-xl border border-dashed border-pc-border bg-pc-surface-muted p-4">
        <Construction className="mt-0.5 size-5 shrink-0 text-pc-text-soft" aria-hidden />
        <div className="text-sm">
          <p className="font-semibold text-pc-text">Pantalla pendiente de construir</p>
          <p className="mt-0.5 text-xs text-pc-text-muted">
            {ETAPA[tab] ?? "Se construye en una etapa posterior."} La base del panel (filtros, rol,
            periodo, fuentes de datos y componentes) ya está lista; abajo están los contratos que
            usará esta vista.
          </p>
        </div>
      </div>
      <PanelCard
        titulo="Fuentes de datos de esta vista"
        subtitulo="Real = endpoint existente · Demo = datos deterministas de prueba · Pendiente = sin datos hasta que exista el contrato"
      >
        <ContractStatusTable
          contratos={contractsForView(tab, subtab)}
          caption="Fuentes de datos de esta vista"
        />
      </PanelCard>
    </div>
  );
}
