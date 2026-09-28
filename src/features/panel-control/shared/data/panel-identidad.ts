import { PANEL_ROLE_POLICIES } from "../config/panel-roles.config";
import type { PanelSourceContext } from "./panel-source";

export class PanelAccesoDenegadoError extends Error {
  constructor(motivo: string) {
    super(`403: ${motivo}`);
    this.name = "PanelAccesoDenegadoError";
  }
}

export function asesorForzado(context: PanelSourceContext): string | null {
  if (!PANEL_ROLE_POLICIES[context.role].asesorFijo) return null;
  if (!context.asesorAutorizado) {
    throw new PanelAccesoDenegadoError("el rol exige la identidad de la asesora autenticada");
  }
  return context.asesorAutorizado;
}

export function consultaConIdentidad<Q extends { asesor?: string }>(
  query: Q,
  context: PanelSourceContext,
): Q {
  const asesor = asesorForzado(context);
  return asesor ? { ...query, asesor } : query;
}

export function parametrosConIdentidad(
  params: Record<string, string>,
  context: PanelSourceContext,
): Record<string, string> {
  const asesor = asesorForzado(context);
  if (!asesor) return params;
  if (params.asesor && params.asesor !== asesor) {
    throw new PanelAccesoDenegadoError("no puedes ver pedidos de otra asesora");
  }
  return { ...params, asesor };
}
