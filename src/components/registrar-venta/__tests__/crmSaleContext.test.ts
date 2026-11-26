import { toast } from "sonner";
import { SalesChannel } from "@/enum/Order.enum";
import * as svc from "@/services/crmService";
import { toLocalPhone } from "@/lib/crmPhone";
import {
  crmSalePayload,
  linkSaleToConversation,
  parseCrmSaleContext,
  pickWhatsappChannel,
} from "../crmSaleContext";
import type { SaleSalesChannel } from "@/services/saleContextService";

jest.mock("sonner", () => ({ toast: { warning: jest.fn(), error: jest.fn() } }));
jest.mock("@/services/crmService", () => ({ linkConversationOrder: jest.fn() }));
const link = svc.linkConversationOrder as jest.Mock;

const q = (s: string) => new URLSearchParams(s);
const ch = (over: Partial<SaleSalesChannel>): SaleSalesChannel => ({
  id: "x",
  storeId: "s",
  type: "WHATSAPP",
  label: "WA",
  identifier: null,
  ...over,
});

beforeEach(() => jest.clearAllMocks());

describe("parseCrmSaleContext", () => {
  it("sin crmConversationId devuelve null (la página no cambia)", () => {
    expect(parseCrmSaleContext(q("orderId=1"))).toBeNull();
    expect(crmSalePayload(null)).toEqual({});
  });
  it("lee conversación, teléfono y returnTo", () => {
    const ctx = parseCrmSaleContext(
      q("crmConversationId=c1&crmPhone=51999&returnTo=%2Fcomercial%2Fventas-chat%2Fbandeja%3Fc%3Dc1"),
    );
    expect(ctx).toEqual({
      conversationId: "c1",
      phone: "51999",
      returnTo: "/comercial/ventas-chat/bandeja?c=c1",
    });
    expect(crmSalePayload(ctx)).toEqual({ conversationId: "c1" });
  });
  it("rechaza returnTo externo y usa la bandeja", () => {
    for (const bad of ["https://evil.com", "//evil.com", "/a\\b"]) {
      const ctx = parseCrmSaleContext(q(`crmConversationId=c1&returnTo=${encodeURIComponent(bad)}`));
      expect(ctx?.returnTo).toBe("/comercial/ventas-chat/bandeja?c=c1");
    }
  });
  it("rechaza conversationId de más de 200 caracteres", () => {
    expect(parseCrmSaleContext(q(`crmConversationId=${"a".repeat(201)}`))).toBeNull();
  });
});

describe("pickWhatsappChannel", () => {
  it("elige el único canal WhatsApp activo de la tienda", () => {
    expect(pickWhatsappChannel([ch({ id: "w1" }), ch({ id: "i", type: "INSTAGRAM" })], [])).toEqual({
      id: "w1",
      type: SalesChannel.WHATSAPP,
    });
  });
  it("no elige si hay dos WhatsApp o ninguno", () => {
    expect(pickWhatsappChannel([ch({ id: "a" }), ch({ id: "b" })], ["WHATSAPP"])).toBeNull();
    expect(pickWhatsappChannel([ch({ type: "WEB" })], ["WHATSAPP"])).toBeNull();
    expect(pickWhatsappChannel([ch({ id: "a", isActive: false })], ["WHATSAPP"])).toBeNull();
  });
  it("sin canales configurados usa el canal heredado", () => {
    expect(pickWhatsappChannel([], ["TIENDA_FISICA", "WHATSAPP"])).toEqual({
      id: undefined,
      type: SalesChannel.WHATSAPP,
    });
    expect(pickWhatsappChannel([], ["TIENDA_FISICA"])).toBeNull();
  });
});

describe("linkSaleToConversation", () => {
  const ctx = { conversationId: "c1", phone: "51999", returnTo: "/x" };
  it("vincula con orderId y orderNumber", async () => {
    link.mockResolvedValue({});
    await expect(linkSaleToConversation(ctx, { id: "o1", orderNumber: "ORD-1" })).resolves.toBe(true);
    expect(link).toHaveBeenCalledWith("c1", { orderId: "o1", orderNumber: "ORD-1" });
  });
  it("omite orderNumber si no hay", async () => {
    link.mockResolvedValue({});
    await linkSaleToConversation(ctx, { id: "o1" });
    expect(link).toHaveBeenCalledWith("c1", { orderId: "o1" });
  });
  it("si falla avisa con toast y no lanza", async () => {
    link.mockRejectedValue(new Error("down"));
    await expect(linkSaleToConversation(ctx, { id: "o1" })).resolves.toBe(false);
    expect(toast.warning).toHaveBeenCalled();
  });
});

describe("toLocalPhone", () => {
  it("convierte el teléfono de WhatsApp al formato de los formularios", () => {
    expect(toLocalPhone("51999111222")).toBe("999111222");
    expect(toLocalPhone("999111222")).toBe("999111222");
    expect(toLocalPhone("5491123456789")).toBe("+5491123456789");
    expect(toLocalPhone("")).toBe("");
  });
});
