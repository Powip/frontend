"use client";

import { getTabDefinition } from "@/features/panel-control/shared/config/panel-tabs.config";
import type {
  PanelSubtabId,
  PanelTabId,
} from "@/features/panel-control/shared/models/panel-navigation.model";
import { usePanel } from "@/features/panel-control/shared/state/panel-context";
import { cn } from "@/lib/utils";
import { RovingTabList } from "./RovingTabList";

export const PANEL_CONTENT_ID = "panel-control-contenido";

export function PanelTabsNav() {
  const { view, dispatch } = usePanel();
  if (view.access !== "permitido") return null;
  const items = view.tabs.map((tab) => ({ id: tab, label: getTabDefinition(tab).label }));

  return (
    <nav
      aria-label="Secciones del panel"
      className="sticky top-0 z-20 hidden border-b border-pc-border bg-pc-card sm:block"
    >
      <RovingTabList<PanelTabId>
        items={items}
        selected={view.tab}
        onSelect={(tab) => dispatch({ type: "navigate", tab })}
        ariaLabel="Secciones del panel"
        controls={PANEL_CONTENT_ID}
        idPrefix="panel-tab"
        variant="principal"
        className={cn(
          "flex gap-0.5 overflow-x-auto px-4 sm:px-5",
          view.tabs[view.tabs.length - 1] === "configuracion" && "[&>button:last-child]:ml-auto",
        )}
      />
    </nav>
  );
}

export function PanelSubtabsNav() {
  const { view, dispatch } = usePanel();
  if (view.access !== "permitido" || !view.subtabs.length || !view.subtab) return null;
  return (
    <RovingTabList<PanelSubtabId>
      items={view.subtabs.map((subtab) => ({ id: subtab.id, label: subtab.label }))}
      selected={view.subtab}
      onSelect={(subtab) => dispatch({ type: "set_subtab", subtab })}
      ariaLabel={`Subsecciones de ${getTabDefinition(view.tab).label}`}
      controls={PANEL_CONTENT_ID}
      idPrefix="panel-subtab"
      variant="secundaria"
      className="mb-4 flex flex-wrap gap-1.5"
    />
  );
}
