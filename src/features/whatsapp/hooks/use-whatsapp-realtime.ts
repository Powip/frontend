"use client";

import { type QueryClient, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { API } from "@/lib/api";
import { createSseParser, type SseFrame } from "@/lib/crmSse";
import { tokenStore } from "@/lib/tokenStore";
import { assertWhatsAppContractAvailable } from "../constants/whatsapp-contracts";
import { whatsappKeys } from "../keys/whatsapp.keys";

/** Eventos de GET /wa/events (C-00.9) que refrescan pantallas del módulo. */
export const WHATSAPP_REALTIME_EVENTS = [
  "thread.updated",
  "message.status",
  "assisted.updated",
  "alert.created",
  "notification.created",
  "connection.updated",
] as const;

export type WhatsAppRealtimeEventType = (typeof WHATSAPP_REALTIME_EVENTS)[number];

const KNOWN = new Set<string>(WHATSAPP_REALTIME_EVENTS);

export function parseWhatsAppRealtimeFrame(
  frame: SseFrame,
): { type: WhatsAppRealtimeEventType; data: Record<string, unknown> } | null {
  if (!KNOWN.has(frame.event)) return null;
  try {
    const data = JSON.parse(frame.data) as Record<string, unknown>;
    return { type: frame.event as WhatsAppRealtimeEventType, data };
  } catch {
    return null;
  }
}

/** Qué cachés de TanStack invalida cada evento (las claves son prefijos). */
export function applyWhatsAppRealtimeEvent(
  queryClient: QueryClient,
  companyId: string,
  event: { type: WhatsAppRealtimeEventType; data: Record<string, unknown> },
): void {
  const company = whatsappKeys.company(companyId);
  switch (event.type) {
    case "thread.updated": {
      queryClient.invalidateQueries({ queryKey: [...company, "conversations"] });
      const threadId = typeof event.data.threadId === "string" ? event.data.threadId : null;
      if (threadId) queryClient.invalidateQueries({ queryKey: whatsappKeys.thread(companyId, threadId) });
      queryClient.invalidateQueries({ queryKey: [...company, "threads-by-order"] });
      break;
    }
    case "message.status":
      queryClient.invalidateQueries({ queryKey: [...company, "conversations"] });
      queryClient.invalidateQueries({ queryKey: [...company, "thread"] });
      queryClient.invalidateQueries({ queryKey: ["whatsapp", "history"] });
      queryClient.invalidateQueries({ queryKey: ["whatsapp", "test-run"] });
      break;
    case "assisted.updated":
      queryClient.invalidateQueries({ queryKey: ["whatsapp", "assisted-queue"] });
      break;
    case "alert.created":
      queryClient.invalidateQueries({ queryKey: ["whatsapp", "alerts"] });
      queryClient.invalidateQueries({ queryKey: ["whatsapp", "notifications"] });
      break;
    case "notification.created":
      queryClient.invalidateQueries({ queryKey: ["whatsapp", "notifications"] });
      break;
    case "connection.updated":
      queryClient.invalidateQueries({ queryKey: ["whatsapp", "status"] });
      queryClient.invalidateQueries({ queryKey: ["whatsapp", "accounts"] });
      break;
  }
}

/**
 * Se suscribe a GET /wa/events con fetch + Authorization (igual que el chat del CRM).
 * Reconecta con espera creciente; al volver refresca lo que pudo perderse.
 */
export function useWhatsAppRealtime(companyId: string | null, enabled = true): void {
  const queryClient = useQueryClient();
  const clientRef = useRef(queryClient);
  clientRef.current = queryClient;

  useEffect(() => {
    // Sin URL base de ms-integrations (pruebas, entorno sin configurar) no se abre la conexión.
    if (!enabled || !companyId || !API.integrations) return;
    assertWhatsAppContractAvailable("realtime");
    const controller = new AbortController();
    let delay = 1000;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const connect = async () => {
      try {
        const token = tokenStore.get();
        const response = await fetch(`${API.integrations}/wa/events`, {
          headers: {
            Accept: "text/event-stream",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          signal: controller.signal,
          cache: "no-store",
        });
        if (!response.ok || !response.body) throw new Error(`SSE ${response.status}`);
        delay = 1000;
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        const parser = createSseParser((frame) => {
          const event = parseWhatsAppRealtimeFrame(frame);
          if (event) applyWhatsAppRealtimeEvent(clientRef.current, companyId, event);
        });
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          parser.push(decoder.decode(value, { stream: true }));
        }
      } catch {
        if (controller.signal.aborted) return;
      }
      if (controller.signal.aborted) return;
      timer = setTimeout(() => {
        clientRef.current.invalidateQueries({ queryKey: whatsappKeys.company(companyId) });
        void connect();
      }, delay);
      delay = Math.min(delay * 2, 30_000);
    };

    void connect();
    return () => {
      controller.abort();
      if (timer) clearTimeout(timer);
    };
  }, [companyId, enabled]);
}
