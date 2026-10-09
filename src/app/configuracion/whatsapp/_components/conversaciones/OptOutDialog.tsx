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
import { CONVERSATION_LIMITS } from "@/features/whatsapp/constants/whatsapp-conversation-catalog";
import type { WhatsAppConversationDetail } from "@/features/whatsapp/models/conversation.model";
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Dar de baja a este comprador</DialogTitle>
          <DialogDescription>
            {`${getConversationTitle(conversation)} (${conversation.phone}) no recibirá más avisos de ${conversation.storeName}. Solo se reactiva si el cliente lo pide.`}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <label htmlFor={reasonId} className="text-sm font-medium">
            Motivo (opcional)
          </label>
          <Textarea
            id={reasonId}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={2}
            aria-invalid={tooLong ? true : undefined}
          />
          {tooLong && (
            <p className="text-xs font-medium text-destructive">
              Máximo {CONVERSATION_LIMITS.optOutReasonMaxLength} caracteres.
            </p>
          )}
          {status.kind === "error" && (
            <p role="alert" className="text-xs font-medium text-red-700 dark:text-red-300">
              {status.message}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <BlockedActionButton
            variant="destructive"
            blocked={!optOut || tooLong || status.kind === "pending"}
            blockedReasonId={blockedId}
            onClick={confirm}
          >
            Dar de baja
          </BlockedActionButton>
        </DialogFooter>
        {!optOut && (
          <p id={blockedId} className="text-xs text-muted-foreground">
            {CONVERSATION_PENDING_REASON}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
