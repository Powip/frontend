"use client";

import { DetailDrawer } from "@/components/panel-control/DetailDrawer";
import { TooltipProvider } from "@/components/ui/tooltip";
import { usePanel } from "@/features/panel-control/shared/state/panel-context";
import { RoleBlockedView } from "../views/RoleBlockedView";
import { TabContent } from "../views/TabContent";
import { FilterChips } from "./FilterChips";
import { MobileBottomNav } from "./MobileBottomNav";
import { PANEL_CONTENT_ID, PanelSubtabsNav, PanelTabsNav } from "./PanelTabsNav";
import { PanelTopBar } from "./PanelTopBar";
import { PeriodStatusLine } from "./PeriodStatusLine";
import { ViewHeader } from "./ViewHeader";

export function PanelShell() {
  const { view } = usePanel();

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex min-h-full flex-col bg-pc-bg font-sans text-[13px] text-pc-text">
        <PanelTopBar />
        <FilterChips />
        {view.access === "sin_rol" ? (
          <RoleBlockedView rolJwt={view.rolJwt} motivo={view.motivo} />
        ) : (
          <>
            <PanelTabsNav />
            <main
              id={PANEL_CONTENT_ID}
              role="tabpanel"
              aria-labelledby={`panel-tab-${view.tab}`}
              tabIndex={-1}
              className="flex-1 px-4 pb-24 pt-4 outline-none sm:px-6 sm:pb-16 sm:pt-5"
            >
              {view.isPreviewing && (
                <p
                  className="mb-3 rounded-lg border border-pc-info/30 bg-pc-info-soft px-3 py-2 text-xs text-pc-info"
                  role="status"
                >
                  Estás previsualizando la vista de otro rol. Solo cambia lo que se muestra: la
                  restricción real de datos la aplica el backend.
                </p>
              )}
              <PeriodStatusLine />
              <ViewHeader tab={view.tab} />
              <PanelSubtabsNav />
              <TabContent />
            </main>
            <MobileBottomNav />
            <DetailDrawer />
          </>
        )}
      </div>
    </TooltipProvider>
  );
}
