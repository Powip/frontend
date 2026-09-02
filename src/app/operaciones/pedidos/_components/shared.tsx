"use client";

import Image from "next/image";
import { AlertTriangle, DollarSign, PhoneCall, PhoneMissed } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { OrderStatus } from "@/interfaces/IOrder";
import {
  getAvailableStatuses,
  getStatusDotClass,
  getStatusLabel,
  getStatusPillClasses,
  toFulfillmentStatus,
} from "@/utils/domain/orders-status-flow";
import { DELIVERY_ZONES } from "@/constants/operationsDomain";
import { WhatsAppIcon } from "@/components/shared/WhatsAppIcon";
import type { Sale, SaleItem } from "./types";

const ZONE_MAP = new Map(DELIVERY_ZONES.map((z) => [z.value, z]));

export { WhatsAppIcon };

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

/**
 * Aviso de llamada — el pedido sigue con su `status` real (p.ej. PREPARADO)
 * sin tocar, pero el filtro rápido por pipeline (PorDespacharTab) prioriza
 * `callStatus` por sobre `status` para decidir el chip: NO_ANSWER → "No
 * Contesta", CONFIRMED → "Contactado" (aunque el pedido todavía no pasó a
 * LLAMADO — se puede confirmar la llamada antes de que termine de armarse).
 * En ambos casos el pedido sale del chip "Preparado" aunque el Estado siga
 * diciendo "Preparado"; este aviso aclara por qué.
 */
export function CallStatusBadge({ sale }: { sale: Sale }) {
  if (sale.callStatus === "NO_ANSWER") {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
              <PhoneMissed className="h-3 w-3" />
              No contesta
            </span>
          </TooltipTrigger>
          <TooltipContent>
            No respondió la última llamada — por eso no cuenta en el chip
            &quot;Preparado&quot;.
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }
  if (sale.callStatus === "CONFIRMED" && sale.status !== "LLAMADO") {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
              <PhoneCall className="h-3 w-3" />
              Contactado
            </span>
          </TooltipTrigger>
          <TooltipContent>
            Ya se confirmó la llamada — por eso cuenta en el chip
            &quot;Contactado&quot; y no en &quot;Preparado&quot;, aunque el
            pedido todavía no pasó a estado Llamado.
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }
  return null;
}

export function StatusPill({ status }: { status: OrderStatus }) {
  // En las tablas de Pedidos la columna Estado muestra la etapa de
  // fulfillment: un PAGADO se ve como "Pendiente" (el cobro se gestiona en el
  // modal de pagos, no en esta píldora).
  const displayStatus = toFulfillmentStatus(status);
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-bold ${getStatusPillClasses(displayStatus)}`}
    >
      {getStatusLabel(displayStatus)}
    </span>
  );
}

const MAX_PRODUCT_THUMBS = 3;

/**
 * Miniaturas de los items del pedido (mismo look que el preview de
 * Productos en la tabla de Ventas), con tooltip al hover con
 * "Nombre xCantidad" de cada item — reemplaza el texto plano truncado
 * que tenía esta columna en Pedidos.
 */
export function ProductThumbnails({ items }: { items: SaleItem[] }) {
  if (!items || items.length === 0) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  const shown = items.slice(0, MAX_PRODUCT_THUMBS);
  const extra = items.length - shown.length;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex -space-x-2 cursor-default">
            {shown.map((item, idx) => (
              <div
                key={idx}
                className="h-7 w-7 shrink-0 overflow-hidden rounded-full border-2 border-background bg-muted"
              >
                {item.imageUrl ? (
                  <Image
                    src={item.imageUrl}
                    alt={item.productName}
                    width={28}
                    height={28}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-[10px] font-semibold text-muted-foreground">
                    {item.productName.charAt(0)}
                  </div>
                )}
              </div>
            ))}
            {extra > 0 && (
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-background bg-muted text-[10px] font-semibold text-muted-foreground">
                +{extra}
              </div>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent className="max-w-[240px]">
          <div className="space-y-0.5">
            {items.map((item, idx) => (
              <div key={idx} className="text-xs">
                {item.productName} x{item.quantity}
              </div>
            ))}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

const NO_ANSWER_VALUE = "__NO_CONTESTA__";
const REPROGRAMAR_VALUE = "__REPROGRAMAR__";

/**
 * Cambio de estado por fila — recupera el <select> combinado que tenía el
 * módulo viejo de Operaciones (estado real + "No Contesta"/"Reprogramar"
 * como acciones aparte que no cambian `status` directamente), con el look
 * de píldora de color en vez del enum crudo. Mismo patrón que StatusSelect
 * en Ventas (reprogramar abre el mismo RescheduleDialog compartido). Si no
 * hay permiso para cambiar estado, el caller debe mostrar <StatusPill>.
 */
export function RowStatusSelect({
  status,
  onChangeStatus,
  onMarkNoAnswer,
  onReschedule,
}: {
  status: OrderStatus;
  onChangeStatus: (next: OrderStatus) => void;
  /** Si se omite, no se ofrece "No Contesta" (p.ej. ya está EN_ENVIO o más adelante). */
  onMarkNoAnswer?: () => void;
  /** Si se omite, no se ofrece "Reprogramar". */
  onReschedule?: () => void;
}) {
  // La lógica de transición usa SIEMPRE el status real (value + nextStatuses);
  // solo la etiqueta/píldora visible del trigger muestra la etapa de
  // fulfillment (PAGADO se ve como "Pendiente").
  const nextStatuses = getAvailableStatuses(status).filter((s) => s !== status);
  if (nextStatuses.length === 0 && !onMarkNoAnswer && !onReschedule) {
    return <StatusPill status={status} />;
  }

  const displayStatus = toFulfillmentStatus(status);

  return (
    <Select
      value={status}
      onValueChange={(v) => {
        if (v === NO_ANSWER_VALUE) onMarkNoAnswer?.();
        else if (v === REPROGRAMAR_VALUE) onReschedule?.();
        else onChangeStatus(v as OrderStatus);
      }}
    >
      <SelectTrigger
        size="sm"
        className={`h-auto w-auto gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-bold ${getStatusPillClasses(displayStatus)}`}
      >
        <SelectValue>{getStatusLabel(displayStatus)}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {nextStatuses.map((s) => (
          <SelectItem key={s} value={s}>
            <span className="flex items-center gap-2">
              <span className={`h-2 w-2 shrink-0 rounded-full ${getStatusDotClass(s)}`} />
              {getStatusLabel(s)}
            </span>
          </SelectItem>
        ))}
        {(onMarkNoAnswer || onReschedule) && (nextStatuses.length > 0) && <SelectSeparator />}
        {onReschedule && (
          <SelectItem value={REPROGRAMAR_VALUE} className="text-violet-600 dark:text-violet-400">
            Reprogramar
          </SelectItem>
        )}
        {onMarkNoAnswer && (
          <SelectItem value={NO_ANSWER_VALUE} className="text-amber-600 dark:text-amber-400">
            No Contesta
          </SelectItem>
        )}
      </SelectContent>
    </Select>
  );
}

/** Botón "Registrar cobro" con puntito rojo pulsante cuando hay pagos pendientes de aprobar — mismo criterio que el módulo viejo. */
export function PaymentButton({
  hasPendingApproval,
  onClick,
}: {
  hasPendingApproval?: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      size="icon"
      variant="ghost"
      className="relative h-7 w-7"
      title={hasPendingApproval ? "Pagos pendientes de aprobación" : "Registrar cobro"}
      onClick={onClick}
    >
      <DollarSign className="h-3.5 w-3.5" />
      {hasPendingApproval && (
        <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
        </span>
      )}
    </Button>
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

/** Badge de zona con emoji, mismo criterio de color que Guías & Courier. */
export function ZoneBadge({ zone }: { zone?: string | null }) {
  if (!zone) return <span className="text-xs text-muted-foreground">—</span>;
  const z = ZONE_MAP.get(zone);
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/60 px-2 py-0.5 text-[11px] font-medium whitespace-nowrap">
      {z ? `${z.emoji} ${z.label}` : zone}
    </span>
  );
}

export function formatDateTime(dateStr?: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("es-PE", {
    day: "2-digit",
    month: "short",
  });
}
