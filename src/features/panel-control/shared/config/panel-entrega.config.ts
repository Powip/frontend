import type { PanelContractId } from "../models/panel-contract.model";
import type { PanelSubtabId, PanelTabId } from "../models/panel-navigation.model";

/**
 * Control de entrega: lo que todavía es demo (o se retiene para una entrega posterior) se
 * oculta desde ESTE archivo, con una lista explícita. Quitar un ítem de la lista lo vuelve a
 * mostrar tal como estaba; no se borra ninguna vista ni fuente.
 */
export type PanelAccionOculta = "exportar" | "compartir";

export interface PanelSeccionOculta {
  /** Nombre legible, solo para mensajes. */
  id: string;
  /** Pestaña principal que se oculta entera (sin subpestaña). */
  tab?: PanelTabId;
  /** Subpestaña oculta dentro de `tab`. */
  subtab?: PanelSubtabId;
  /** Acción del shell (botón/diálogo) que se oculta. */
  accion?: PanelAccionOculta;
  /** Contratos que solo existen para esa sección (se anulan mientras esté oculta). */
  contratos: PanelContractId[];
}

export const PANEL_SECCIONES_OCULTAS: PanelSeccionOculta[] = [
  {
    id: "Configuración › Metas",
    tab: "configuracion",
    subtab: "metas",
    contratos: ["config-metas", "config-metas-guardar"],
  },
  {
    id: "Configuración › Estados y reglas",
    tab: "configuracion",
    subtab: "estados",
    contratos: ["config-estados"],
  },
  {
    id: "Configuración › Cuadres y calidad",
    tab: "configuracion",
    subtab: "cuadres",
    contratos: ["config-cuadres"],
  },
  {
    id: "Configuración › Para desarrollo",
    tab: "configuracion",
    subtab: "desarrollo",
    contratos: [],
  },
  {
    id: "Ventas y canales › Publicidad",
    tab: "canales",
    subtab: "publicidad",
    contratos: ["publicidad"],
  },
  { id: "Exportar (Excel completo)", accion: "exportar", contratos: ["exportacion-libro"] },
  { id: "Compartir reporte", accion: "compartir", contratos: ["compartir-reporte"] },
];

type Lista = readonly PanelSeccionOculta[];

export function isTabOculta(tab: PanelTabId, lista: Lista = PANEL_SECCIONES_OCULTAS): boolean {
  return lista.some((s) => s.tab === tab && !s.subtab && !s.accion);
}

export function isSubtabOculta(
  tab: PanelTabId,
  subtab: PanelSubtabId,
  lista: Lista = PANEL_SECCIONES_OCULTAS,
): boolean {
  return lista.some((s) => s.tab === tab && s.subtab === subtab);
}

export function isAccionOculta(
  accion: PanelAccionOculta,
  lista: Lista = PANEL_SECCIONES_OCULTAS,
): boolean {
  return lista.some((s) => s.accion === accion);
}

export function isContratoOculto(
  contractId: PanelContractId,
  lista: Lista = PANEL_SECCIONES_OCULTAS,
): boolean {
  return lista.some((s) => s.contratos.includes(contractId));
}

/** Metas ocultas: ninguna vista debe mostrar metas (ni demo) mientras no se entregue la sección. */
export function metasOcultas(lista: Lista = PANEL_SECCIONES_OCULTAS): boolean {
  return isContratoOculto("config-metas", lista);
}
