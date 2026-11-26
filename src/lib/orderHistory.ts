/**
 * FEAT-33 A7: quién hizo cada cosa en el historial del pedido. El backend marca `data.actor`
 * (CUSTOMER | SYSTEM | USER); los pedidos viejos solo traen `isSystemGenerated`.
 */
export interface HistoryLogLike {
  comentarios: string | null;
  isSystemGenerated?: boolean;
  userName?: string | null;
  data?: { actor?: string; action?: string } | null;
}

export function historyActor(log: HistoryLogLike): "Cliente" | "Sistema" | null {
  if (log.data?.actor === "CUSTOMER") return "Cliente";
  if (log.data?.actor === "USER") return null;
  return log.isSystemGenerated ? "Sistema" : null;
}

/** El autor, salvo que repita lo que ya dice la etiqueta («Cliente», «Sistema»). */
export function historyAuthor(log: HistoryLogLike): string | null {
  const name = log.userName?.trim();
  if (!name) return null;
  return name === historyActor(log) ? null : name;
}

/** Entradas viejas de Live que guardaron el código de la acción como texto (p. ej. LIVE_ORDER_CANCELLED). */
export function isRawHistoryCode(log: HistoryLogLike): boolean {
  const text = log.comentarios?.trim() ?? "";
  return !!text && text === log.data?.action && /^[A-Z0-9]+(_[A-Z0-9]+)+$/.test(text);
}
