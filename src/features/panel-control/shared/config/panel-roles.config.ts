import type { PanelTabId } from "../models/panel-navigation.model";
import type { PanelCapability, PanelRole } from "../models/panel-role.model";

export interface PanelRolePolicy {
  role: PanelRole;
  etiqueta: string;
  pestanas: PanelTabId[];
  inicio: PanelTabId;
  capacidades: PanelCapability[];
  asesorFijo: boolean;
  restricciones: string;
}

export const PANEL_ROLE_POLICIES: Record<PanelRole, PanelRolePolicy> = {
  dueno: {
    role: "dueno",
    etiqueta: "Dueño",
    pestanas: [
      "resumen",
      "canales",
      "callcenter",
      "operaciones",
      "finanzas",
      "equipo",
      "configuracion",
    ],
    inicio: "resumen",
    capacidades: [
      "ver_costos",
      "ver_comisiones",
      "ver_finanzas",
      "ver_configuracion",
      "editar_configuracion",
      "exportar_libro",
      "exportar_tabla",
      "ver_como",
      "elegir_asesor",
    ],
    asesorFijo: false,
    restricciones: "Ninguna",
  },
  supervisora: {
    role: "supervisora",
    etiqueta: "Supervisora",
    pestanas: ["resumen", "canales", "callcenter", "operaciones", "equipo"],
    inicio: "operaciones",
    capacidades: ["exportar_libro", "exportar_tabla", "elegir_asesor"],
    asesorFijo: false,
    restricciones: "No ve costos, márgenes, ganancia, comisiones ni Finanzas",
  },
  confirmadora: {
    role: "confirmadora",
    etiqueta: "Confirmadora",
    pestanas: ["callcenter"],
    inicio: "callcenter",
    capacidades: ["exportar_tabla"],
    asesorFijo: true,
    restricciones: "Filtro de asesora fijo en ella; no ve costos; sin Excel completo",
  },
  vendedora: {
    role: "vendedora",
    etiqueta: "Vendedora",
    pestanas: ["misventas"],
    inicio: "misventas",
    capacidades: ["exportar_tabla"],
    asesorFijo: true,
    restricciones: "Filtro de asesora fijo en ella; no ve costos; sin Excel completo",
  },
};

export function roleCan(role: PanelRole, capability: PanelCapability): boolean {
  return PANEL_ROLE_POLICIES[role].capacidades.includes(capability);
}

export function roleTabs(role: PanelRole): PanelTabId[] {
  return PANEL_ROLE_POLICIES[role].pestanas;
}

export function resolveAllowedTab(role: PanelRole, requested: PanelTabId | null): PanelTabId {
  const policy = PANEL_ROLE_POLICIES[role];
  if (requested && policy.pestanas.includes(requested)) return requested;
  return policy.inicio;
}
