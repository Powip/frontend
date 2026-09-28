"use client";

import { useQuery } from "@tanstack/react-query";
import { useCallback, useContext } from "react";
import { PANEL_ROLE_POLICIES } from "../config/panel-roles.config";
import { rolPuedeUsarContrato } from "../data/panel-autorizacion";
import type { ContractQuery, ContractResult } from "../data/panel-contract-map";
import { resolvePanelSource } from "../data/panel-source";
import type { DataOrigin } from "../models/data-origin.model";
import { CATALOGO_VACIO, catalogoClave } from "../models/panel-catalog.model";
import type { PanelContractId } from "../models/panel-contract.model";
import { PanelCatalogContext } from "../state/panel-catalog.context";
import { usePanel } from "../state/panel-context";
import { panelKeys } from "./panel-keys";

export type PanelContractStatus = "pendiente" | "restringido" | "cargando" | "error" | "listo";

export interface PanelContractState<K extends PanelContractId> {
  status: PanelContractStatus;
  data: ContractResult<K> | undefined;
  origin: DataOrigin;
  error: Error | null;
  refetch: () => void;
  isFetching: boolean;
}

export interface PanelContractOptions {
  permisosDe?: "vista" | "usuario";
}

const CONTRATOS_DE_CATALOGO: PanelContractId[] = ["canales-fichas", "opciones-asesores"];

function usePanelContractSetup<K extends PanelContractId>(
  contractId: K,
  options: PanelContractOptions,
) {
  const { view, sources, state, now, session } = usePanel();
  const catalogoContexto = useContext(PanelCatalogContext);
  const { source, origin } = resolvePanelSource(sources, contractId, state.dataMode);
  const ready = view.access === "permitido" ? view : null;
  const capacidades =
    options.permisosDe === "usuario" ? ready?.actualCapabilities : ready?.capabilities;
  const rol = options.permisosDe === "usuario" ? ready?.actualRole : ready?.role;
  const permitido = !!capacidades && !!rol && rolPuedeUsarContrato(contractId, rol, capacidades);
  const asesorAutorizado =
    options.permisosDe === "usuario"
      ? ready && PANEL_ROLE_POLICIES[ready.actualRole].asesorFijo
        ? session.userId
        : null
      : (ready?.asesorFijo ?? null);
  const esCatalogo = CONTRATOS_DE_CATALOGO.includes(contractId);
  const catalogo = esCatalogo
    ? { ...CATALOGO_VACIO, listo: true }
    : (catalogoContexto ?? { ...CATALOGO_VACIO, listo: true });
  const claveCatalogo = source?.kind === "demo" ? catalogoClave(catalogo) : "";

  const ejecutar = useCallback(
    (query: ContractQuery<K>) => {
      if (!source || !rol || !capacidades) {
        return Promise.reject(new Error("Contrato sin fuente habilitada"));
      }
      return source.fetch(query, {
        role: rol,
        capabilities: capacidades,
        now,
        catalogo,
        asesorAutorizado,
      });
    },
    [source, rol, capacidades, now, catalogo, asesorAutorizado],
  );

  return { source, origin, permitido, rol, catalogo, claveCatalogo, asesorAutorizado, ejecutar };
}

export function usePanelContract<K extends PanelContractId>(
  contractId: K,
  query: ContractQuery<K> | null,
  options: PanelContractOptions = {},
): PanelContractState<K> {
  const { source, origin, permitido, rol, catalogo, claveCatalogo, asesorAutorizado, ejecutar } =
    usePanelContractSetup(contractId, options);
  const enabled = !!source && !!query && permitido && catalogo.listo;

  const result = useQuery({
    queryKey: [
      ...panelKeys.contract(contractId, origin.kind, rol ?? "sin_rol", query),
      claveCatalogo,
      asesorAutorizado ?? "",
    ],
    queryFn: () => {
      if (!query) throw new Error("Consulta vacía");
      return ejecutar(query);
    },
    enabled,
    staleTime: 60_000,
    placeholderData: (previous) => previous,
  });

  let status: PanelContractStatus;
  if (!permitido) status = "restringido";
  else if (!source) status = "pendiente";
  else if (!query || !catalogo.listo || result.isPending) status = "cargando";
  else if (result.isError) status = "error";
  else status = "listo";

  return {
    status,
    data: enabled ? result.data : undefined,
    origin,
    error: result.error,
    isFetching: result.isFetching,
    refetch: () => {
      void result.refetch();
    },
  };
}

export function usePanelContractFetcher<K extends PanelContractId>(
  contractId: K,
): { fetch: ((query: ContractQuery<K>) => Promise<ContractResult<K>>) | null; origin: DataOrigin } {
  const { source, origin, permitido, ejecutar } = usePanelContractSetup(contractId, {});
  return { fetch: source && permitido ? ejecutar : null, origin };
}
