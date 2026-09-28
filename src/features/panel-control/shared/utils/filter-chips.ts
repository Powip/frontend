import {
  COBRO_LABEL,
  ENTRADA_CHIP_LABEL,
  FILTER_KEY_LABEL,
  TURNO_LABEL,
  ZONA_LABEL,
} from "../config/filter-labels.config";
import {
  type ActiveFilterChip,
  type CobroCanal,
  type DimensionFilterKey,
  type EntradaCanal,
  type PanelDimensionFilters,
  SIN_ASESOR,
  type TurnoPanel,
  type ZonaPanel,
} from "../models/panel-filters.model";

export interface ChipLabelResolvers {
  tienda: (id: string) => string | undefined;
  canal: (id: string) => string | undefined;
  asesor: (id: string) => string | undefined;
}

const CHIP_ORDER: DimensionFilterKey[] = [
  "tiendaId",
  "canalId",
  "entrada",
  "cobro",
  "zona",
  "turno",
  "asesorId",
];

function valueLabel(key: DimensionFilterKey, value: string, resolvers: ChipLabelResolvers): string {
  switch (key) {
    case "tiendaId":
      return resolvers.tienda(value) ?? value;
    case "canalId":
      return resolvers.canal(value) ?? value;
    case "asesorId":
      return value === SIN_ASESOR ? "Sin asesora" : (resolvers.asesor(value) ?? value);
    case "entrada":
      return ENTRADA_CHIP_LABEL[value as EntradaCanal] ?? value;
    case "cobro":
      return COBRO_LABEL[value as CobroCanal] ?? value;
    case "zona":
      return ZONA_LABEL[value as ZonaPanel] ?? value;
    case "turno":
      return TURNO_LABEL[value as TurnoPanel] ?? value;
    default:
      return value;
  }
}

export function getActiveFilterChips(
  filters: PanelDimensionFilters,
  resolvers: ChipLabelResolvers,
  bloqueados: ReadonlySet<DimensionFilterKey>,
): ActiveFilterChip[] {
  return CHIP_ORDER.filter((key) => filters[key]).map((key) => ({
    key,
    label: FILTER_KEY_LABEL[key],
    value: valueLabel(key, filters[key] as string, resolvers),
    bloqueado: bloqueados.has(key),
  }));
}

export const MORE_FILTER_KEYS: DimensionFilterKey[] = [
  "entrada",
  "cobro",
  "zona",
  "turno",
  "asesorId",
];
