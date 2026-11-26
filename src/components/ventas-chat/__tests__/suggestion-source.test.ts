import { pickSuggestion } from "../suggestionSource";
import type { ObjectionDetection } from "@/types/crmSalesTools";

const base: ObjectionDetection = {
  objectionId: null,
  label: null,
  confidence: 0,
  suggestedResponse: null,
  replySource: null,
  source: "llm",
  text: "hola",
};

describe("pickSuggestion (item 37: la tarjeta dice de dónde sale el texto)", () => {
  it("usa el texto que redactó la IA y lo marca IA", () => {
    const r = pickSuggestion(
      { ...base, label: "Precio", suggestedResponse: "Te entiendo, hoy va con envío gratis.", replySource: "llm" },
      "Paso del guion",
    );
    expect(r).toEqual({ text: "Te entiendo, hoy va con envío gratis.", source: "llm", objection: "Precio", fromStep: false });
  });

  it("la IA redacta aunque no haya objeción", () => {
    const r = pickSuggestion({ ...base, suggestedResponse: "¡Hola! ¿Qué talla usas?", replySource: "llm" }, "Paso");
    expect(r).toEqual({ text: "¡Hola! ¿Qué talla usas?", source: "llm", objection: null, fromStep: false });
  });

  it("respuesta oficial del negocio cuenta como reglas aunque la IA detectó la objeción", () => {
    const r = pickSuggestion(
      { ...base, label: "Precio", suggestedResponse: "Respuesta oficial", replySource: "official" },
      "Paso",
    );
    expect(r).toEqual({ text: "Respuesta oficial", source: "mock", objection: "Precio", fromStep: false });
  });

  it("sin detección usa el paso del guion como reglas", () => {
    expect(pickSuggestion(undefined, "Hola Ana, ¿qué talla?")).toEqual({
      text: "Hola Ana, ¿qué talla?",
      source: "mock",
      objection: null,
      fromStep: true,
    });
  });

  it("ms-crm viejo (sin replySource) sigue mostrando la objeción como reglas", () => {
    const old = { ...base, label: "Precio", suggestedResponse: "Oficial" } as Partial<ObjectionDetection>;
    delete old.replySource;
    expect(pickSuggestion(old as ObjectionDetection, "")).toEqual({ text: "Oficial", source: "mock", objection: "Precio", fromStep: false });
  });

  it("nada que sugerir devuelve null", () => {
    expect(pickSuggestion({ ...base }, "")).toBeNull();
  });
});
