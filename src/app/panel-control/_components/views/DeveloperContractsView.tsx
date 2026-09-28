"use client";

import { PanelCard } from "@/components/panel-control/PanelCard";
import { PANEL_CONTRACT_IDS } from "@/features/panel-control/shared/models/panel-contract.model";
import { ContractStatusTable } from "./ContractStatusTable";

export function DeveloperContractsView() {
  return (
    <PanelCard
      titulo="Contratos que necesita el frontend"
      subtitulo="Todos los endpoints reciben los mismos filtros globales y responden { actual, anterior_misma_antiguedad, metas, generado_en }. Detalle completo en docs/panel-control/README.md"
    >
      <ContractStatusTable
        contratos={[...PANEL_CONTRACT_IDS]}
        caption="Contratos del panel"
        detallado
      />
    </PanelCard>
  );
}
