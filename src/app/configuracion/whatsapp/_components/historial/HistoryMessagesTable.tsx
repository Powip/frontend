"use client";

import { ChevronDown, ExternalLink, RotateCw } from "lucide-react";
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
import { WaPill } from "@/components/whatsapp/ui/WaPill";
import {
  waButton,
  waTable,
  waTableWrap,
  waTd,
  waTemplateName,
  waTh,
  waTr,
} from "@/components/whatsapp/ui/wa-classes";
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
        <p className="m-0 text-xs text-wa-muted">
          Número de contingencia
          {message.assistedBy ? ` · marcado por ${message.assistedBy.name}` : ""}
        </p>
      </div>
    );
  }
  return (
    <div className="space-y-0.5">
      <MessageStatusTicks status={message.status} />
      {isNotSentStatus(message.status) && (
        <p className="m-0 mt-1 max-w-[34ch] text-xs text-wa-red [overflow-wrap:anywhere]">
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
    <div className="flex flex-col gap-2 bg-wa-surface-2 px-3.5 py-3">
      <ol
        className="m-0 flex list-none flex-wrap items-center gap-y-1.5 p-0 py-1.5 text-[12.5px]"
        aria-label="Línea de tiempo"
      >
        {steps.map((step) => (
          <li
            key={step.key}
            className="mr-[18px] flex items-center gap-2 border-r border-wa-border pr-[18px] last:mr-0 last:border-r-0 last:pr-0"
          >
            <span
              className={cn(
                step.tone === "pending" && "text-wa-muted",
                step.tone === "failed" && "font-medium text-wa-red",
              )}
            >
              {step.label}
              {step.at ? (
                <small className="wa-num ml-1.5 text-wa-muted">{formatLimaTime(step.at)}</small>
              ) : step.tone === "pending" ? (
                " · sin confirmar"
              ) : (
                ""
              )}
            </span>
          </li>
        ))}
        {message.orderId && (
          <li className="flex items-center">
            <button
              type="button"
              className="cursor-pointer rounded font-medium text-wa-primary underline underline-offset-2 outline-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-wa-primary"
              onClick={() => message.orderId && onOpenOrder(message.orderId)}
            >
              <ExternalLink className="mr-1 inline size-3.5 align-[-2px]" aria-hidden="true" />
              Ver pedido {message.orderNumber ?? ""}
            </button>
          </li>
        )}
      </ol>
      {message.timeline.clickedAt && (
        <p className="m-0 text-xs text-wa-muted">
          Abrir el rastreo no prueba que leyó el mensaje en WhatsApp.
        </p>
      )}
      {!message.orderId && (
        <p className="m-0 text-xs text-wa-muted">Este mensaje no tiene un pedido asociado.</p>
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
  const sharedResendReasonId = `${baseId}-resend-reason`;
  const showsSharedResendReason =
    !!resendBlockedReason &&
    page.items.some((message) => isNotSentStatus(message.status) && message.canResend);
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
    <div className="flex flex-col gap-3">
      <div className={waTableWrap}>
        <Table className={waTable}>
          <TableHeader>
            <TableRow className={waTr}>
              <TableHead className={waTh}>Fecha y hora</TableHead>
              <TableHead className={waTh}>Pedido</TableHead>
              <TableHead className={waTh}>Cliente</TableHead>
              <TableHead className={waTh}>Plantilla</TableHead>
              <TableHead className={waTh}>Courier</TableHead>
              <TableHead className={waTh}>Estado</TableHead>
              <TableHead className={waTh}>Rastreo</TableHead>
              <TableHead className={waTh}>
                <span className="sr-only">Acciones</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {page.items.map((message) => {
              const isExpanded = expanded === message.id;
              const panelId = `${baseId}-timeline-${message.id}`;
              const ownReasonId = `${baseId}-resend-${message.id}`;
              const status = rowStatus[message.id] ?? { kind: "idle" };
              const notSent = isNotSentStatus(message.status);
              const ownReason = !message.canResend
                ? (message.resendBlockedReason ?? "POWIP no permite reenviar este aviso.")
                : null;
              const rowReason = ownReason ?? resendBlockedReason;
              const reasonId = ownReason ? ownReasonId : sharedResendReasonId;
              return (
                <Fragment key={message.id}>
                  <TableRow className={cn(waTr, isExpanded && "[&>td]:border-b-0")}>
                    <TableCell className={cn(waTd, "whitespace-nowrap")}>
                      <button
                        type="button"
                        aria-expanded={isExpanded}
                        aria-controls={panelId}
                        onClick={() => setExpanded(isExpanded ? null : message.id)}
                        className="wa-num inline-flex cursor-pointer items-center gap-1.5 rounded text-left outline-none hover:text-wa-primary focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-wa-primary"
                      >
                        {formatLimaDateTime(message.createdAt)}
                        <ChevronDown
                          className={cn(
                            "size-4 text-wa-muted-2 transition-transform",
                            isExpanded && "rotate-180",
                          )}
                          aria-hidden="true"
                        />
                        <span className="sr-only">, ver línea de tiempo</span>
                      </button>
                    </TableCell>
                    <TableCell className={cn(waTd, "whitespace-nowrap")}>
                      <b className="font-semibold">{message.orderNumber ?? "Sin pedido"}</b>
                      <span className="block text-xs text-wa-muted">{message.storeName}</span>
                    </TableCell>
                    <TableCell className={cn(waTd, "min-w-40")}>
                      <span className="block [overflow-wrap:anywhere]">
                        {message.customerName ?? "Sin nombre"}
                      </span>
                      <span className="wa-num block text-xs text-wa-muted">{message.phone}</span>
                    </TableCell>
                    <TableCell className={cn(waTd, waTemplateName, "font-medium")}>
                      {message.templateName ?? "—"}
                    </TableCell>
                    <TableCell className={waTd}>{message.courierName ?? "—"}</TableCell>
                    <TableCell className={cn(waTd, "min-w-40")}>
                      <StatusCell message={message} />
                    </TableCell>
                    <TableCell className={cn(waTd, "whitespace-nowrap")}>
                      {message.timeline.clickedAt ? (
                        <WaPill tone="teal">
                          Abrió {formatLimaTime(message.timeline.clickedAt)}
                        </WaPill>
                      ) : (
                        <span className="text-xs text-wa-muted">—</span>
                      )}
                    </TableCell>
                    <TableCell className={cn(waTd, "whitespace-nowrap text-right")}>
                      {notSent && (
                        <div className="flex flex-col items-end gap-1">
                          <BlockedActionButton
                            className={waButton({ size: "sm" })}
                            blocked={!!rowReason || !onResend || status.kind === "pending"}
                            blockedReasonId={reasonId}
                            onClick={() => resend(message)}
                          >
                            <RotateCw aria-hidden="true" />
                            Reenviar
                            <span className="sr-only">
                              {" "}
                              el aviso a {message.customerName ?? message.phone}
                            </span>
                          </BlockedActionButton>
                          {ownReason && (
                            <p
                              id={ownReasonId}
                              className="m-0 max-w-56 whitespace-normal text-left text-xs text-wa-muted"
                            >
                              {ownReason}
                            </p>
                          )}
                          {status.kind === "pending" && (
                            <p role="status" className="m-0 text-xs text-wa-muted">
                              Reenviando…
                            </p>
                          )}
                          {status.kind === "error" && (
                            <p
                              role="alert"
                              className="m-0 max-w-56 whitespace-normal text-xs text-wa-red"
                            >
                              {status.message}
                            </p>
                          )}
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                  {isExpanded && (
                    <TableRow id={panelId} className={waTr}>
                      <TableCell colSpan={COLUMN_COUNT} className={cn(waTd, "p-0")}>
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
      {showsSharedResendReason && (
        <p id={sharedResendReasonId} className="m-0 text-xs text-wa-muted">
          Reenviar: {resendBlockedReason}
        </p>
      )}
      <nav
        aria-label="Paginación de mensajes"
        className="flex flex-wrap items-center justify-between gap-2 text-[13px]"
      >
        <span className="text-wa-muted">
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
              className={waButton({ size: "sm" })}
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
        <p id={paginationReasonId} className="m-0 text-xs text-wa-muted">
          {paginationBlockedReason}
        </p>
      )}
    </div>
  );
}
