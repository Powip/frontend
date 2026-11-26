import { callQueue } from "../callQueue";
import { CALL_LOST_REASONS, closingMessage, sendsClosingByDefault } from "../callClosing";
import { isLinkAlive, lowStockOf, stockText } from "../chatCart";
import { ENVIO_TEXT, dispatchText, envioText, isHumanAgentOnly, replyHoursLeft, windowHoursLeft } from "../saleGuide";
import { suggestedMaterial, type MaterialContext } from "../suggestedMaterial";
import { isReadyToBuy, temperatureOf } from "../temperature";
import type { ConversationQuote, Task } from "@/types/crm";
import type { CallProspect } from "@/types/crmCalls";
import type { Material } from "@/types/crmContent";
import type { Quotation } from "@/types/quotations";

const HOUR = 3_600_000;
// 10:00 en Lima
const NOW = Date.parse("2026-11-24T15:00:00.000Z");
const at = (hours: number) => new Date(NOW + hours * HOUR).toISOString();

describe("temperatura del chat", () => {
  it.each([
    ["señal de compra reciente", at(-23), at(-30), "caliente"],
    ["señal vieja, pero sigue escribiendo", at(-25), at(-1), "tibio"],
    ["sin señal y escribió hoy", null, at(-2), "tibio"],
    ["dejó de responder", at(-30), at(-25), "frio"],
    ["nunca escribió", null, null, "frio"],
  ])("%s", (_name, hotAt, lastInboundAt, expected) => {
    expect(temperatureOf({ hotAt, lastInboundAt }, NOW)).toBe(expected);
  });

  it("un chat cerrado nunca está «listo para comprar»", () => {
    const hot = { hotAt: at(-1), lastInboundAt: at(-1) };
    expect(isReadyToBuy({ ...hot, status: "open" } as never, NOW)).toBe(true);
    expect(isReadyToBuy({ ...hot, status: "closed" } as never, NOW)).toBe(false);
  });
});

describe("envío y ventana", () => {
  it("«/envío» habla de agencia solo si la ciudad es de provincia", () => {
    expect(envioText({ city: "Arequipa", province: "" } as never)).toContain("Arequipa por Shalom");
    expect(envioText({ city: "", province: "Cusco" } as never)).toContain("Cusco por Shalom");
    expect(envioText({ city: "Lima", province: "Lima" } as never)).toBe(ENVIO_TEXT);
    expect(envioText({ city: "Callao", province: "" } as never)).toBe(ENVIO_TEXT);
    expect(envioText(null)).toBe(ENVIO_TEXT);
  });

  it("las horas de ventana se redondean hacia arriba y no bajan de 0", () => {
    expect(windowHoursLeft({ windowExpiresAt: at(1.2) }, NOW)).toBe(2);
    expect(windowHoursLeft({ windowExpiresAt: at(-1) }, NOW)).toBe(0);
    expect(windowHoursLeft({ windowExpiresAt: null }, NOW)).toBe(0);
  });

  it("Instagram: 24 h de respuesta libre y luego solo agente humano", () => {
    const ig = (inbound: number) =>
      ({ channel: "instagram", lastInboundAt: at(inbound), windowExpiresAt: at(inbound + 168) }) as never;
    expect(replyHoursLeft(ig(-4), NOW)).toBe(20);
    expect(isHumanAgentOnly(ig(-4), NOW)).toBe(false);
    expect(replyHoursLeft(ig(-30), NOW)).toBe(0);
    expect(isHumanAgentOnly(ig(-30), NOW)).toBe(true);
    expect(isHumanAgentOnly(ig(-200), NOW)).toBe(false);
  });

  it("WhatsApp usa su ventana tal cual", () => {
    const wa = { channel: "whatsapp", lastInboundAt: at(-20), windowExpiresAt: at(4) } as never;
    expect(replyHoursLeft(wa, NOW)).toBe(4);
    expect(isHumanAgentOnly(wa, NOW)).toBe(false);
  });

  it("el despacho depende de la hora de corte de Lima", () => {
    expect(dispatchText({ cutoffTime: "16:00" }, new Date(NOW))).toBe("Despacho hoy si confirma antes de 16:00");
    expect(dispatchText({ cutoffTime: "09:00" }, new Date(NOW))).toBe("Despacho mañana a primera hora");
    expect(dispatchText({ cutoffTime: "" }, new Date(NOW))).toBeNull();
  });
});

describe("carrito del chat", () => {
  it("avisa solo cuando quedan pocas unidades", () => {
    expect(lowStockOf({ stockAvailable: 3 }, 3)).toBe(3);
    expect(lowStockOf({ stockAvailable: 4 }, 3)).toBeNull();
    expect(lowStockOf({ stockAvailable: 0 }, 3)).toBeNull();
    expect(lowStockOf(undefined)).toBeNull();
  });

  it.each([
    [0, "agotado, ofrece una alternativa"],
    [2, "últimas 2"],
    [9, "9 en stock"],
    [null, null],
  ])("stock %s", (stockAvailable, expected) => {
    expect(stockText({ stockAvailable } as never)).toBe(expected);
  });

  it("un link sirve si tiene URL, no es pedido y no venció", () => {
    const link = (over = {}) => ({ publicUrl: "https://x.test/c/1", orderId: null, ...over }) as ConversationQuote;
    const quotation = (status: string, days: number) =>
      ({ status, expiresAt: new Date(Date.now() + days * 24 * HOUR).toISOString() }) as Quotation;
    expect(isLinkAlive(link(), undefined)).toBe(true);
    expect(isLinkAlive(link(), quotation("PREVENTA", 1))).toBe(true);
    expect(isLinkAlive(link(), quotation("PREVENTA", -1))).toBe(false);
    expect(isLinkAlive(link({ orderId: "o1" }), quotation("PREVENTA", 1))).toBe(false);
    expect(isLinkAlive(link({ publicUrl: null }), undefined)).toBe(false);
    expect(isLinkAlive(undefined, undefined)).toBe(false);
  });
});

describe("material sugerido", () => {
  const material = (id: string, over: Partial<Material> = {}) =>
    ({ id, sheetId: "s1", kind: "photo", title: id, url: "https://x.test", position: 0, ...over }) as Material;
  const ALL = [
    material("Foto frontal"),
    material("Guía de medidas"),
    material("Testimonio de Rosa"),
    material("¡Últimas unidades!"),
    material("Video de uso", { kind: "video" }),
    material("Datos de pago", { payment: true } as never),
  ];
  const context = (over: Partial<MaterialContext> = {}): MaterialContext => ({
    objection: null,
    step: 2,
    lowStock: false,
    temperature: "caliente",
    ...over,
  });

  it.each<[string, Partial<MaterialContext>, string]>([
    ["duda de talla, aunque ya esté en el pago", { objection: "No sé mi talla", step: 4 }, "Guía de medidas"],
    ["desconfía", { objection: "¿Es seguro?" }, "Testimonio de Rosa"],
    ["paso de pago", { step: 4, lowStock: true }, "Datos de pago"],
    ["pocas unidades", { lowStock: true, temperature: "tibio" }, "¡Últimas unidades!"],
    ["tibio", { temperature: "tibio", step: 0 }, "Testimonio de Rosa"],
    ["primer paso", { step: 0 }, "Foto frontal"],
    ["segundo paso", { step: 1 }, "Guía de medidas"],
    ["resto", {}, "Video de uso"],
  ])("%s", (_name, over, expected) => {
    expect(suggestedMaterial(ALL, context(over))?.id).toBe(expected);
  });

  it("si no hay el que toca, el primero; sin materiales, ninguno", () => {
    expect(suggestedMaterial([ALL[1]], context({ step: 4 }))?.id).toBe("Guía de medidas");
    expect(suggestedMaterial([], context())).toBeUndefined();
  });
});

describe("cola de llamadas", () => {
  const task = (id: string, conversationId: string | null, dueAt: string, type = "call") =>
    ({ id, conversationId, dueAt, type, title: "Llamar", contactName: id }) as Task;
  const prospect = (conversationId: string, reason: CallProspect["reason"], total: number | null = null) =>
    ({ conversationId, reason, total, contactName: conversationId }) as CallProspect;

  it("agendadas, links sin pagar, tibios y COD, en ese orden", () => {
    const queue = callQueue(
      [task("t1", "c1", at(1)), task("t2", "c2", at(-30)), task("t3", "c3", at(72)), task("t4", "c4", at(1), "message")],
      [prospect("c7", "cod"), prospect("c6", "warm"), prospect("c5", "link", 89)],
      NOW,
    );
    expect(queue.map((q) => q.conversationId)).toEqual(["c2", "c1", "c5", "c6", "c7"]);
    expect(queue.map((q) => q.detail).slice(2)).toEqual([
      "Link sin pagar · S/ 89.00",
      "Tibio · leyó y no compró",
      "COD en No contesta",
    ]);
  });

  it("un chat sale una sola vez; las tareas sin chat no se pierden", () => {
    const queue = callQueue(
      [task("t1", "c1", at(1)), task("t2", null, at(1)), task("t3", null, at(1))],
      [prospect("c1", "link"), prospect("c5", "link")],
      NOW,
    );
    expect(queue.map((q) => q.key)).toEqual(["t1", "t2", "t3", "c5"]);
    expect(queue[3].detail).toBe("Link sin pagar");
  });
});

describe("cierre de la llamada", () => {
  it("cada resultado propone su mensaje, con o sin nombre", () => {
    expect(closingMessage("sold", "Ana")).toContain("¡Gracias, Ana!");
    expect(closingMessage("callback", "")).toMatch(/^Gracias por atenderme /);
    expect(closingMessage("no_answer", "Ana")).toContain("Hola Ana");
    expect(closingMessage("not_interested", "")).toMatch(/^Gracias por tu tiempo\./);
  });

  it("«No contestó» no manda mensaje por defecto", () => {
    expect(sendsClosingByDefault("no_answer")).toBe(false);
    expect(sendsClosingByDefault("sold")).toBe(true);
  });

  it("los motivos no incluyen «Otro», que pide texto libre", () => {
    expect(CALL_LOST_REASONS.length).toBeGreaterThan(0);
    expect(CALL_LOST_REASONS).not.toContain("Otro");
  });
});
