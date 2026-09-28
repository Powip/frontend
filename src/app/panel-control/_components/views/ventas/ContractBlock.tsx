"use client";

import type { ReactNode } from "react";
import { ContractView } from "@/components/panel-control/ContractView";
import { KpiCard } from "@/components/panel-control/KpiCard";
import { PanelCard } from "@/components/panel-control/PanelCard";
import type { SkeletonVariant } from "@/components/panel-control/PanelStates";
import type { ContractResult } from "@/features/panel-control/shared/data/panel-contract-map";
import type { PanelContractState } from "@/features/panel-control/shared/hooks/use-panel-contract";
import type { DataOrigin } from "@/features/panel-control/shared/models/data-origin.model";
import type { PanelContractId } from "@/features/panel-control/shared/models/panel-contract.model";

interface ContractBlockProps<K extends PanelContractId> {
  state: PanelContractState<K>;
  titulo: ReactNode;
  subtitulo?: ReactNode;
  acciones?: ReactNode;
  skeleton?: SkeletonVariant;
  id?: string;
  className?: string;
  children: (data: ContractResult<K>, origin: DataOrigin) => ReactNode;
}

export function ContractBlock<K extends PanelContractId>({
  state,
  titulo,
  subtitulo,
  acciones,
  skeleton = "tabla",
  id,
  className,
  children,
}: ContractBlockProps<K>) {
  return (
    <PanelCard
      id={id}
      titulo={titulo}
      subtitulo={subtitulo}
      acciones={acciones}
      origin={state.status === "cargando" ? undefined : state.origin}
      className={className}
    >
      <ContractView
        state={state}
        label={typeof titulo === "string" ? titulo : "bloque"}
        skeleton={skeleton}
      >
        {children}
      </ContractView>
    </PanelCard>
  );
}

interface KpiRowProps<K extends PanelContractId> {
  state: PanelContractState<K>;
  labels: string[];
  titulo: string;
  className?: string;
  children: (data: ContractResult<K>, origin: DataOrigin) => ReactNode;
}

export function KpiRow<K extends PanelContractId>({
  state,
  labels,
  titulo,
  className = "grid grid-cols-2 gap-3 lg:grid-cols-4",
  children,
}: KpiRowProps<K>) {
  if (state.status === "cargando" || (state.status === "listo" && state.data === undefined)) {
    return (
      <div className={className}>
        {labels.map((label) => (
          <KpiCard key={label} label={label} value="—" loading />
        ))}
      </div>
    );
  }
  if (state.status === "listo" && state.data !== undefined) {
    return <div className={className}>{children(state.data, state.origin)}</div>;
  }
  return (
    <PanelCard titulo={titulo} origin={state.origin}>
      <ContractView state={state} label={titulo}>
        {children}
      </ContractView>
    </PanelCard>
  );
}
