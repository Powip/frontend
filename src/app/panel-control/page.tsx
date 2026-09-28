import { Suspense } from "react";
import { PanelSkeleton } from "@/components/panel-control/PanelStates";
import { PanelControlScreen } from "./_components/PanelControlScreen";

export default function PanelControlPage() {
  return (
    <Suspense
      fallback={
        <div className="p-6">
          <PanelSkeleton variant="kpis" label="panel de control" />
        </div>
      }
    >
      <PanelControlScreen />
    </Suspense>
  );
}
