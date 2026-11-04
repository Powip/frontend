"use client";

import type { ReactNode } from "react";
import { estadoHttp, MENSAJE_SIN_PERMISO } from "@/features/panel-control/shared/api/panel-errors";
import type { ContractResult } from "@/features/panel-control/shared/data/panel-contract-map";
import type { PanelContractState } from "@/features/panel-control/shared/hooks/use-panel-contract";
import type { DataOrigin } from "@/features/panel-control/shared/models/data-origin.model";
import type { PanelContractId } from "@/features/panel-control/shared/models/panel-contract.model";
import {
  PanelError,
  PanelSkeleton,
  PendingIntegration,
  RestrictedNotice,
  type SkeletonVariant,
} from "./PanelStates";

interface ContractViewProps<K extends PanelContractId> {
  state: PanelContractState<K>;
  label: string;
  skeleton?: SkeletonVariant;
  children: (data: ContractResult<K>, origin: DataOrigin) => ReactNode;
}

export function ContractView<K extends PanelContractId>({
  state,
  label,
  skeleton = "kpis",
  children,
}: ContractViewProps<K>) {
  switch (state.status) {
    case "restringido":
      return (
        <RestrictedNotice motivo="Tu rol no tiene acceso a esta información. El backend también debe rechazarla." />
      );
    case "pendiente":
      return <PendingIntegration origin={state.origin} />;
    case "cargando":
      return <PanelSkeleton variant={skeleton} label={label} />;
    case "error":
      // 403 del servidor: es un permiso, no una falla. Se dice con claridad y sin «Reintentar».
      if (estadoHttp(state.error) === 403) return <RestrictedNotice motivo={MENSAJE_SIN_PERMISO} />;
      return <PanelError error={state.error} onRetry={state.refetch} />;
    default:
      if (state.data === undefined) return <PanelSkeleton variant={skeleton} label={label} />;
      return children(state.data, state.origin);
  }
}
