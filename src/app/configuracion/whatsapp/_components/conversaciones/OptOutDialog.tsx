"use client";

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
import { CONVERSATION_LIMITS } from "@/features/whatsapp/constants/whatsapp-conversation-catalog";
import type { WhatsAppConversationDetail } from "@/features/whatsapp/models/conversation.model";
import { cn } from "@/lib/utils";
import { getConversationTitle } from "./ConversationCard";
import {
  type ActionStatus,
  CONVERSATION_PENDING_REASON,
  type ConversationMutations,
  IDLE,
  toActionError,
} from "./conversation-types";

interface OptOutDialogProps {
  conversation: WhatsAppConversationDetail;
  optOut: ConversationMutations["optOut"];
  onClose: () => void;
}

export function OptOutDialog({ conversation, optOut, onClose }: OptOutDialogProps) {
  const reasonId = useId();
  const blockedId = useId();
  const [reason, setReason] = useState("");
  const [status, setStatus] = useState<ActionStatus>(IDLE);
  const tooLong = reason.length > CONVERSATION_LIMITS.optOutReasonMaxLength;

  const confirm = async () => {
    if (!optOut || tooLong || status.kind === "pending") return;
    setStatus({ kind: "pending" });
    try {
      await optOut({
        conversationId: conversation.id,
        phone: conversation.phone,
        storeId: conversation.storeId,
        reason: reason.trim() || null,
      });
      onClose();
    } catch (caught) {
      setStatus(toActionError(caught, "No se pudo dar de baja al comprador."));
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent showCloseButton={false} className={cn(waDialogContent, "sm:max-w-[480px]")}>
        <DialogHeader className={waDialogHeader}>
          <DialogTitle className={waDialogTitle}>Dar de baja a este comprador</DialogTitle>
          <WaDialogClose />
        </DialogHeader>
        <div className={cn(waDialogBody, "flex flex-col gap-1.5")}>
          <DialogDescription className="m-0 mb-2 text-sm text-wa-muted">
            {`${getConversationTitle(conversation)} (${conversation.phone}) no recibirá más avisos de ${conversation.storeName}. Solo se reactiva si el cliente lo pide.`}
          </DialogDescription>
          <label htmlFor={reasonId} className={waLabel}>
            Motivo (opcional)
          </label>
          <Textarea
            id={reasonId}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={2}
            className={cn(waTextarea, "min-h-[70px]")}
            aria-invalid={tooLong ? true : undefined}
          />
          {tooLong && (
            <p className="m-0 text-xs font-medium text-wa-red">
              Máximo {CONVERSATION_LIMITS.optOutReasonMaxLength} caracteres.
            </p>
          )}
          {status.kind === "error" && (
            <p role="alert" className="m-0 text-xs font-medium text-wa-red">
              {status.message}
            </p>
          )}
          {!optOut && (
            <p id={blockedId} className="m-0 text-xs text-wa-muted">
              {CONVERSATION_PENDING_REASON}
            </p>
          )}
        </div>
        <DialogFooter className={waDialogFooter}>
          <Button type="button" className={waButton()} onClick={onClose}>
            Cancelar
          </Button>
          <BlockedActionButton
            className={waButton({ variant: "solid-danger" })}
            blocked={!optOut || tooLong || status.kind === "pending"}
            blockedReasonId={blockedId}
            onClick={confirm}
          >
            Dar de baja
          </BlockedActionButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
