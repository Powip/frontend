"use client";

import { useMemo } from "react";
import type { AsesorOpcion } from "../../asesores/models/asesor-opcion.model";
import type { CanalFicha } from "../../canales/models/canal-ficha.model";
import { usePanelCatalogState } from "../state/panel-catalog-provider";
import { usePanel } from "../state/panel-context";
import type { PanelContractState } from "./use-panel-contract";

export interface PanelOptions {
  canales: PanelContractState<"canales-fichas">;
  asesores: PanelContractState<"opciones-asesores">;
  canalNombre: (id: string) => string | undefined;
  canalColor: (id: string) => string | null;
  asesorNombre: (id: string) => string | undefined;
  tiendaNombre: (id: string) => string | undefined;
}

export function usePanelOptions(): PanelOptions {
  const { session } = usePanel();
  const { canales, asesores } = usePanelCatalogState();

  return useMemo(() => {
    const canalesPorId = new Map<string, CanalFicha>(
      (canales.data ?? []).map((canal) => [canal.id, canal]),
    );
    const asesoresPorId = new Map<string, AsesorOpcion>(
      (asesores.data ?? []).map((asesor) => [asesor.id, asesor]),
    );
    return {
      canales,
      asesores,
      canalNombre: (id: string) => canalesPorId.get(id)?.nombre,
      canalColor: (id: string) => canalesPorId.get(id)?.color ?? null,
      asesorNombre: (id: string) =>
        asesoresPorId.get(id)?.nombre ?? (id === session.userId ? session.userName : undefined),
      tiendaNombre: (id: string) => session.tiendas.find((tienda) => tienda.id === id)?.nombre,
    };
  }, [canales, asesores, session]);
}
