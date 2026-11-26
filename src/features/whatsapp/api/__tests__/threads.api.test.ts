import { AxiosError, AxiosHeaders } from "axios";
import axiosAuth from "@/lib/axiosAuth";
import {
  assignWhatsAppConversation,
  getWhatsAppConversation,
  getWhatsAppConversationBoard,
  getWhatsAppConversationList,
  listWhatsAppQuickReplies,
  replyWhatsAppConversation,
  toConversationMessage,
  toWhatsAppApiError,
} from "../threads.api";

jest.mock("@/lib/axiosAuth", () => ({ __esModule: true, default: { get: jest.fn(), post: jest.fn() } }));
jest.mock("@/lib/api", () => ({ API: { integrations: "http://int" } }));

const get = jest.mocked(axiosAuth.get);
const post = jest.mocked(axiosAuth.post);
const stores = new Map([["store-1", "Tienda Centro"]]);

const summary = {
  id: "t-1",
  orderId: "o-1",
  orderNumber: "PED-1",
  storeId: "store-1",
  storeName: null,
  courierName: "Olva",
  customerName: "Ana Pérez",
  phone: "+51999999999",
  lastMessageAt: "2026-11-20T15:00:00.000Z",
  column: "replied",
  lastOutbound: {
    messageId: "m-1",
    status: "read",
    templateName: "pedido_en_camino",
    sentAt: "2026-11-20T14:00:00.000Z",
    failureReason: null,
  },
  attention: {
    pendingReply: true,
    lastInboundText: "¿Llega hoy?",
    lastInboundAt: "2026-11-20T15:00:00.000Z",
    waitingSince: "2026-11-20T15:00:00.000Z",
    overdue: false,
    attended: false,
    attendedAt: null,
    attendedBy: null,
  },
  trackingOpened: true,
  flaggedForReview: false,
  optedOut: false,
  assignee: { id: "u-1", name: "Lucía" },
  version: 3,
};

beforeEach(() => jest.clearAllMocks());

test("el tablero completa el nombre de tienda y deja vacías las columnas sin datos", async () => {
  get.mockResolvedValue({
    data: { columns: { replied: { items: [summary], total: 1, hasMore: false } }, page: 1, pageSize: 20 },
  });
  const board = await getWhatsAppConversationBoard({ q: null, storeId: null, assignedTo: null }, stores, 20);
  expect(get).toHaveBeenCalledWith("http://int/wa/threads", {
    params: { q: undefined, storeId: undefined, assignedTo: undefined, page: 1, pageSize: 20 },
  });
  expect(board.replied.items[0].storeName).toBe("Tienda Centro");
  expect(board.replied.items[0].lastMessageAt).toEqual(new Date("2026-11-20T15:00:00.000Z"));
  expect(board.sent).toEqual({ items: [], total: 0, hasMore: false });
});

test("la lista calcula si hay más páginas con el total", async () => {
  get.mockResolvedValue({ data: { items: [summary], page: 1, pageSize: 50, total: 51 } });
  const list = await getWhatsAppConversationList({ q: "ana", storeId: "store-1", assignedTo: "me" }, 1, 50, stores);
  expect(get.mock.calls[0][1]).toEqual({
    params: { q: "ana", storeId: "store-1", assignedTo: "me", view: "list", page: 1, pageSize: 50 },
  });
  expect(list.hasMore).toBe(true);
});

test("el detalle convierte mensajes, notas internas y la ventana de 24 h", async () => {
  get.mockResolvedValue({
    data: {
      ...summary,
      replyWindow: { open: true, expiresAt: "2026-11-21T15:00:00.000Z" },
      trackingUrl: "https://powip.pe/r/abc",
      messages: [
        {
          id: "m-1",
          direction: "out",
          kind: "template",
          templateName: "pedido_en_camino",
          header: "Tu pedido va en camino",
          body: "Hola Ana",
          buttonText: "Ver pedido",
          media: null,
          evidence: null,
          status: "read",
          sentAt: "2026-11-20T14:00:00.000Z",
          deliveredAt: "2026-11-20T14:00:05.000Z",
          readAt: "2026-11-20T14:10:00.000Z",
          failedAt: null,
          errorMessage: null,
          author: null,
          internalNote: false,
          createdAt: "2026-11-20T14:00:00.000Z",
        },
        {
          id: "m-2",
          direction: "out",
          kind: "text",
          templateName: null,
          body: "Cliente pidió llamada",
          buttonText: null,
          media: null,
          evidence: null,
          status: null,
          sentAt: null,
          deliveredAt: null,
          readAt: null,
          failedAt: null,
          errorMessage: null,
          author: { id: null, name: "Lucía" },
          internalNote: true,
          createdAt: "2026-11-20T15:05:00.000Z",
        },
      ],
    },
  });
  const detail = await getWhatsAppConversation("t-1", stores);
  expect(detail.version).toBe(3);
  expect(detail.replyWindow?.open).toBe(true);
  expect(detail.messages[0].body).toBe("Tu pedido va en camino\n\nHola Ana");
  expect(detail.messages[0].timeline.readAt).toEqual(new Date("2026-11-20T14:10:00.000Z"));
  expect(detail.messages[1].kind).toBe("note");
  expect(detail.messages[1].author).toEqual({ id: "", name: "Lucía" });
});

test("un documento se muestra como documento y no como multimedia", () => {
  const message = toConversationMessage({
    id: "m-3",
    direction: "in",
    kind: "text",
    templateName: null,
    body: "",
    buttonText: null,
    media: { type: "document", url: "https://x/y.pdf", caption: "boleta.pdf" },
    evidence: null,
    status: "delivered",
    sentAt: null,
    deliveredAt: null,
    readAt: null,
    failedAt: null,
    errorMessage: null,
    author: null,
    internalNote: false,
    createdAt: "2026-11-20T15:05:00.000Z",
  });
  expect(message.media).toBeNull();
  expect(message.document).toEqual({ fileName: "boleta.pdf", sizeBytes: null, url: "https://x/y.pdf" });
});

test("responder envía Idempotency-Key y reasignar envía la versión en If-Match", async () => {
  post.mockResolvedValue({ data: { ...summary, replyWindow: null, trackingUrl: null, messages: [] } });
  await replyWhatsAppConversation("t-1", "Hola", stores);
  expect(post.mock.calls[0][0]).toBe("http://int/wa/threads/t-1/reply");
  expect(post.mock.calls[0][2]?.headers?.["Idempotency-Key"]).toEqual(expect.any(String));
  await assignWhatsAppConversation("t-1", { id: "u-2", name: "Rosa" }, 3, stores);
  expect(post.mock.calls[1][1]).toEqual({ assigneeId: "u-2", assigneeName: "Rosa" });
  expect(post.mock.calls[1][2]).toEqual({ headers: { "If-Match": "3" } });
});

test("los errores del backend llegan con su mensaje legible", async () => {
  const error = new AxiosError("Request failed", "ERR_BAD_REQUEST", undefined, undefined, {
    status: 409,
    statusText: "Conflict",
    headers: {},
    config: { headers: new AxiosHeaders() },
    data: { statusCode: 409, code: "WA_OPTED_OUT", message: "El cliente pidió no recibir avisos." },
  });
  post.mockRejectedValue(error);
  await expect(replyWhatsAppConversation("t-1", "Hola", stores)).rejects.toThrow(
    "El cliente pidió no recibir avisos.",
  );
  expect(toWhatsAppApiError(new Error("x"), "fallback").message).toBe("x");
});

test("las respuestas rápidas omiten las notas internas", async () => {
  get.mockResolvedValue({
    data: [
      { id: "q-1", label: "Link de rastreo", text: "Hola {{cliente}}", internalNote: null, requires: "trackingUrl" },
      { id: "q-2", label: "Nota", text: "Revisar", internalNote: true, requires: null },
    ],
  });
  const replies = await listWhatsAppQuickReplies("store-1");
  expect(replies).toEqual([{ id: "q-1", label: "Link de rastreo", text: "Hola {{cliente}}", requires: "trackingUrl" }]);
});
