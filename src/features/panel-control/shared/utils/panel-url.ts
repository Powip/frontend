import { PANEL_DATA_MODES, type PanelDataMode } from "../models/data-origin.model";
import {
  COBROS_CANAL,
  type CobroCanal,
  ENTRADAS_CANAL,
  type EntradaCanal,
  PERIOD_PRESETS,
  type PeriodPreset,
  TURNOS_PANEL,
  type TurnoPanel,
  ZONAS_PANEL,
  type ZonaPanel,
} from "../models/panel-filters.model";
import {
  PANEL_TAB_IDS,
  type PanelSubtabId,
  type PanelTabId,
} from "../models/panel-navigation.model";
import { PANEL_ROLES, type PanelRole } from "../models/panel-role.model";
import { DEFAULT_PANEL_STATE, type PanelUiState } from "../state/panel-state.model";
import { isValidDayKey } from "./lima-time";

const pickFrom = <T extends string>(allowed: readonly T[], value: string | null): T | null =>
  value && (allowed as readonly string[]).includes(value) ? (value as T) : null;

export function parsePanelUrlState(params: URLSearchParams): PanelUiState {
  const preset = pickFrom<PeriodPreset>(PERIOD_PRESETS, params.get("periodo")) ?? "mes";
  const desde = params.get("desde");
  const hasta = params.get("hasta");
  const personalizado =
    preset === "personalizado" && isValidDayKey(desde) && isValidDayKey(hasta)
      ? { desde, hasta }
      : null;

  return {
    filters: {
      periodo: { preset, personalizado },
      tiendaId: params.get("tienda"),
      canalId: params.get("canal"),
      entrada: pickFrom<EntradaCanal>(ENTRADAS_CANAL, params.get("entrada")),
      cobro: pickFrom<CobroCanal>(COBROS_CANAL, params.get("cobro")),
      zona: pickFrom<ZonaPanel>(ZONAS_PANEL, params.get("zona")),
      turno: pickFrom<TurnoPanel>(TURNOS_PANEL, params.get("turno")),
      asesorId: params.get("asesor"),
    },
    navigation: {
      tab:
        pickFrom<PanelTabId>(PANEL_TAB_IDS, params.get("tab")) ??
        DEFAULT_PANEL_STATE.navigation.tab,
      subtab: (params.get("sub") as PanelSubtabId | null) ?? null,
    },
    dataMode:
      pickFrom<PanelDataMode>(PANEL_DATA_MODES, params.get("datos")) ??
      DEFAULT_PANEL_STATE.dataMode,
    preview: {
      role: pickFrom<PanelRole>(PANEL_ROLES, params.get("vercomo")),
      asesorId: params.get("vcasesor"),
    },
  };
}

export function serializePanelUrlState(state: PanelUiState): URLSearchParams {
  const params = new URLSearchParams();
  const set = (key: string, value: string | null | undefined) => {
    if (value) params.set(key, value);
  };
  set("tab", state.navigation.tab);
  set("sub", state.navigation.subtab);
  if (state.filters.periodo.preset !== "mes") set("periodo", state.filters.periodo.preset);
  if (state.filters.periodo.preset === "personalizado") {
    set("desde", state.filters.periodo.personalizado?.desde);
    set("hasta", state.filters.periodo.personalizado?.hasta);
  }
  set("tienda", state.filters.tiendaId);
  set("canal", state.filters.canalId);
  set("entrada", state.filters.entrada);
  set("cobro", state.filters.cobro);
  set("zona", state.filters.zona);
  set("turno", state.filters.turno);
  set("asesor", state.filters.asesorId);
  if (state.dataMode !== DEFAULT_PANEL_STATE.dataMode) set("datos", state.dataMode);
  set("vercomo", state.preview.role);
  set("vcasesor", state.preview.asesorId);
  return params;
}
