import type { QueryClient } from "@tanstack/react-query";
import { emitSound } from "@/lib/crmSound";
import type {
  Broadcast,
  Conversation,
  ConversationOrder,
  CrmEvent,
  Message,
  MessagePage,
  Task,
} from "@/types/crm";

export interface SseFrame {
  event: string;
  data: string;
}

/**
 * Parser SSE incremental (función pura, sin red). Acepta trozos de texto
 * partidos en cualquier punto; emite un frame por cada línea en blanco.
 */
export function createSseParser(onFrame: (frame: SseFrame) => void) {
  let buffer = "";
  let event = "";
  let data: string[] = [];

  const flush = () => {
    if (data.length > 0 || event) {
      onFrame({ event: event || "message", data: data.join("\n") });
    }
    event = "";
    data = [];
  };

  const processLine = (line: string) => {
    if (line === "") return flush();
    if (line.startsWith(":")) return; // comentario / keep-alive
    const idx = line.indexOf(":");
    const field = idx === -1 ? line : line.slice(0, idx);
    let value = idx === -1 ? "" : line.slice(idx + 1);
    if (value.startsWith(" ")) value = value.slice(1);
    if (field === "event") event = value;
    else if (field === "data") data.push(value);
  };

  return {
    push(chunk: string) {
      buffer += chunk;
      const lines = buffer.split(/\r\n|\n|\r/);
      // La última pieza puede estar incompleta
      buffer = lines.pop() ?? "";
      lines.forEach(processLine);
    },
  };
}

const KNOWN = new Set([
  "message.created",
  "message.status",
  "conversation.updated",
  "conversation.removed",
  "order.linked",
  "sale.updated",
  "task.updated",
  "task.deleted",
  "broadcast.updated",
  "call.permission",
  "call.updated",
]);

/** Convierte un frame crudo en evento tipado; null si es ping, desconocido o JSON roto. */
export function parseCrmEvent(frame: SseFrame): CrmEvent | null {
  if (!KNOWN.has(frame.event)) return null;
  try {
    return { type: frame.event, data: JSON.parse(frame.data) } as CrmEvent;
  } catch {
    return null;
  }
}

export const crmKeys = {
  all: ["crm"] as const,
  conversations: ["crm", "conversations"] as const,
  summary: ["crm", "inbox-summary"] as const,
  me: ["crm", "me"] as const,
  tags: ["crm", "tags"] as const,
  followups: ["crm", "followups"] as const,
  conversationFollowups: (id: string) => ["crm", "followups", id] as const,
  conversation: (id: string) => ["crm", "conversation", id] as const,
  messages: (id: string) => ["crm", "messages", id] as const,
  orders: (id: string) => ["crm", "orders", id] as const,
  quotes: (id: string) => ["crm", "quotes", id] as const,
  pipelines: ["crm", "pipelines"] as const,
  board: (pipelineId: string, assigned: string, storeId?: string) =>
    ["crm", "board", pipelineId, assigned, storeId ?? "all"] as const,
  boards: ["crm", "board"] as const,
  broadcasts: ["crm", "broadcasts"] as const,
  templates: ["crm", "templates"] as const,
  followupRules: ["crm", "followup-rules"] as const,
  followupRuns: ["crm", "followup-runs"] as const,
  followupStats: ["crm", "followup-stats"] as const,
  pauSettings: ["crm", "pau", "settings"] as const,
  pauProviders: ["crm", "pau", "providers"] as const,
  pauUsage: ["crm", "pau", "usage"] as const,
  pauProviderAlerts: ["crm", "pau", "provider-alerts"] as const,
  tasks: ["crm", "tasks"] as const,
  tasksList: (params: { assigned: string; status: string; conversationId?: string }) =>
    ["crm", "tasks", params] as const,
  callSessions: ["crm", "call-sessions"] as const,
  callPermission: (conversationId: string) =>
    ["crm", "call-sessions", "permission", conversationId] as const,
};

/** Agrega un mensaje sin duplicar (por id). */
export function appendMessage(page: MessagePage, message: Message): MessagePage {
  if (page.items.some((m) => m.id === message.id)) return page;
  return { ...page, items: [...page.items, message] };
}

/** Agrega o reemplaza un pedido vinculado (por id), el más reciente primero. */
export function upsertOrder(
  list: ConversationOrder[],
  order: ConversationOrder,
): ConversationOrder[] {
  const rest = list.filter((o) => o.id !== order.id && o.orderId !== order.orderId);
  return [order, ...rest];
}

/** Aplica un evento SSE a la caché de TanStack Query. */
export function applyCrmEvent(queryClient: QueryClient, event: CrmEvent): void {
  switch (event.type) {
    case "message.created": {
      const { conversation, message } = event.data;
      queryClient.setQueryData<Conversation>(
        crmKeys.conversation(conversation.id),
        conversation,
      );
      queryClient.setQueryData<MessagePage>(
        crmKeys.messages(conversation.id),
        (old) => (old ? appendMessage(old, message) : old),
      );
      queryClient.invalidateQueries({ queryKey: crmKeys.conversations });
      queryClient.invalidateQueries({ queryKey: crmKeys.summary });
      queryClient.invalidateQueries({ queryKey: crmKeys.conversationFollowups(conversation.id) });
      if (message.direction === "in" && message.type !== "reaction") {
        emitSound({ event: "msg", conversationId: conversation.id });
      }
      break;
    }
    case "message.status": {
      const { conversationId, messageId, status, errorMessage, hiddenAt } = event.data;
      queryClient.setQueryData<MessagePage>(
        crmKeys.messages(conversationId),
        (old) =>
          old && {
            ...old,
            items: old.items.map((m) =>
              m.id === messageId
                ? {
                    ...m,
                    status,
                    errorMessage: errorMessage ?? null,
                    ...(hiddenAt !== undefined ? { hiddenAt } : {}),
                  }
                : m,
            ),
          },
      );
      break;
    }
    case "conversation.updated": {
      const { conversation } = event.data;
      queryClient.setQueryData<Conversation>(
        crmKeys.conversation(conversation.id),
        conversation,
      );
      queryClient.invalidateQueries({ queryKey: crmKeys.conversations });
      queryClient.invalidateQueries({ queryKey: crmKeys.summary });
      // Puede haber cambiado de etapa: refresca los tableros del Embudo.
      queryClient.invalidateQueries({ queryKey: crmKeys.boards });
      break;
    }
    case "conversation.removed": {
      // El chat pasó a otra persona: ya no es visible para este usuario.
      const { id } = event.data;
      queryClient.removeQueries({ queryKey: crmKeys.conversation(id) });
      queryClient.removeQueries({ queryKey: crmKeys.messages(id) });
      queryClient.invalidateQueries({ queryKey: crmKeys.conversations });
      queryClient.invalidateQueries({ queryKey: crmKeys.summary });
      queryClient.invalidateQueries({ queryKey: crmKeys.boards });
      break;
    }
    case "task.updated": {
      // Las listas dependen de filtros (mías/todas, pendiente/hecha): se refrescan.
      queryClient.invalidateQueries({ queryKey: crmKeys.tasks });
      break;
    }
    case "task.deleted": {
      const { id } = event.data;
      queryClient.setQueriesData<Task[]>({ queryKey: crmKeys.tasks }, (old) =>
        Array.isArray(old) ? old.filter((t) => t.id !== id) : old,
      );
      queryClient.invalidateQueries({ queryKey: crmKeys.tasks });
      break;
    }
    case "broadcast.updated": {
      const { broadcast } = event.data;
      const key = crmKeys.broadcasts;
      if (queryClient.getQueryData<Broadcast[]>(key)) {
        queryClient.setQueryData<Broadcast[]>(key, (old) =>
          old?.some((b) => b.id === broadcast.id)
            ? old.map((b) => (b.id === broadcast.id ? broadcast : b))
            : [broadcast, ...(old ?? [])],
        );
      } else {
        queryClient.invalidateQueries({ queryKey: key });
      }
      break;
    }
    case "order.linked": {
      const { conversationId, order } = event.data;
      const key = crmKeys.orders(conversationId);
      if (queryClient.getQueryData<ConversationOrder[]>(key)) {
        queryClient.setQueryData<ConversationOrder[]>(key, (old) =>
          upsertOrder(old ?? [], order),
        );
      } else {
        queryClient.invalidateQueries({ queryKey: key });
      }
      break;
    }
    case "sale.updated": {
      // Core cambió una cotización o un pedido del chat (pago, verificación, estado).
      const { conversationId } = event.data;
      queryClient.invalidateQueries({ queryKey: crmKeys.quotes(conversationId) });
      queryClient.invalidateQueries({ queryKey: crmKeys.orders(conversationId) });
      queryClient.invalidateQueries({ queryKey: crmKeys.summary });
      break;
    }
    case "call.permission": {
      // El cliente aceptó o negó las llamadas: cambia el botón Llamar.
      const { conversationId } = event.data;
      if (conversationId) {
        queryClient.invalidateQueries({ queryKey: crmKeys.callPermission(conversationId) });
      }
      break;
    }
    case "call.updated": {
      queryClient.invalidateQueries({ queryKey: crmKeys.callSessions });
      break;
    }
  }
}
