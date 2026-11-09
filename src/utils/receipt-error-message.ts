import axios from "axios";

export interface ReceiptFailure {
  orderNumber: string;
  reason: string;
}

function serverMessage(data: unknown): string | null {
  const message = (data as { message?: unknown } | null)?.message;
  if (Array.isArray(message)) {
    const text = message
      .filter((item): item is string => typeof item === "string" && item.trim() !== "")
      .join(". ");
    return text || null;
  }
  return typeof message === "string" && message.trim() !== "" ? message : null;
}

/**
 * Motivo, en español, por el que no se pudo obtener el recibo de un pedido.
 * Los `Error` simples son las validaciones propias de la pantalla (ya están en
 * español); el resto de excepciones de programación se marcan como inesperadas.
 */
export function describeReceiptError(error: unknown): string {
  if (axios.isCancel(error)) {
    return "La sesión se estaba actualizando. Reintenta en unos segundos.";
  }
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    if (status === undefined) {
      return error.code === "ECONNABORTED" || error.code === "ETIMEDOUT"
        ? "El servidor tardó demasiado en responder. Reintenta."
        : "No hubo conexión con el servidor. Revisa tu internet y reintenta.";
    }
    if (status === 401 || status === 403) {
      return "Tu sesión venció o no tienes permiso para ver este pedido. Vuelve a iniciar sesión.";
    }
    if (status === 404) {
      return "El pedido no se encontró (pudo eliminarse o ser de otra empresa).";
    }
    if (status >= 500) {
      return `El servidor falló (HTTP ${status}). Reintenta en unos segundos; si sigue, avisa a soporte.`;
    }
    return (
      serverMessage(error.response?.data) ??
      `El servidor rechazó la solicitud (HTTP ${status}).`
    );
  }
  if (error instanceof Error) {
    if (error.name === "Error" && error.message) return error.message;
    return error.message
      ? `Error inesperado (${error.name}: ${error.message}).`
      : `Error inesperado (${error.name}).`;
  }
  return "Error inesperado.";
}

/** "ORD-1, ORD-2: motivo | ORD-3: otro motivo" — agrupa los pedidos por motivo. */
export function summarizeReceiptFailures(failures: ReceiptFailure[]): string {
  const byReason = new Map<string, string[]>();
  for (const { orderNumber, reason } of failures) {
    byReason.set(reason, [...(byReason.get(reason) ?? []), orderNumber]);
  }
  return [...byReason]
    .map(([reason, orders]) => `${orders.join(", ")}: ${reason}`)
    .join(" | ");
}
