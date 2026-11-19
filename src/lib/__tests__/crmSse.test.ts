import { QueryClient } from "@tanstack/react-query";
import {
  applyCrmEvent,
  createSseParser,
  crmKeys,
  parseCrmEvent,
  type SseFrame,
} from "../crmSse";
import type { Conversation, ConversationOrder, Message, MessagePage, Task } from "@/types/crm";

const msg = (over: Partial<Message> = {}): Message => ({
  id: "m1",
  conversationId: "c1",
  direction: "in",
  type: "text",
  body: "hola",
  status: "received",
  senderKind: "customer",
  senderUserId: null,
  senderName: null,
  errorMessage: null,
  createdAt: "2026-11-19T10:00:00.000Z",
  ...over,
});
const conv = (over: Partial<Conversation> = {}): Conversation => ({
  id: "c1",
  channel: "whatsapp",
  contactPhone: "51999",
  contactName: null,
  status: "open",
  assignedUserId: null,
  assignedUserName: null,
  clientId: null,
  unreadCount: 1,
  lastMessageAt: null,
  lastMessagePreview: null,
  lastMessageDirection: null,
  lastInboundAt: null,
  windowExpiresAt: null,
  createdAt: "2026-11-19T09:00:00.000Z",
  pipelineId: null,
  stageId: null,
  stageChangedAt: null,
  lostReason: null,
  marketingOptOut: false,
  pauEnabled: false,
  pauHelpReason: null,
  scriptStep: null,
  ...over,
});

function collect(chunks: string[]) {
  const frames: SseFrame[] = [];
  const p = createSseParser((f) => frames.push(f));
  chunks.forEach((c) => p.push(c));
  return frames;
}

describe("createSseParser", () => {
  it("parsea un frame completo", () => {
    expect(collect(['event: message.status\ndata: {"a":1}\n\n'])).toEqual([
      { event: "message.status", data: '{"a":1}' },
    ]);
  });

  it("junta trozos partidos en mitad de línea", () => {
    expect(collect(["event: ping\nda", 'ta: {"x"', ":2}\n", "\n"])).toEqual([
      { event: "ping", data: '{"x":2}' },
    ]);
  });

  it("acepta CRLF, comentarios y data multilínea", () => {
    expect(collect([": keep-alive\r\n\r\nevent: a\r\ndata: 1\r\ndata: 2\r\n\r\n"])).toEqual([
      { event: "a", data: "1\n2" },
    ]);
  });

  it("usa 'message' si no hay event y no emite frames vacíos", () => {
    expect(collect(["data: x\n\n\n\n"])).toEqual([{ event: "message", data: "x" }]);
  });

  it("no emite un frame incompleto", () => {
    expect(collect(["event: a\ndata: 1\n"])).toEqual([]);
  });
});

describe("parseCrmEvent", () => {
  it("devuelve el evento tipado", () => {
    const e = parseCrmEvent({ event: "conversation.updated", data: JSON.stringify({ conversation: conv() }) });
    expect(e?.type).toBe("conversation.updated");
  });
  it("ignora ping, desconocidos y JSON roto", () => {
    expect(parseCrmEvent({ event: "ping", data: "{}" })).toBeNull();
    expect(parseCrmEvent({ event: "otro", data: "{}" })).toBeNull();
    expect(parseCrmEvent({ event: "message.created", data: "{no" })).toBeNull();
  });
});

describe("applyCrmEvent", () => {
  it("message.created agrega el mensaje una sola vez y actualiza la conversación", () => {
    const qc = new QueryClient();
    qc.setQueryData<MessagePage>(crmKeys.messages("c1"), { items: [], hasMore: false });
    const data = { conversation: conv({ unreadCount: 3 }), message: msg() };
    applyCrmEvent(qc, { type: "message.created", data });
    applyCrmEvent(qc, { type: "message.created", data });
    expect(qc.getQueryData<MessagePage>(crmKeys.messages("c1"))?.items).toHaveLength(1);
    expect(qc.getQueryData<Conversation>(crmKeys.conversation("c1"))?.unreadCount).toBe(3);
  });

  it("message.status actualiza estado y motivo", () => {
    const qc = new QueryClient();
    qc.setQueryData<MessagePage>(crmKeys.messages("c1"), {
      items: [msg({ id: "m2", direction: "out", status: "sent" })],
      hasMore: false,
    });
    applyCrmEvent(qc, {
      type: "message.status",
      data: { conversationId: "c1", messageId: "m2", status: "failed", errorMessage: "rechazado" },
    });
    const m = qc.getQueryData<MessagePage>(crmKeys.messages("c1"))?.items[0];
    expect(m).toMatchObject({ status: "failed", errorMessage: "rechazado" });
  });

  it("no crea caché de mensajes si la conversación no está abierta", () => {
    const qc = new QueryClient();
    applyCrmEvent(qc, { type: "message.created", data: { conversation: conv(), message: msg() } });
    expect(qc.getQueryData(crmKeys.messages("c1"))).toBeUndefined();
  });
});

const order = (over: Partial<ConversationOrder> = {}): ConversationOrder => ({
  id: "l1",
  conversationId: "c1",
  orderId: "o1",
  orderNumber: "ORD-1",
  createdByUserId: null,
  createdByName: null,
  createdAt: "2026-11-19T10:00:00.000Z",
  ...over,
});

describe("order.linked", () => {
  it("parseCrmEvent reconoce el evento", () => {
    const e = parseCrmEvent({
      event: "order.linked",
      data: JSON.stringify({ conversationId: "c1", order: order() }),
    });
    expect(e?.type).toBe("order.linked");
  });

  it("antepone el pedido en la caché de pedidos sin duplicar", () => {
    const qc = new QueryClient();
    qc.setQueryData(crmKeys.orders("c1"), [order({ id: "l0", orderId: "o0" })]);
    const ev = { type: "order.linked", data: { conversationId: "c1", order: order() } } as const;
    applyCrmEvent(qc, ev);
    applyCrmEvent(qc, ev);
    const list = qc.getQueryData<ConversationOrder[]>(crmKeys.orders("c1"))!;
    expect(list.map((o) => o.orderId)).toEqual(["o1", "o0"]);
  });

  it("sin caché previa invalida la consulta", () => {
    const qc = new QueryClient();
    const spy = jest.spyOn(qc, "invalidateQueries");
    applyCrmEvent(qc, { type: "order.linked", data: { conversationId: "c1", order: order() } });
    expect(spy).toHaveBeenCalledWith({ queryKey: crmKeys.orders("c1") });
  });
});

const task = (over: Partial<Task> = {}): Task => ({
  id: "t1",
  conversationId: "c1",
  contactName: "Ana",
  contactPhone: "51999",
  type: "message",
  title: "Llamar",
  note: null,
  dueAt: "2026-11-20T15:00:00.000Z",
  status: "pending",
  doneAt: null,
  assignedUserId: "u1",
  assignedUserName: "Jairo",
  createdByUserId: "u1",
  createdAt: "2026-11-19T09:00:00.000Z",
  ...over,
});

describe("eventos de agenda y embudo", () => {
  it("parsea task.updated y task.deleted", () => {
    expect(
      parseCrmEvent({ event: "task.updated", data: JSON.stringify({ task: task() }) })?.type,
    ).toBe("task.updated");
    expect(
      parseCrmEvent({ event: "task.deleted", data: JSON.stringify({ id: "t1" }) })?.type,
    ).toBe("task.deleted");
  });

  it("task.updated invalida las listas de tareas", () => {
    const qc = new QueryClient();
    const spy = jest.spyOn(qc, "invalidateQueries");
    applyCrmEvent(qc, { type: "task.updated", data: { task: task() } });
    expect(spy).toHaveBeenCalledWith({ queryKey: crmKeys.tasks });
  });

  it("task.deleted saca la tarea de todas las listas en caché", () => {
    const qc = new QueryClient();
    const a = crmKeys.tasksList({ assigned: "me", status: "pending" });
    const b = crmKeys.tasksList({ assigned: "all", status: "pending", conversationId: "c1" });
    qc.setQueryData<Task[]>(a, [task(), task({ id: "t2" })]);
    qc.setQueryData<Task[]>(b, [task()]);
    applyCrmEvent(qc, { type: "task.deleted", data: { id: "t1" } });
    expect(qc.getQueryData<Task[]>(a)?.map((t) => t.id)).toEqual(["t2"]);
    expect(qc.getQueryData<Task[]>(b)).toEqual([]);
  });

  it("conversation.updated refresca los tableros del embudo", () => {
    const qc = new QueryClient();
    const spy = jest.spyOn(qc, "invalidateQueries");
    applyCrmEvent(qc, { type: "conversation.updated", data: { conversation: conv() } });
    expect(spy).toHaveBeenCalledWith({ queryKey: crmKeys.boards });
  });
});

import type { Broadcast } from "@/types/crm";

const broadcast = (over: Partial<Broadcast> = {}): Broadcast => ({
  id: "b1",
  name: "Noviembre",
  templateName: "novedades",
  templateLanguage: "es",
  templateVariables: [],
  audience: { type: "all" },
  status: "sending",
  scheduledAt: null,
  startedAt: "2026-11-19T15:00:00.000Z",
  finishedAt: null,
  total: 100,
  sentCount: 20,
  failedCount: 0,
  deliveredCount: 10,
  readCount: 5,
  createdByName: "Jairo",
  createdAt: "2026-11-19T14:00:00.000Z",
  ...over,
});

describe("broadcast.updated", () => {
  it("parseCrmEvent reconoce el evento", () => {
    const e = parseCrmEvent({
      event: "broadcast.updated",
      data: JSON.stringify({ broadcast: broadcast() }),
    });
    expect(e?.type).toBe("broadcast.updated");
  });

  it("reemplaza la difusión de la lista por id", () => {
    const qc = new QueryClient();
    qc.setQueryData<Broadcast[]>(crmKeys.broadcasts, [
      broadcast(),
      broadcast({ id: "b2", name: "Otra" }),
    ]);
    applyCrmEvent(qc, {
      type: "broadcast.updated",
      data: { broadcast: broadcast({ sentCount: 60, readCount: 30 }) },
    });
    const list = qc.getQueryData<Broadcast[]>(crmKeys.broadcasts)!;
    expect(list).toHaveLength(2);
    expect(list[0]).toMatchObject({ id: "b1", sentCount: 60, readCount: 30 });
    expect(list[1].name).toBe("Otra");
  });

  it("agrega al inicio una difusión que no estaba en la lista", () => {
    const qc = new QueryClient();
    qc.setQueryData<Broadcast[]>(crmKeys.broadcasts, [broadcast()]);
    applyCrmEvent(qc, {
      type: "broadcast.updated",
      data: { broadcast: broadcast({ id: "b9", name: "Nueva" }) },
    });
    expect(qc.getQueryData<Broadcast[]>(crmKeys.broadcasts)?.map((b) => b.id)).toEqual(["b9", "b1"]);
  });

  it("sin lista en caché no la crea (solo invalida)", () => {
    const qc = new QueryClient();
    applyCrmEvent(qc, { type: "broadcast.updated", data: { broadcast: broadcast() } });
    expect(qc.getQueryData(crmKeys.broadcasts)).toBeUndefined();
  });
});
