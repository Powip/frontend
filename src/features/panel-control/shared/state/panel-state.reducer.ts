import { EMPTY_DIMENSION_FILTERS, type PanelAction, type PanelUiState } from "./panel-state.model";

export function panelStateReducer(state: PanelUiState, action: PanelAction): PanelUiState {
  switch (action.type) {
    case "set_filter":
      return { ...state, filters: { ...state.filters, [action.key]: action.value || null } };
    case "clear_filters": {
      const kept = Object.fromEntries((action.keep ?? []).map((key) => [key, state.filters[key]]));
      return { ...state, filters: { ...state.filters, ...EMPTY_DIMENSION_FILTERS, ...kept } };
    }
    case "set_period":
      return { ...state, filters: { ...state.filters, periodo: action.periodo } };
    case "navigate":
      return { ...state, navigation: { tab: action.tab, subtab: action.subtab ?? null } };
    case "set_subtab":
      return { ...state, navigation: { ...state.navigation, subtab: action.subtab } };
    case "set_data_mode":
      return { ...state, dataMode: action.mode };
    case "set_preview_role":
      return {
        ...state,
        preview: { role: action.role, asesorId: action.role ? state.preview.asesorId : null },
        navigation: { tab: null, subtab: null },
      };
    case "set_preview_asesor":
      return { ...state, preview: { ...state.preview, asesorId: action.asesorId } };
    case "replace":
      return action.state;
    default:
      return state;
  }
}
