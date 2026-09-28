"use client";

import { usePanel } from "@/features/panel-control/shared/state/panel-context";
import { ConfigCanalesView } from "./ConfigCanalesView";
import { CallCenterView } from "./callcenter/CallCenterView";
import { ConfigCuadresView } from "./configuracion/ConfigCuadresView";
import { ConfigEstadosView } from "./configuracion/ConfigEstadosView";
import { ConfigMetasView } from "./configuracion/ConfigMetasView";
import { DeveloperContractsView } from "./DeveloperContractsView";
import { EquipoView } from "./equipo/EquipoView";
import { FinanzasView } from "./finanzas/FinanzasView";
import { MisVentasView } from "./MisVentasView";
import { OperacionesView } from "./operaciones/OperacionesView";
import { PreviewAsesorPrompt } from "./PreviewAsesorPrompt";
import { ResumenView } from "./resumen/ResumenView";
import { ViewScaffold } from "./ViewScaffold";
import { VentasCanalesView } from "./ventas/VentasCanalesView";

export function TabContent() {
  const { view } = usePanel();
  if (view.access !== "permitido") return null;
  if (view.requiereAsesorPreview) return <PreviewAsesorPrompt />;

  switch (view.tab) {
    case "resumen":
      return <ResumenView />;
    case "canales":
      return <VentasCanalesView />;
    case "callcenter":
      return <CallCenterView />;
    case "operaciones":
      return <OperacionesView />;
    case "finanzas":
      return <FinanzasView />;
    case "equipo":
      return <EquipoView />;
    case "misventas":
      return <MisVentasView />;
    case "configuracion":
      switch (view.subtab) {
        case "canales":
          return <ConfigCanalesView />;
        case "metas":
          return <ConfigMetasView />;
        case "estados":
          return <ConfigEstadosView />;
        case "cuadres":
          return <ConfigCuadresView />;
        case "desarrollo":
          return <DeveloperContractsView />;
        default:
          return <ViewScaffold tab={view.tab} subtab={view.subtab} />;
      }
    default:
      return <ViewScaffold tab={view.tab} subtab={view.subtab} />;
  }
}
