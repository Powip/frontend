"use client";

import { ExternalLink } from "lucide-react";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { BlockedActionButton } from "@/components/whatsapp/BlockedActionButton";
import { WaDialogClose } from "@/components/whatsapp/ui/WaDialogClose";
import { WaMini, WaPill } from "@/components/whatsapp/ui/WaPill";
import {
  waButton,
  waDialogBody,
  waDialogContent,
  waDialogFooter,
  waDialogHeader,
  waDialogTitle,
  waLabel,
  waTextarea,
} from "@/components/whatsapp/ui/wa-classes";
import { WhatsAppResourceState } from "@/components/whatsapp/WhatsAppResourceState";
import { ASSISTED_STATUS_LABELS } from "@/features/whatsapp/constants/whatsapp-connection-catalog";
import { WHATSAPP_ASSISTED_STATUSES } from "@/features/whatsapp/enums/whatsapp.enums";
import type {
  WhatsAppAssistedItem,
  WhatsAppAssistedQueue,
} from "@/features/whatsapp/models/connection.model";
import type { WhatsAppResourceState as ResourceState } from "@/features/whatsapp/models/resource-state.model";
import { cn } from "@/lib/utils";
import { type ActionState, type ConnectionMutations, errorMessage } from "./connection-types";

const NO_LINK_REASON = "POWIP no generó el enlace de WhatsApp para este aviso.";

function DiscardDialog({
  item,
  blockedReason,
  discard,
  onClose,
}: {
  item: WhatsAppAssistedItem;
  blockedReason: string | null;
  discard: ConnectionMutations["discardAssisted"];
  onClose: () => void;
}) {
  const reasonId = useId();
  const fieldId = useId();
  const [reason, setReason] = useState("");
  const [state, setState] = useState<ActionState>({ kind: "idle" });
  const blocked =
    !!blockedReason || !discard || reason.trim().length < 3 || state.kind === "pending";

  const confirm = async () => {
    if (blocked || !discard) return;
    setState({ kind: "pending" });
    try {
      await discard({ itemId: item.id, reason: reason.trim() });
      onClose();
    } catch (caught) {
      setState({ kind: "error", message: errorMessage(caught, "No se pudo descartar.") });
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent showCloseButton={false} className={cn(waDialogContent, "sm:max-w-[480px]")}>
        <DialogHeader className={waDialogHeader}>
          <DialogTitle className={waDialogTitle}>Descartar aviso asistido</DialogTitle>
          <WaDialogClose />
        </DialogHeader>
        <div className={cn(waDialogBody, "flex flex-col gap-3.5")}>
          <DialogDescription className="m-0 text-sm text-wa-muted">
            El aviso del pedido {item.orderNumber ?? "sin número"} no se enviará. Queda registrado
            quién lo descartó y por qué.
          </DialogDescription>
          <div className="flex flex-col gap-1.5">
            <label htmlFor={fieldId} className={waLabel}>
              Motivo
            </label>
            <Textarea
              id={fieldId}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={2}
              className={cn(waTextarea, "min-h-[70px]")}
            />
          </div>
          {state.kind === "error" && (
            <p role="alert" className="m-0 text-[13px] text-wa-red">
              {state.message}
            </p>
          )}
          <p id={reasonId} className="m-0 text-xs text-wa-muted">
            {blockedReason ?? "Escribe el motivo para descartar."}
          </p>
        </div>
        <DialogFooter className={waDialogFooter}>
          <Button type="button" className={waButton()} onClick={onClose}>
            Cancelar
          </Button>
          <BlockedActionButton
            className={waButton({ variant: "solid-danger" })}
            blocked={blocked}
            blockedReasonId={reasonId}
            onClick={confirm}
          >
            Descartar
          </BlockedActionButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AssistedRow({
  item,
  blockedReason,
  blockedReasonId,
  mutations,
  onDiscard,
}: {
  item: WhatsAppAssistedItem;
  blockedReason: string | null;
  blockedReasonId: string;
  mutations: Pick<ConnectionMutations, "markAssistedOpened" | "markAssistedSent">;
  onDiscard: () => void;
}) {
  const linkReasonId = useId();
  const [state, setState] = useState<ActionState>({ kind: "idle" });
  const closed =
    item.status === WHATSAPP_ASSISTED_STATUSES.MARKED_SENT ||
    item.status === WHATSAPP_ASSISTED_STATUSES.DISCARDED;

  const markSent = async () => {
    if (blockedReason || !mutations.markAssistedSent || state.kind === "pending") return;
    setState({ kind: "pending" });
    try {
      await mutations.markAssistedSent(item.id);
      setState({ kind: "idle" });
    } catch (caught) {
      setState({ kind: "error", message: errorMessage(caught, "No se pudo marcar como enviado.") });
    }
  };

  return (
    <li className="flex flex-col gap-2 border-t border-wa-border py-3 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-[180px] flex-1 text-[13px]">
          <p className="m-0 font-semibold [overflow-wrap:anywhere]">
            {item.orderNumber ?? "Sin pedido"} · {item.customerName ?? item.phone}
          </p>
          <p className="m-0 text-xs text-wa-muted">
            {[item.templateName, item.courierName].filter(Boolean).join(" · ") ||
              "Sin plantilla informada"}
          </p>
          <WaMini
            tone={item.status === WHATSAPP_ASSISTED_STATUSES.OPENED ? "warn" : "neutral"}
            className="mt-1"
          >
            {ASSISTED_STATUS_LABELS[item.status]}
            {item.openedBy && item.status === WHATSAPP_ASSISTED_STATUSES.OPENED
              ? ` por ${item.openedBy.name}`
              : ""}
          </WaMini>
        </div>
        {!closed && (
          <div className="flex flex-wrap items-center gap-1.5">
            {item.waMeUrl ? (
              <Button asChild className={waButton({ variant: "whatsapp", size: "sm" })}>
                <a
                  href={item.waMeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => {
                    void mutations.markAssistedOpened?.(item.id).catch(() => undefined);
                  }}
                >
                  <ExternalLink aria-hidden="true" />
                  Abrir en WhatsApp
                  <span className="sr-only"> (se abre en otra pestaña)</span>
                </a>
              </Button>
            ) : (
              <BlockedActionButton
                className={waButton({ variant: "whatsapp", size: "sm" })}
                blocked
                blockedReasonId={linkReasonId}
              >
                Abrir en WhatsApp
              </BlockedActionButton>
            )}
            <BlockedActionButton
              className={waButton({ size: "sm" })}
              blocked={!!blockedReason || state.kind === "pending"}
              blockedReasonId={blockedReasonId}
              onClick={markSent}
            >
              Ya lo envié
            </BlockedActionButton>
            <Button
              type="button"
              className={waButton({ variant: "ghost", size: "sm" })}
              onClick={onDiscard}
            >
              Descartar
            </Button>
          </div>
        )}
      </div>
      {!closed && !item.waMeUrl && (
        <p id={linkReasonId} className="m-0 text-xs text-wa-muted">
          {NO_LINK_REASON}
        </p>
      )}
      {state.kind === "error" && (
        <p role="alert" className="m-0 text-xs text-wa-red">
          {state.message}
        </p>
      )}
    </li>
  );
}

interface AssistedQueueSectionProps {
  queue: ResourceState<WhatsAppAssistedQueue>;
  contingencyActive: boolean | null;
  blockedReason: string | null;
  mutations: Pick<
    ConnectionMutations,
    "markAssistedOpened" | "markAssistedSent" | "discardAssisted"
  >;
  onRetry?: () => void;
}

export function AssistedQueueSection({
  queue,
  contingencyActive,
  blockedReason,
  mutations,
  onRetry,
}: AssistedQueueSectionProps) {
  const reasonId = useId();
  const [discarding, setDiscarding] = useState<WhatsAppAssistedItem | null>(null);
  const pendingTotal = queue.kind === "ready" ? queue.data.pendingTotal : null;
  return (
    <section aria-labelledby="assisted-title" className="flex min-w-0 flex-col gap-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <h3 id="assisted-title" className="m-0 text-sm font-semibold">
          Bandeja de envío asistido
        </h3>
        {pendingTotal !== null && (
          <WaPill className="wa-num">{pendingTotal.toLocaleString("es-PE")} por enviar</WaPill>
        )}
      </div>
      <WhatsAppResourceState
        state={queue}
        pendingTitle="Bandeja pendiente de integración"
        pendingDescription="Los avisos aparecerán aquí cuando la contingencia esté activa y POWIP los genere."
        loadingLabel="Cargando la bandeja"
        errorTitle="No se pudo cargar la bandeja"
        onRetry={onRetry}
        isEmpty={(data) => data.items.length === 0}
        empty={
          <p className="m-0 text-[13px] text-wa-muted">
            {contingencyActive === false
              ? "No hay mensajes por enviar. La bandeja se llena cuando la contingencia está activa."
              : "No hay mensajes por enviar."}
          </p>
        }
      >
        {(data) => (
          <div className="flex flex-col gap-2">
            <ul className="m-0 list-none p-0">
              {data.items.map((item) => (
                <AssistedRow
                  key={item.id}
                  item={item}
                  blockedReason={blockedReason}
                  blockedReasonId={reasonId}
                  mutations={mutations}
                  onDiscard={() => setDiscarding(item)}
                />
              ))}
            </ul>
            {data.hasMore && (
              <p className="m-0 text-xs text-wa-muted">
                Hay más avisos por enviar; se muestran cuando POWIP los pagine.
              </p>
            )}
            {blockedReason && (
              <p id={reasonId} className="m-0 text-xs text-wa-muted">
                «Ya lo envié»: {blockedReason}
              </p>
            )}
          </div>
        )}
      </WhatsAppResourceState>
      <p className="m-0 text-xs text-wa-muted">
        El mensaje se abre en el celular con el texto y el link de rastreo listos. Abrir WhatsApp no
        confirma el envío: la fila cambia recién cuando tocas «Ya lo envié» y POWIP lo registra. En
        contingencia no hay estados de entrega ni de lectura.
      </p>
      {discarding && (
        <DiscardDialog
          item={discarding}
          blockedReason={blockedReason}
          discard={mutations.discardAssisted}
          onClose={() => setDiscarding(null)}
        />
      )}
    </section>
  );
}
