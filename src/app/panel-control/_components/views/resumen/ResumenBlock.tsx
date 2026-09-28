"use client";

import type { ReactNode } from "react";
import { ContractView } from "@/components/panel-control/ContractView";
import { PanelCard } from "@/components/panel-control/PanelCard";
import type { SkeletonVariant } from "@/components/panel-control/PanelStates";
import type { ContractResult } from "@/features/panel-control/shared/data/panel-contract-map";
import type { PanelContractState } from "@/features/panel-control/shared/hooks/use-panel-contract";
import type { DataOrigin } from "@/features/panel-control/shared/models/data-origin.model";

export type ResumenState = PanelContractState<"resumen">;
export type ResumenEnvelope = ContractResult<"resumen">;

interface ResumenBlockProps {
  state: ResumenState;
  titulo: ReactNode;
  subtitulo?: ReactNode;
  acciones?: ReactNode;
  skeleton?: SkeletonVariant;
  id?: string;
  className?: string;
  children: (data: ResumenEnvelope, origin: DataOrigin) => ReactNode;
}

export function ResumenBlock({
  state,
  titulo,
  subtitulo,
  acciones,
  skeleton = "grafico",
  id,
  className,
  children,
}: ResumenBlockProps) {
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
