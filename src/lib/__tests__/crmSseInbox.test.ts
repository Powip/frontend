import { QueryClient } from "@tanstack/react-query";
import { applyCrmEvent, crmKeys } from "@/lib/crmSse";
import { fillTemplateBody, isInternalNote, lastCustomerText } from "@/components/ventas-chat/format";
import type { Conversation, Message } from "@/types/crm";

const conversation = { id: "c1" } as Conversation;
const message = (over: Partial<Message> = {}): Message => ({
  id: "m1",
  conversationId: "c1",
  direction: "in",
  type: "text",
  body: "Hola",
  status: "received",
  senderKind: "customer",
  senderUserId: null,
  senderName: null,
  errorMessage: null,
  createdAt: "2026-11-19T10:00:00.000Z",
  ...over,
});

describe("SSE · indicadores de la Bandeja", () => {
  it("message.created invalida el resumen y los seguimientos del chat", () => {
    const qc = new QueryClient();
    const spy = jest.spyOn(qc, "invalidateQueries");
    applyCrmEvent(qc, { type: "message.created", data: { conversation, message: message() } });
    expect(spy).toHaveBeenCalledWith({ queryKey: crmKeys.summary });
    expect(spy).toHaveBeenCalledWith({ queryKey: crmKeys.conversationFollowups("c1") });
  });

  it("conversation.updated invalida el resumen", () => {
    const qc = new QueryClient();
    const spy = jest.spyOn(qc, "invalidateQueries");
    applyCrmEvent(qc, { type: "conversation.updated", data: { conversation } });
    expect(spy).toHaveBeenCalledWith({ queryKey: crmKeys.summary });
  });

  it("una nota interna llega por message.created y se agrega una sola vez", () => {
    const qc = new QueryClient();
    qc.setQueryData(crmKeys.messages("c1"), { items: [], hasMore: false });
    const note = message({ id: "n1", type: "note", direction: "out", senderKind: "agent", body: "Nota" });
    applyCrmEvent(qc, { type: "message.created", data: { conversation, message: note } });
    applyCrmEvent(qc, { type: "message.created", data: { conversation, message: note } });
    expect(qc.getQueryData<{ items: Message[] }>(crmKeys.messages("c1"))?.items).toHaveLength(1);
  });
});

describe("format · notas y plantillas", () => {
  it("isInternalNote solo reconoce type «note»", () => {
    expect(isInternalNote(message({ type: "note" }))).toBe(true);
    expect(isInternalNote(message({ type: "system" }))).toBe(false);
  });

  it("lastCustomerText ignora notas internas, mensajes salientes y de sistema", () => {
    const items = [
      message({ id: "a", body: "¿Tienen talla M?" }),
      message({ id: "b", direction: "out", senderKind: "agent", body: "Sí" }),
      message({ id: "c", type: "note", senderKind: "customer", body: "NOTA no cuenta" }),
      message({ id: "d", senderKind: "system", body: "Sistema" }),
    ];
    expect(lastCustomerText(items)).toBe("¿Tienen talla M?");
    expect(lastCustomerText([])).toBe("");
    expect(lastCustomerText(undefined)).toBe("");
  });

  it("fillTemplateBody reemplaza {{n}} y deja los vacíos", () => {
    expect(fillTemplateBody("Hola {{1}}, pedido {{2}}", ["Ana", "ORD-1"])).toBe("Hola Ana, pedido ORD-1");
    expect(fillTemplateBody("Hola {{1}}, pedido {{2}}", ["Ana", ""])).toBe("Hola Ana, pedido {{2}}");
  });
});
