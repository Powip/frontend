import type { PanelDimensionFilters } from "../models/panel-filters.model";
import type { PanelPeriod } from "../models/panel-period.model";
import type { PanelQuery } from "../models/panel-query.model";
import type { PanelRole } from "../models/panel-role.model";

export function buildPanelQuery(
  filters: PanelDimensionFilters,
  period: PanelPeriod,
  verComo: PanelRole | null,
): PanelQuery {
  const query: PanelQuery = {
    desde: period.desde,
    hasta: period.hasta,
    anterior_desde: period.anteriorDesde,
    anterior_hasta: period.anteriorHasta,
    zona_horaria: period.zonaHoraria,
  };
  if (filters.tiendaId) query.tienda = filters.tiendaId;
  if (filters.canalId) query.canal = filters.canalId;
  if (filters.entrada) query.entrada = filters.entrada;
  if (filters.cobro) query.cobro = filters.cobro;
  if (filters.zona) query.zona = filters.zona;
  if (filters.turno) query.turno = filters.turno;
  if (filters.asesorId) query.asesor = filters.asesorId;
  if (verComo) query.ver_como = verComo;
  return query;
}

export function panelQueryKey(query: PanelQuery): string {
  return Object.keys(query)
    .sort()
    .map((key) => `${key}=${String(query[key as keyof PanelQuery])}`)
    .join("&");
}
