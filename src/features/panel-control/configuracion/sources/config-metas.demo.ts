import { obtenerUniversoDemo } from "../../shared/data/demo/demo-universe";
import { asesorForzado } from "../../shared/data/panel-identidad";
import type { PanelSource } from "../../shared/data/panel-source";
import type { MetasPanel } from "../../shared/models/goal.model";
import { metasMensualesDemo } from "./configuracion.demo";

function soloPropia(registro: Record<string, number>, asesor: string): Record<string, number> {
  return asesor in registro ? { [asesor]: registro[asesor] } : {};
}

function metasConIdentidad(metas: MetasPanel, asesor: string | null): MetasPanel {
  if (!asesor) return metas;
  return {
    ...metas,
    mensuales: {
      ...metas.mensuales,
      porVendedora: soloPropia(metas.mensuales.porVendedora, asesor),
      porConfirmadora: soloPropia(metas.mensuales.porConfirmadora, asesor),
    },
  };
}

export const configMetasDemoSource: PanelSource<"config-metas"> = {
  contractId: "config-metas",
  kind: "demo",
  descripcion:
    "Metas por defecto de la especificación §11 y metas mensuales de ejemplo (no se guardan). El contrato GET /config/metas no existe todavía",
  fetch: async (_query, context) =>
    metasConIdentidad(
      metasMensualesDemo(obtenerUniversoDemo(context.catalogo, context.now)),
      asesorForzado(context),
    ),
};
