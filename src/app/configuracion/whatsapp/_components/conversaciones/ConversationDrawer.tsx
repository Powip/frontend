"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WhatsAppResourceState } from "@/components/whatsapp/WhatsAppResourceState";
import type { WhatsAppConversationDetail } from "@/features/whatsapp/models/conversation.model";
import type { WhatsAppResourceState as ResourceState } from "@/features/whatsapp/models/resource-state.model";
import { describeConversationContext, getConversationTitle } from "./ConversationCard";
import { ConversationPanel } from "./ConversationPanel";

type PanelProps = Omit<Parameters<typeof ConversationPanel>[0], "conversation">;

interface ConversationDrawerProps extends PanelProps {
  conversationId: string | null;
  detail: ResourceState<WhatsAppConversationDetail>;
  onRequestClose: () => void;
  onRetry?: () => void;
}

export function ConversationDrawer({
  conversationId,
  detail,
  onRequestClose,
  onRetry,
  ...panelProps
}: ConversationDrawerProps) {
  const ready = detail.kind === "ready" ? detail.data : null;
  const title = ready ? getConversationTitle(ready) : "Conversación";

  return (
    <DialogPrimitive.Root
      open={conversationId !== null}
      onOpenChange={(open) => {
        if (!open) onRequestClose();
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content className="fixed inset-y-0 right-0 z-50 flex h-dvh w-full flex-col bg-background shadow-xl outline-none data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:animate-in data-[state=open]:slide-in-from-right sm:max-w-[480px] sm:border-l">
          <div className="flex shrink-0 items-start justify-between gap-3 border-b px-4 py-3">
            <div className="min-w-0 space-y-0.5">
              <DialogPrimitive.Title className="truncate text-base font-semibold">
                {title}
              </DialogPrimitive.Title>
              <DialogPrimitive.Description className="truncate text-xs text-muted-foreground">
                {ready ? describeConversationContext(ready) : "Detalle de la conversación"}
              </DialogPrimitive.Description>
            </div>
            <DialogPrimitive.Close asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                aria-label="Cerrar conversación"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </Button>
            </DialogPrimitive.Close>
          </div>
          {ready ? (
            <ConversationPanel key={ready.id} conversation={ready} {...panelProps} />
          ) : (
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              <WhatsAppResourceState
                state={detail}
                pendingTitle="Conversación pendiente de integración"
                pendingDescription="El detalle de la conversación se mostrará cuando el servicio de WhatsApp de POWIP esté disponible."
                loadingLabel="Cargando la conversación"
                errorTitle="No se pudo cargar la conversación"
                onRetry={onRetry}
              >
                {() => null}
              </WhatsAppResourceState>
            </div>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
