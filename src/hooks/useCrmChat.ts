"use client";
import { toLocalPhone } from "@/lib/crmPhone";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";
import axiosAuth from "@/lib/axiosAuth";
import { GATEWAY } from "@/lib/gateway";
import { fetchClientByPhone } from "@/services/clients.service";
import type { OrderHeader } from "@/interfaces/IOrder";
import { API } from "@/lib/api";
import { tokenStore } from "@/lib/tokenStore";
import {
  applyCrmEvent,
  createSseParser,
  crmKeys,
  parseCrmEvent,
} from "@/lib/crmSse";
import {
  crmError,
  getConversation,
  getInboxSummary,
  listConversationFollowups,
  listConversationOrders,
  listConversations,
  listMessages,
  listTags,
  markConversationRead,
  sendConversationTemplate,
  sendMessage,
  sendNote,
  updateConversation,
} from "@/services/crmService";
import type {
  Conversation,
  ConversationListParams,
  Message,
  MessagePage,
  SendTemplateInput,
  UpdateConversationInput,
} from "@/types/crm";

export function useConversations(params: ConversationListParams) {
  return useQuery({
    queryKey: [...crmKeys.conversations, params],
    queryFn: ({ signal }) => listConversations(params, signal),
    retry: false,
    placeholderData: (prev) => prev,
  });
}

export function useConversation(id: string | null) {
  return useQuery({
    queryKey: crmKeys.conversation(id ?? ""),
    queryFn: () => getConversation(id!),
    enabled: !!id,
    retry: false,
  });
}

export function useMessages(id: string | null) {
  return useQuery({
    queryKey: crmKeys.messages(id ?? ""),
    queryFn: () => listMessages(id!, { limit: 50 }),
    enabled: !!id,
    retry: false,
  });
}

/** Carga mensajes anteriores y los antepone en la caché. */
export function useLoadOlder(conversationId: string) {
  const qc = useQueryClient();
  const [loading, setLoading] = useState(false);
  const load = useCallback(async () => {
    const current = qc.getQueryData<MessagePage>(crmKeys.messages(conversationId));
    const first = current?.items[0];
    if (!current || !first || loading) return;
    setLoading(true);
    try {
      const older = await listMessages(conversationId, {
        before: first.createdAt,
        limit: 50,
      });
      qc.setQueryData<MessagePage>(crmKeys.messages(conversationId), (old) => {
        if (!old) return old;
        const known = new Set(old.items.map((m) => m.id));
        return {
          hasMore: older.hasMore,
          items: [...older.items.filter((m) => !known.has(m.id)), ...old.items],
        };
      });
    } catch (err) {
      toast.error(crmError(err).message);
    } finally {
      setLoading(false);
    }
  }, [qc, conversationId, loading]);
  return { load, loading };
}

function patchMessage(
  qc: ReturnType<typeof useQueryClient>,
  conversationId: string,
  fn: (items: Message[]) => Message[],
) {
  qc.setQueryData<MessagePage>(crmKeys.messages(conversationId), (old) =>
    old ? { ...old, items: fn(old.items) } : old,
  );
}

/** Envío optimista: aparece de inmediato como «sending» y se corrige al responder. */
export function useSendMessage(
  conversationId: string,
  sender: { id?: string; name?: string },
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ body }: { body: string; tempId: string }) =>
      sendMessage(conversationId, body),
    onMutate: ({ body, tempId }) => {
      const temp: Message = {
        id: tempId,
        conversationId,
        direction: "out",
        type: "text",
        body,
        status: "sending",
        senderKind: "agent",
        senderUserId: sender.id ?? null,
        senderName: sender.name ?? null,
        errorMessage: null,
        createdAt: new Date().toISOString(),
      };
      patchMessage(qc, conversationId, (items) => [...items, temp]);
    },
    onSuccess: (real, { tempId }) => {
      patchMessage(qc, conversationId, (items) => {
        // El evento SSE pudo traer ya el mensaje real: no duplicar.
        const withoutTemp = items.filter((m) => m.id !== tempId);
        return withoutTemp.some((m) => m.id === real.id)
          ? withoutTemp
          : [...withoutTemp, real];
      });
      qc.invalidateQueries({ queryKey: crmKeys.conversations });
      qc.invalidateQueries({ queryKey: crmKeys.conversation(conversationId) });
    },
    onError: (err, { tempId }) => {
      const e = crmError(err);
      const channel = qc.getQueryData<Conversation>(crmKeys.conversation(conversationId))?.channel;
      const reason =
        e.code === "WINDOW_CLOSED"
          ? channel && channel !== "whatsapp"
            ? "Pasaron 7 días desde el último mensaje del cliente."
            : "Pasaron 24 h desde el último mensaje del cliente."
          : e.message;
      patchMessage(qc, conversationId, (items) =>
        items.map((m) =>
          m.id === tempId ? { ...m, status: "failed", errorMessage: reason } : m,
        ),
      );
      if (e.code === "WINDOW_CLOSED") {
        qc.invalidateQueries({ queryKey: crmKeys.conversation(conversationId) });
      }
      toast.error(reason);
    },
  });
}

/** Agrega el mensaje real a la caché sin duplicarlo (el SSE pudo traerlo antes). */
function appendReal(qc: ReturnType<typeof useQueryClient>, conversationId: string, real: Message) {
  patchMessage(qc, conversationId, (items) =>
    items.some((m) => m.id === real.id) ? items : [...items, real],
  );
  qc.invalidateQueries({ queryKey: crmKeys.conversations });
  qc.invalidateQueries({ queryKey: crmKeys.conversation(conversationId) });
}

/** Nota interna: no se envía al cliente y sirve con la ventana cerrada. */
export function useSendNote(conversationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: string) => sendNote(conversationId, body),
    onSuccess: (real) => appendReal(qc, conversationId, real),
    onError: (err) => toast.error(crmError(err).message),
  });
}

/** Plantilla de WhatsApp con la ventana cerrada (Meta cobra el envío). */
export function useSendTemplate(conversationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SendTemplateInput) => sendConversationTemplate(conversationId, input),
    onSuccess: (real) => {
      appendReal(qc, conversationId, real);
      toast.success("Plantilla enviada");
    },
    onError: (err) => toast.error(crmError(err).message),
  });
}

/** Conteos de los indicadores. Se refresca con el SSE y cada 60 s. */
export function useInboxSummary() {
  return useQuery({
    queryKey: crmKeys.summary,
    queryFn: getInboxSummary,
    retry: false,
    refetchInterval: 60_000,
  });
}

/** Etiquetas ya usadas por la empresa, para sugerir. */
export function useCrmTags(enabled = true) {
  return useQuery({
    queryKey: crmKeys.tags,
    queryFn: listTags,
    enabled,
    retry: false,
    staleTime: 60_000,
  });
}

/** Próximos seguimientos automáticos del chat. */
export function useConversationFollowups(id: string | null) {
  return useQuery({
    queryKey: crmKeys.conversationFollowups(id ?? ""),
    queryFn: () => listConversationFollowups(id!),
    enabled: !!id,
    retry: false,
  });
}

export function useMarkRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => markConversationRead(id),
    onSuccess: (conv) => {
      qc.setQueryData<Conversation>(crmKeys.conversation(conv.id), conv);
      qc.invalidateQueries({ queryKey: crmKeys.conversations });
    },
  });
}

export function useUpdateConversation(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateConversationInput) => updateConversation(id, input),
    onSuccess: (conv) => {
      qc.setQueryData<Conversation>(crmKeys.conversation(id), conv);
      qc.invalidateQueries({ queryKey: crmKeys.conversations });
      qc.invalidateQueries({ queryKey: crmKeys.boards });
      qc.invalidateQueries({ queryKey: crmKeys.summary });
      qc.invalidateQueries({ queryKey: crmKeys.tags });
      qc.invalidateQueries({ queryKey: crmKeys.conversationFollowups(id) });
    },
    onError: (err) => toast.error(crmError(err).message),
  });
}

export function useConversationOrders(id: string | null) {
  return useQuery({
    queryKey: crmKeys.orders(id ?? ""),
    queryFn: () => listConversationOrders(id!),
    enabled: !!id,
    retry: false,
  });
}

/** Pedido real de Core (total, estado, pagos). Si falla, la UI usa el número guardado. */
export function useCoreOrder(orderId: string) {
  return useQuery({
    queryKey: ["crm", "core-order", orderId] as const,
    queryFn: async () =>
      (await axiosAuth.get<OrderHeader>(`${GATEWAY.ventas}/order-header/${orderId}`)).data,
    retry: false,
  });
}

/** Busca en Core el cliente que tiene el teléfono de la conversación (null = no existe). */
export function useConversationClient(companyId: string | undefined, phone: string | undefined) {
  // WhatsApp entrega el número con código de país («51987654321»); Clientes
  // guarda los peruanos con 9 dígitos, así que se busca en ese formato.
  const localPhone = phone ? toLocalPhone(phone) : "";
  return useQuery({
    queryKey: ["crm", "client", companyId ?? "", localPhone] as const,
    queryFn: () => fetchClientByPhone(companyId!, localPhone),
    enabled: !!companyId && !!localPhone,
    retry: false,
  });
}

/**
 * Guarda el vínculo conversación → cliente cuando el cliente existe en Core y
 * la conversación aún no apunta a él. Un solo intento por cliente; sin avisos
 * (es un efecto de fondo, no una acción del usuario).
 */
export function useAutoLinkClient(
  conversation: Conversation | undefined,
  clientId: string | undefined,
) {
  const qc = useQueryClient();
  const tried = useRef<string | null>(null);
  const { mutate } = useMutation({
    mutationFn: ({ id, clientId: cid }: { id: string; clientId: string }) =>
      updateConversation(id, { clientId: cid }),
    onSuccess: (conv) => {
      qc.setQueryData<Conversation>(crmKeys.conversation(conv.id), conv);
    },
  });
  const convId = conversation?.id;
  const linked = conversation?.clientId;
  useEffect(() => {
    if (!convId || !clientId || linked === clientId) return;
    const key = `${convId}:${clientId}`;
    if (tried.current === key) return;
    tried.current = key;
    mutate({ id: convId, clientId });
  }, [convId, clientId, linked, mutate]);
}

export type LiveState = "live" | "reconnecting";

/**
 * Tiempo real vía SSE con fetch (EventSource no permite header Authorization).
 * Reconecta con backoff y se aborta al desmontar.
 */
export function useCrmEvents(enabled = true): LiveState {
  const qc = useQueryClient();
  const [state, setState] = useState<LiveState>("reconnecting");
  const qcRef = useRef(qc);
  qcRef.current = qc;

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    let delay = 1000;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const connect = async () => {
      try {
        const token = tokenStore.get();
        const res = await fetch(`${API.crm}/crm/events`, {
          headers: {
            Accept: "text/event-stream",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          signal: controller.signal,
          cache: "no-store",
        });
        if (!res.ok || !res.body) throw new Error(`SSE ${res.status}`);
        setState("live");
        delay = 1000;
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        const parser = createSseParser((frame) => {
          const event = parseCrmEvent(frame);
          if (event) applyCrmEvent(qcRef.current, event);
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
      setState("reconnecting");
      // Al volver, refresca lo que pudo perderse durante la caída.
      timer = setTimeout(() => {
        qcRef.current.invalidateQueries({ queryKey: crmKeys.all });
        void connect();
      }, delay);
      delay = Math.min(delay * 2, 30000);
    };

    void connect();
    return () => {
      controller.abort();
      if (timer) clearTimeout(timer);
    };
  }, [enabled]);

  return state;
}
