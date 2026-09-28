export const PANEL_ROLES = ["dueno", "supervisora", "confirmadora", "vendedora"] as const;

export type PanelRole = (typeof PANEL_ROLES)[number];

export const PANEL_CAPABILITIES = [
  "ver_costos",
  "ver_comisiones",
  "ver_finanzas",
  "ver_configuracion",
  "editar_configuracion",
  "exportar_libro",
  "exportar_tabla",
  "ver_como",
  "elegir_asesor",
] as const;

export type PanelCapability = (typeof PANEL_CAPABILITIES)[number];

export type PanelRoleSource = "permiso_panel" | "rol_jwt" | "superadmin";

export type PanelRoleResolution =
  | {
      status: "resuelto";
      role: PanelRole;
      source: PanelRoleSource;
      evidencia: string;
    }
  | {
      status: "sin_resolver";
      rolJwt: string | null;
      motivo: string;
    };

export const PANEL_ROLE_PERMISSION_CLAIMS: Record<PanelRole, string> = {
  dueno: "PANEL_ROL_DUENO",
  supervisora: "PANEL_ROL_SUPERVISORA",
  confirmadora: "PANEL_ROL_CONFIRMADORA",
  vendedora: "PANEL_ROL_VENDEDORA",
};
