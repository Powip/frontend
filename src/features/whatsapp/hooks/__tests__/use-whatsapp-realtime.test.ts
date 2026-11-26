import { QueryClient } from "@tanstack/react-query";
import { applyWhatsAppRealtimeEvent, parseWhatsAppRealtimeFrame } from "../use-whatsapp-realtime";

jest.mock("@/lib/api", () => ({ API: { integrations: "http://int" } }));

test("solo acepta eventos conocidos con JSON válido", () => {
  expect(parseWhatsAppRealtimeFrame({ event: "ping", data: "{}" } as never)).toBeNull();
  expect(parseWhatsAppRealtimeFrame({ event: "thread.updated", data: "no-json" } as never)).toBeNull();
  expect(
    parseWhatsAppRealtimeFrame({ event: "thread.updated", data: '{"threadId":"t-1"}' } as never),
  ).toEqual({ type: "thread.updated", data: { threadId: "t-1" } });
});

test("thread.updated refresca el tablero y el hilo abierto de la empresa", () => {
  const client = new QueryClient();
  const spy = jest.spyOn(client, "invalidateQueries");
  applyWhatsAppRealtimeEvent(client, "c-1", { type: "thread.updated", data: { threadId: "t-1" } });
  const keys = spy.mock.calls.map(([filters]) => filters?.queryKey);
  expect(keys).toContainEqual(["whatsapp", "company", "c-1", "conversations"]);
  expect(keys).toContainEqual(["whatsapp", "company", "c-1", "thread", "t-1"]);
});

test("connection.updated refresca el estado de la conexión", () => {
  const client = new QueryClient();
  const spy = jest.spyOn(client, "invalidateQueries");
  applyWhatsAppRealtimeEvent(client, "c-1", { type: "connection.updated", data: {} });
  expect(spy.mock.calls.map(([filters]) => filters?.queryKey)).toContainEqual(["whatsapp", "status"]);
});
