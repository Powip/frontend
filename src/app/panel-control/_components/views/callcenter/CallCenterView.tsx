"use client";

import { usePanelContract } from "@/features/panel-control/shared/hooks/use-panel-contract";
import { usePanel } from "@/features/panel-control/shared/state/panel-context";
import { OrigenCanalesNota } from "../ventas/OrigenCanalesNota";
import { CalidadLeadsCard, ColaLeadsCard, MotivosAnulacionCard } from "./BloquesLeads";
import { CallCenterKpis, MiDiaCard } from "./CallCenterKpis";
import { MapaCalorCard } from "./MapaCalorCard";
import { RankingConfirmadoras } from "./RankingConfirmadoras";

export function CallCenterView() {
  const { view } = usePanel();
  const state = usePanelContract("callcenter", view.access === "permitido" ? view.query : null);
  const miDia = state.data?.actual.miDia ?? null;

  return (
    <div className="space-y-3.5">
      <OrigenCanalesNota state={state} />
      {miDia && <MiDiaCard miDia={miDia} origin={state.origin} />}
      <CallCenterKpis state={state} />
      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-3">
        <ColaLeadsCard state={state} />
        <MotivosAnulacionCard state={state} />
        <CalidadLeadsCard state={state} />
      </div>
      <MapaCalorCard state={state} />
      <RankingConfirmadoras state={state} />
    </div>
  );
}
