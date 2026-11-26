"use client";

import { MessagesSquare } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { getWhatsAppConversationsByOrder } from "@/features/whatsapp/api/threads.api";
import { isWhatsAppContractAvailable } from "@/features/whatsapp/constants/whatsapp-contracts";
import type { WhatsAppConversationDetail } from "@/features/whatsapp/models/conversation.model";
import type { WhatsAppResourceState as ResourceState } from "@/features/whatsapp/models/resource-state.model";
import { MessageStatusTicks } from "./MessageStatusTicks";
import { WhatsAppResourceState } from "./WhatsAppResourceState";
import { WhatsAppThread } from "./WhatsAppThread";

export function buildConversationHref(conversationId: string): string {
  const params = new URLSearchParams({ tab: "conversaciones", thread: conversationId });
  return `/configuracion/whatsapp?${params.toString()}`;
}

interface OrderWhatsAppMessagesViewProps {
  threads: ResourceState<WhatsAppConversationDetail[]>;
  now?: Date;
  onRetry?: () => void;
}

export function OrderWhatsAppMessagesView({
  threads,
  now,
  onRetry,
}: OrderWhatsAppMessagesViewProps) {
  return (
    <section
      aria-labelledby="order-whatsapp-title"
      className="space-y-3 rounded-xl border border-border bg-card p-4"
    >
      <h3 id="order-whatsapp-title" className="flex items-center gap-2 font-semibold">
        <MessagesSquare className="h-4 w-4" aria-hidden="true" />
        Mensajes de WhatsApp
      </h3>
      {threads.kind === "pending-integration" ? (
        <p className="text-sm text-muted-foreground">
          Pendiente de integración: los avisos de WhatsApp de este pedido se verán aquí cuando el
          servicio de POWIP esté disponible.
        </p>
      ) : (
        <WhatsAppResourceState
          state={threads}
          pendingTitle=""
          loadingLabel="Cargando mensajes de WhatsApp"
          errorTitle="No se pudieron cargar los mensajes de WhatsApp"
          onRetry={onRetry}
          isEmpty={(data) => data.length === 0}
          empty={
            <p className="text-sm text-muted-foreground">
              Aún no se enviaron avisos por WhatsApp para este pedido.
            </p>
          }
        >
          {(data) => (
            <div className="space-y-4">
              {data.map((thread) => (
                <div key={thread.id} className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{thread.phone}</span>
                      {thread.lastOutbound && (
                        <MessageStatusTicks status={thread.lastOutbound.status} />
                      )}
                      {thread.attention.pendingReply && (
                        <span className="rounded-full bg-red-600 px-2 py-0.5 text-[11px] font-semibold text-white">
                          Respondió
                        </span>
                      )}
                    </span>
                    <Link
                      href={buildConversationHref(thread.id)}
                      className="text-sm font-medium text-primary underline-offset-2 hover:underline"
                    >
                      Abrir conversación
                      <span className="sr-only"> con {thread.phone}</span>
                    </Link>
                  </div>
                  <WhatsAppThread
                    messages={thread.messages}
                    now={now}
                    className="max-h-96 overflow-y-auto"
                  />
                </div>
              ))}
            </div>
          )}
        </WhatsAppResourceState>
      )}
    </section>
  );
}

const PENDING = { kind: "pending-integration" } as const;
const NO_STORE_NAMES: ReadonlyMap<string, string> = new Map();

export function OrderWhatsAppMessages({ orderId }: { orderId: string | null | undefined }) {
  const available = isWhatsAppContractAvailable("threads");
  const [threads, setThreads] = useState<ResourceState<WhatsAppConversationDetail[]>>(
    available ? { kind: "loading" } : PENDING,
  );
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  useEffect(() => {
    if (!orderId || !available) return;
    let alive = true;
    setThreads({ kind: "loading" });
    getWhatsAppConversationsByOrder(orderId, NO_STORE_NAMES)
      .then((data) => alive && setThreads({ kind: "ready", data }))
      .catch((error: Error & { status?: number }) => {
        if (!alive) return;
        setThreads(
          error.status === 403
            ? { kind: "forbidden" }
            : { kind: "error", message: error.message || "No se pudieron cargar los mensajes." },
        );
      });
    return () => {
      alive = false;
    };
  }, [orderId, available, attempt]);

  if (!orderId) return null;
  return <OrderWhatsAppMessagesView threads={threads} onRetry={retry} />;
}
