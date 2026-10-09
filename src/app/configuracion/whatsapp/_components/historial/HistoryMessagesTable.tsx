"use client";

import { ChevronDown, ExternalLink, MousePointerClick, RotateCw } from "lucide-react";
import { Fragment, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BlockedActionButton } from "@/components/whatsapp/BlockedActionButton";
import { MessageStatusTicks } from "@/components/whatsapp/MessageStatusTicks";
import { WHATSAPP_MESSAGE_STATUSES } from "@/features/whatsapp/enums/whatsapp.enums";
import type {
  WhatsAppHistoryMessage,
  WhatsAppHistoryPage,
} from "@/features/whatsapp/models/history.model";
import { buildTimelineSteps } from "@/features/whatsapp/utils/history.util";
import { formatLimaDateTime, formatLimaTime } from "@/features/whatsapp/utils/lima-time.util";
import { isNotSentStatus } from "@/features/whatsapp/utils/message-status.util";
import { cn } from "@/lib/utils";

const COLUMN_COUNT = 8;

type RowStatus = { kind: "idle" } | { kind: "pending" } | { kind: "error"; message: string };

interface HistoryMessagesTableProps {
  page: WhatsAppHistoryPage;
  resendBlockedReason: string | null;
  onResend?: (messageId: string) => Promise<void>;
  onOpenOrder: (orderId: string) => void;
  onPageChange?: (page: number) => void;
  paginationBlockedReason: string;
}

function StatusCell({ message }: { message: WhatsAppHistoryMessage }) {
  if (message.status === WHATSAPP_MESSAGE_STATUSES.ASSISTED) {
    return (
      <div className="space-y-0.5">
        <MessageStatusTicks status={message.status} />
        <p className="text-xs text-muted-foreground">
          Número de contingencia
          {message.assistedBy ? ` · marcado por ${message.assistedBy.name}` : ""}
        </p>
      </div>
    );
  }
  return (
    <div className="space-y-0.5">
      <MessageStatusTicks status={message.status} showDetail={isNotSentStatus(message.status)} />
      {isNotSentStatus(message.status) && (
        <p className="text-xs font-medium text-red-700 [overflow-wrap:anywhere] dark:text-red-300">
          {message.reason ?? "Motivo sin informar"}
        </p>
      )}
    </div>
  );
}

function TimelinePanel({
  message,
  onOpenOrder,
}: {
  message: WhatsAppHistoryMessage;
  onOpenOrder: (orderId: string) => void;
}) {
  const steps = buildTimelineSteps(message);
  return (
    <div className="space-y-3 bg-muted/30 px-4 py-3">
      <ol
        className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm"
        aria-label="Línea de tiempo"
      >
        {steps.map((step, index) => (
          <li key={step.key} className="flex items-center gap-2">
            {index > 0 && <span aria-hidden="true">→</span>}
            <span
              className={cn(
                step.tone === "pending" && "text-muted-foreground",
                step.tone === "failed" && "font-medium text-red-700 dark:text-red-300",
              )}
            >
              {step.label}
              {step.at
                ? ` ${formatLimaTime(step.at)}`
                : step.tone === "pending"
                  ? " · sin confirmar"
                  : ""}
            </span>
          </li>
        ))}
      </ol>
      {message.timeline.clickedAt && (
        <p className="text-xs text-muted-foreground">
          Abrir el rastreo no prueba que leyó el mensaje en WhatsApp.
        </p>
      )}
      {message.orderId ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => message.orderId && onOpenOrder(message.orderId)}
        >
          <ExternalLink className="h-4 w-4" aria-hidden="true" />
          Ver pedido {message.orderNumber ?? ""}
        </Button>
      ) : (
        <p className="text-xs text-muted-foreground">Este mensaje no tiene un pedido asociado.</p>
      )}
    </div>
  );
}

export function HistoryMessagesTable({
  page,
  resendBlockedReason,
  onResend,
  onOpenOrder,
  onPageChange,
  paginationBlockedReason,
}: HistoryMessagesTableProps) {
  const baseId = useId();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [rowStatus, setRowStatus] = useState<Record<string, RowStatus>>({});
  const paginationReasonId = `${baseId}-pagination`;
  const totalPages =
    page.total === null ? null : Math.max(1, Math.ceil(page.total / page.pageSize));
  const canGoBack = page.page > 1;
  const canGoForward = page.hasMore;

  const resend = async (message: WhatsAppHistoryMessage) => {
    if (!onResend || !message.canResend || resendBlockedReason) return;
    if (rowStatus[message.id]?.kind === "pending") return;
    setRowStatus((current) => ({ ...current, [message.id]: { kind: "pending" } }));
    try {
      await onResend(message.id);
      setRowStatus((current) => ({ ...current, [message.id]: { kind: "idle" } }));
    } catch (caught) {
      const text =
        caught instanceof Error && caught.message ? caught.message : "No se pudo reenviar.";
      setRowStatus((current) => ({ ...current, [message.id]: { kind: "error", message: text } }));
    }
  };

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha y hora</TableHead>
              <TableHead>Pedido</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Plantilla</TableHead>
              <TableHead>Courier</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Rastreo</TableHead>
              <TableHead>
                <span className="sr-only">Acciones</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {page.items.map((message) => {
              const isExpanded = expanded === message.id;
              const panelId = `${baseId}-timeline-${message.id}`;
              const reasonId = `${baseId}-resend-${message.id}`;
              const status = rowStatus[message.id] ?? { kind: "idle" };
              const notSent = isNotSentStatus(message.status);
              const rowReason = !message.canResend
                ? (message.resendBlockedReason ?? "POWIP no permite reenviar este aviso.")
                : resendBlockedReason;
              return (
                <Fragment key={message.id}>
                  <TableRow>
                    <TableCell className="whitespace-nowrap text-xs">
                      <button
                        type="button"
                        aria-expanded={isExpanded}
                        aria-controls={panelId}
                        onClick={() => setExpanded(isExpanded ? null : message.id)}
                        className="inline-flex items-center gap-1 rounded text-left underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <ChevronDown
                          className={cn("h-4 w-4 transition-transform", isExpanded && "rotate-180")}
                          aria-hidden="true"
                        />
                        {formatLimaDateTime(message.createdAt)}
                        <span className="sr-only">, ver línea de tiempo</span>
                      </button>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {message.orderNumber ?? "Sin pedido"}
                      <span className="block text-xs text-muted-foreground">
                        {message.storeName}
                      </span>
                    </TableCell>
                    <TableCell className="min-w-40">
                      <span className="block [overflow-wrap:anywhere]">
                        {message.customerName ?? "Sin nombre"}
                      </span>
                      <span className="block text-xs text-muted-foreground">{message.phone}</span>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {message.templateName ?? "—"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm">
                      {message.courierName ?? "—"}
                    </TableCell>
                    <TableCell className="min-w-40">
                      <StatusCell message={message} />
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm">
                      {message.timeline.clickedAt ? (
                        <span className="inline-flex items-center gap-1">
                          <MousePointerClick className="h-3.5 w-3.5" aria-hidden="true" />
                          Abrió {formatLimaTime(message.timeline.clickedAt)}
                        </span>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {notSent && (
                        <div className="space-y-1">
                          <BlockedActionButton
                            variant="outline"
                            size="sm"
                            blocked={!!rowReason || !onResend || status.kind === "pending"}
                            blockedReasonId={reasonId}
                            onClick={() => resend(message)}
                          >
                            <RotateCw className="h-4 w-4" aria-hidden="true" />
                            Reenviar
                            <span className="sr-only">
                              {" "}
                              el aviso a {message.customerName ?? message.phone}
                            </span>
                          </BlockedActionButton>
                          {rowReason && (
                            <p
                              id={reasonId}
                              className="max-w-56 whitespace-normal text-xs text-muted-foreground"
                            >
                              {rowReason}
                            </p>
                          )}
                          {status.kind === "pending" && (
                            <p role="status" className="text-xs text-muted-foreground">
                              Reenviando…
                            </p>
                          )}
                          {status.kind === "error" && (
                            <p
                              role="alert"
                              className="max-w-56 whitespace-normal text-xs text-red-700 dark:text-red-300"
                            >
                              {status.message}
                            </p>
                          )}
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                  {isExpanded && (
                    <TableRow id={panelId}>
                      <TableCell colSpan={COLUMN_COUNT} className="p-0">
                        <TimelinePanel message={message} onOpenOrder={onOpenOrder} />
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              );
            })}
          </TableBody>
        </Table>
      </div>
      <nav
        aria-label="Paginación de mensajes"
        className="flex flex-wrap items-center justify-between gap-2 text-sm"
      >
        <span className="text-muted-foreground">
          {totalPages === null ? `Página ${page.page}` : `Página ${page.page} de ${totalPages}`}
          {page.total !== null && ` · ${page.total.toLocaleString("es-PE")} mensajes`}
        </span>
        <span className="flex gap-2">
          {[
            { label: "Anterior", enabled: canGoBack, target: page.page - 1 },
            { label: "Siguiente", enabled: canGoForward, target: page.page + 1 },
          ].map((control) => (
            <Button
              key={control.label}
              type="button"
              variant="outline"
              size="sm"
              disabled={!control.enabled}
              aria-disabled={!onPageChange && control.enabled ? true : undefined}
              aria-describedby={!onPageChange && control.enabled ? paginationReasonId : undefined}
              onClick={() => onPageChange?.(control.target)}
            >
              {control.label}
            </Button>
          ))}
        </span>
      </nav>
      {!onPageChange && (canGoBack || canGoForward) && (
        <p id={paginationReasonId} className="text-xs text-muted-foreground">
          {paginationBlockedReason}
        </p>
      )}
    </div>
  );
}
