import type { PanelDataMode } from "../models/data-origin.model";
import type {
  DimensionFilterKey,
  PanelDimensionFilters,
  PanelFilters,
  PanelPeriodSelection,
} from "../models/panel-filters.model";
import type { PanelNavigation, PanelSubtabId, PanelTabId } from "../models/panel-navigation.model";
import type { PanelRole } from "../models/panel-role.model";

export interface PanelPreview {
  role: PanelRole | null;
  asesorId: string | null;
}

export interface PanelUiState {
  filters: PanelFilters;
  navigation: PanelNavigation;
  dataMode: PanelDataMode;
  preview: PanelPreview;
}

export const EMPTY_DIMENSION_FILTERS: PanelDimensionFilters = {
  tiendaId: null,
  canalId: null,
  entrada: null,
  cobro: null,
  zona: null,
  turno: null,
  asesorId: null,
};

export const DEFAULT_PANEL_STATE: PanelUiState = {
  filters: {
    ...EMPTY_DIMENSION_FILTERS,
    periodo: { preset: "mes", personalizado: null },
  },
  navigation: { tab: null, subtab: null },
  dataMode: "mixto",
  preview: { role: null, asesorId: null },
};

export type PanelAction =
  | { type: "set_filter"; key: DimensionFilterKey; value: string | null }
  | { type: "clear_filters"; keep?: DimensionFilterKey[] }
  | { type: "set_period"; periodo: PanelPeriodSelection }
  | { type: "navigate"; tab: PanelTabId; subtab?: PanelSubtabId | null }
  | { type: "set_subtab"; subtab: PanelSubtabId }
  | { type: "set_data_mode"; mode: PanelDataMode }
  | { type: "set_preview_role"; role: PanelRole | null }
  | { type: "set_preview_asesor"; asesorId: string | null }
  | { type: "replace"; state: PanelUiState };
