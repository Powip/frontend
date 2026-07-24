"use client";

import { format } from "date-fns";
import { es } from "date-fns/locale";

interface EvaStatusBadgeProps {
  evaStatus?: string | null;
  evaSyncedAt?: string | null;
}

export type EvaStatusGroup = "positivo" | "negativo" | "progreso" | "sinAvance";

/**
 * 13 estados crudos de EVA (ver KNOWN_EVA_STATUSES en ms-ventas/eva-status-map.ts).
 * Agrupación visual: terminal-positivo (verde), terminal-negativo (rojo),
 * en-progreso (azul), sin-avance/reintentable (ámbar).
 *
 * Exportadas para reutilizar en otras vistas (selector de filtro, contadores
 * de resumen) sin duplicar la lista de estados — única fuente de verdad.
 */
export const STATUS_GROUP: Record<string, EvaStatusGroup> = {
  ENTREGADO: "positivo",
  CANCELADO: "negativo",
  DEVUELTO: "negativo",
  REGISTRADO: "progreso",
  "EN ALMACEN": "progreso",
  "ASIGNADO MOTORIZADO": "progreso",
  "EN RUTA": "progreso",
  "PUNTO VISITADO": "progreso",
  "NO ENTREGADO": "sinAvance",
  AUSENTE: "sinAvance",
  REPROGRAMAR: "sinAvance",
  INCIDENCIA: "sinAvance",
  "RECOJO EN RUTA": "sinAvance",
};

export const STATUS_LABEL: Record<string, string> = {
  ENTREGADO: "Entregado",
  "NO ENTREGADO": "No entregado",
  CANCELADO: "Cancelado",
  DEVUELTO: "Devuelto",
  REGISTRADO: "Registrado",
  "EN ALMACEN": "En almacén",
  "ASIGNADO MOTORIZADO": "Asignado motorizado",
  "EN RUTA": "En ruta",
  "PUNTO VISITADO": "Punto visitado",
  AUSENTE: "Ausente",
  REPROGRAMAR: "Reprogramar",
  INCIDENCIA: "Incidencia",
  "RECOJO EN RUTA": "Recojo en ruta",
};

export const GROUP_CLS: Record<EvaStatusGroup, string> = {
  positivo: "bg-green-100 text-green-700 border-green-200",
  negativo: "bg-red-100 text-red-700 border-red-200",
  progreso: "bg-blue-100 text-blue-700 border-blue-200",
  sinAvance: "bg-amber-100 text-amber-700 border-amber-200",
};

function formatSyncedAt(iso: string): string {
  try {
    return format(new Date(iso), "dd/MM/yy HH:mm", { locale: es });
  } catch {
    return iso;
  }
}

export default function EvaStatusBadge({
  evaStatus,
  evaSyncedAt,
}: EvaStatusBadgeProps) {
  if (!evaStatus) return null;

  const group = STATUS_GROUP[evaStatus] ?? "progreso";
  const label = STATUS_LABEL[evaStatus] ?? evaStatus;
  const cls = GROUP_CLS[group];
  const title = evaSyncedAt
    ? `Sync: ${formatSyncedAt(evaSyncedAt)}`
    : "Enviado a EVA";

  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${cls} whitespace-nowrap`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70 flex-shrink-0" />
      {label}
    </span>
  );
}
