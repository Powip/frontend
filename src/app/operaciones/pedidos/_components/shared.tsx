"use client";

import { AlertTriangle } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { OrderStatus } from "@/interfaces/IOrder";
import { getStatusPillClasses } from "@/utils/domain/orders-status-flow";

/** Icono de alerta de stock insuficiente — regla de negocio a preservar (auditoría). */
export function StockIssueIcon({ show }: { show?: boolean }) {
  if (!show) return null;
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
        </TooltipTrigger>
        <TooltipContent>Stock insuficiente para este pedido</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function StatusPill({ status }: { status: OrderStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-bold ${getStatusPillClasses(status)}`}
    >
      {status}
    </span>
  );
}

/**
 * Categoriza el motivo de fallo por texto libre del courier — mismo criterio
 * que el Tablero (`guessFailureReason`). No hay un enum estructurado en
 * backend todavía, es la mejor aproximación disponible.
 */
export function guessFailureReason(sale: {
  shalomError?: string | null;
  syncErrors?: Record<string, string> | null;
}): string {
  const raw = `${sale.shalomError ?? ""} ${Object.values(sale.syncErrors ?? {}).join(" ")}`.toLowerCase();
  if (!raw.trim()) return "Sin detalle del courier";
  if (raw.includes("no recog") || raw.includes("no recoge")) return "Cliente no recoge en agencia";
  if (raw.includes("direcci") || raw.includes("ubicaci")) return "Dirección incorrecta";
  if (raw.includes("rechaz")) return "Rechazó el pedido";
  if (raw.includes("no contest") || raw.includes("sin respuesta")) return "No contesta el teléfono";
  return "Otro motivo";
}

/** "Qué pasó" — badge + motivo visible en la celda, sin depender de hover. */
export function FailureBadge({
  shalomError,
  syncErrors,
}: {
  shalomError?: string | null;
  syncErrors?: Record<string, string> | null;
}) {
  const motivo = guessFailureReason({ shalomError, syncErrors });
  return (
    <div className="flex flex-col gap-0.5">
      <span className="inline-flex w-fit items-center gap-1 rounded-full border border-red-200 bg-red-100 px-2 py-0.5 text-[11px] font-bold text-red-700 dark:border-red-500/30 dark:bg-red-500/15 dark:text-red-300">
        <AlertTriangle className="h-3 w-3" />
        Entrega fallida
      </span>
      <span className="text-[11px] text-muted-foreground">{motivo}</span>
    </div>
  );
}

const DIAS_TIER = (days: number) => {
  if (days >= 30) return "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300";
  if (days >= 20) return "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300";
  return "bg-muted text-muted-foreground";
};

/** Badge de antigüedad en días, con el mismo criterio de severidad en todas las tablas. */
export function DiasBadge({ days }: { days: number }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums ${DIAS_TIER(days)}`}>
      {days}d
    </span>
  );
}

export function formatDateTime(dateStr?: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleString("es-PE", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
