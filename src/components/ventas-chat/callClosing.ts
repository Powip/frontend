import type { CallResult } from "@/types/crmCalls";
import { LOST_REASONS } from "./board";

/** Motivos de «No le interesa»: los del embudo, sin el texto libre. */
export const CALL_LOST_REASONS: string[] = LOST_REASONS.filter((r) => r !== "Otro");

/** Mensaje de WhatsApp que se propone al terminar la llamada. Solo promete lo que se puede cumplir. */
export function closingMessage(result: CallResult, name: string): string {
  const comma = name ? `, ${name}` : "";
  switch (result) {
    case "sold":
      return `¡Gracias${comma}! 🙌 Como conversamos, seguimos con tu pedido por aquí.`;
    case "callback":
      return `Gracias por atenderme${comma} 😊 Te llamo como quedamos.`;
    case "no_answer":
      return `Hola${name ? ` ${name}` : ""} 👋 te llamé para ayudarte con tu pedido. ¿A qué hora te puedo llamar?`;
    default:
      return `Gracias por tu tiempo${comma}. Si cambias de opinión, aquí estamos 💛`;
  }
}

/** Si no contestó, el mensaje de cierre viene sin marcar: primero se reintenta la llamada. */
export function sendsClosingByDefault(result: CallResult): boolean {
  return result !== "no_answer";
}
