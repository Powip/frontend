import type { ObjectionDetection } from "@/types/crmSalesTools";

export interface PickedSuggestion {
  text: string;
  /** `llm` = el texto lo redactó la IA · `mock` = reglas (respuesta cargada, genérica o paso del guion). */
  source: ObjectionDetection["source"];
  /** Objeción detectada en el último mensaje del cliente, si hay. */
  objection: string | null;
  /** true si el texto es el paso del guion (solo entonces se muestra «paso X de Y»). */
  fromStep: boolean;
}

/**
 * Texto de la tarjeta «Sugerencia» y su fuente real. La insignia dice «IA» solo
 * si la IA redactó el texto; si el texto es la respuesta cargada por el negocio,
 * una genérica o el paso del guion, son reglas.
 */
export function pickSuggestion(detected: ObjectionDetection | undefined, stepText: string): PickedSuggestion | null {
  const objection = detected?.label ?? null;
  const reply = detected?.suggestedResponse?.trim() ?? "";
  if (reply && detected?.replySource === "llm") return { text: reply, source: "llm", objection, fromStep: false };
  if (reply && objection) return { text: reply, source: "mock", objection, fromStep: false };
  return stepText ? { text: stepText, source: "mock", objection: null, fromStep: true } : null;
}
