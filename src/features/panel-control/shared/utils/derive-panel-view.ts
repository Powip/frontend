import { PANEL_ROLE_POLICIES, resolveAllowedTab } from "../config/panel-roles.config";
import { getDefaultSubtab, getTabDefinition, isSubtabOf } from "../config/panel-tabs.config";
import type { PanelDimensionFilters } from "../models/panel-filters.model";
import type {
  PanelSubtabDefinition,
  PanelSubtabId,
  PanelTabId,
} from "../models/panel-navigation.model";
import type { PanelPeriod } from "../models/panel-period.model";
import type { PanelQuery } from "../models/panel-query.model";
import type { PanelCapability, PanelRole } from "../models/panel-role.model";
import type { PanelSession } from "../models/panel-session.model";
import type { PanelUiState } from "../state/panel-state.model";
import { buildPanelQuery } from "./panel-query";
import { resolvePeriod } from "./period";

export interface PanelViewReady {
  access: "permitido";
  actualRole: PanelRole;
  role: PanelRole;
  isPreviewing: boolean;
  capabilities: ReadonlySet<PanelCapability>;
  actualCapabilities: ReadonlySet<PanelCapability>;
  tabs: PanelTabId[];
  tab: PanelTabId;
  subtabs: PanelSubtabDefinition[];
  subtab: PanelSubtabId | null;
  asesorFijo: string | null;
  requiereAsesorPreview: boolean;
  filters: PanelDimensionFilters;
  period: PanelPeriod;
  query: PanelQuery;
}

export interface PanelViewBlocked {
  access: "sin_rol";
  motivo: string;
  rolJwt: string | null;
}

export type PanelView = PanelViewReady | PanelViewBlocked;

export function derivePanelView(
  state: PanelUiState,
  session: PanelSession,
  now: number,
): PanelView {
  if (session.rol.status === "sin_resolver") {
    return { access: "sin_rol", motivo: session.rol.motivo, rolJwt: session.rol.rolJwt };
  }

  const actualRole = session.rol.role;
  const canPreview = PANEL_ROLE_POLICIES[actualRole].capacidades.includes("ver_como");
  const role = canPreview && state.preview.role ? state.preview.role : actualRole;
  const isPreviewing = role !== actualRole;
  const policy = PANEL_ROLE_POLICIES[role];
  const capabilities = new Set<PanelCapability>(policy.capacidades);

  let asesorFijo: string | null = null;
  if (policy.asesorFijo) {
    asesorFijo = isPreviewing ? state.preview.asesorId : session.userId;
  }

  const filters: PanelDimensionFilters = {
    ...state.filters,
    asesorId: policy.asesorFijo
      ? asesorFijo
      : capabilities.has("elegir_asesor")
        ? state.filters.asesorId
        : null,
  };

  const tab = resolveAllowedTab(role, state.navigation.tab);
  const subtabs = getTabDefinition(tab).subtabs.filter(
    (definition) => !definition.capability || capabilities.has(definition.capability),
  );
  const requested = state.navigation.subtab;
  const subtab =
    isSubtabOf(tab, requested) && subtabs.some((definition) => definition.id === requested)
      ? requested
      : (subtabs[0]?.id ?? getDefaultSubtab(tab));

  const period = resolvePeriod(state.filters.periodo, now);

  return {
    access: "permitido",
    actualRole,
    role,
    isPreviewing,
    capabilities,
    actualCapabilities: new Set<PanelCapability>(PANEL_ROLE_POLICIES[actualRole].capacidades),
    tabs: policy.pestanas,
    tab,
    subtabs,
    subtab,
    asesorFijo,
    requiereAsesorPreview: policy.asesorFijo && isPreviewing && !asesorFijo,
    filters,
    period,
    query: buildPanelQuery(filters, period, isPreviewing ? role : null),
  };
}
