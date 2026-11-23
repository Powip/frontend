import { isSocialChannel, reactionsByTarget } from "../SocialParts";
import type { Message } from "@/types/crm";

const r = (over: Partial<Message>): Message =>
  ({
    id: Math.random().toString(),
    conversationId: "c1",
    direction: "in",
    type: "reaction",
    body: "❤️",
    contextExternalId: "mid.1",
    ...over,
  }) as Message;

describe("isSocialChannel", () => {
  it("solo messenger e instagram", () => {
    expect(isSocialChannel({ channel: "messenger" })).toBe(true);
    expect(isSocialChannel({ channel: "instagram" })).toBe(true);
    expect(isSocialChannel({ channel: "whatsapp" })).toBe(false);
    expect(isSocialChannel({ channel: "tiktok" })).toBe(false);
  });
});

describe("reactionsByTarget", () => {
  it("agrupa por mensaje objetivo", () => {
    const map = reactionsByTarget([r({}), r({ contextExternalId: "mid.2", body: "👍" })]);
    expect(map.get("mid.1")).toEqual([{ emoji: "❤️", mine: false }]);
    expect(map.get("mid.2")).toEqual([{ emoji: "👍", mine: false }]);
  });
  it("la reacción nueva del mismo lado reemplaza a la anterior", () => {
    const map = reactionsByTarget([r({}), r({ body: "😂" })]);
    expect(map.get("mid.1")).toEqual([{ emoji: "😂", mine: false }]);
  });
  it("distingue reacción propia y del cliente", () => {
    const map = reactionsByTarget([r({}), r({ direction: "out", body: "👍" })]);
    expect(map.get("mid.1")).toHaveLength(2);
  });
  it("ignora mensajes que no son reacción", () => {
    const map = reactionsByTarget([r({ type: "text" as Message["type"] })]);
    expect(map.size).toBe(0);
  });
  it("cuerpo vacío quita la reacción", () => {
    const map = reactionsByTarget([r({}), r({ body: "" })]);
    expect(map.get("mid.1")).toEqual([]);
  });
});
