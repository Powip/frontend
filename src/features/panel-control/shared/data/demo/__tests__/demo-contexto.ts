import type { DetalleGrupo } from "../../../../detalle/models/detalle.model";
import { detalleDemoSource } from "../../../../detalle/sources/detalle.demo";
import { PANEL_ROLE_POLICIES } from "../../../config/panel-roles.config";
import type { PanelCatalogo } from "../../../models/panel-catalog.model";
import type { PanelQuery } from "../../../models/panel-query.model";
import type { PanelCapability, PanelRole } from "../../../models/panel-role.model";
import type { PanelSourceContext } from "../../panel-source";

jest.setTimeout(30_000);

export const NOW = new Date("2026-09-21T21:00:00Z").getTime();

export const CATALOGO: PanelCatalogo = {
  listo: true,
  tiendas: [
    { id: "t1", nombre: "Tienda 1" },
    { id: "t2", nombre: "Tienda 2" },
  ],
  canales: [],
  asesores: [
    { id: "a1", nombre: "Asesora 1" },
    { id: "a2", nombre: "Asesora 2" },
    { id: "a3", nombre: "Asesora 3" },
  ],
};

export const MES: PanelQuery = {
  desde: "2026-09-01",
  hasta: "2026-09-21",
  anterior_desde: "2026-08-01",
  anterior_hasta: "2026-08-21",
  zona_horaria: "America/Lima",
};

export const AYER: PanelQuery = {
  desde: "2026-09-20",
  hasta: "2026-09-20",
  anterior_desde: "2026-09-13",
  anterior_hasta: "2026-09-13",
  zona_horaria: "America/Lima",
};

export function contexto(
  role: PanelRole = "dueno",
  asesorAutorizado: string | null = null,
): PanelSourceContext {
  return {
    role,
    capabilities: new Set<PanelCapability>(PANEL_ROLE_POLICIES[role].capacidades),
    now: NOW,
    catalogo: CATALOGO,
    asesorAutorizado,
  };
}

export async function abrirGrupo(
  grupo: DetalleGrupo,
  query: PanelQuery = MES,
  context: PanelSourceContext = contexto(),
) {
  return detalleDemoSource.fetch(
    {
      ...query,
      grupo: grupo.tipo,
      grupo_params: JSON.stringify(grupo.params),
      pagina: 1,
      tamano_pagina: 100_000,
    },
    context,
  );
}
