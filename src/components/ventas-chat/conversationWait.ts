import type { Conversation } from "@/types/crm";

/** Iniciales (máx. 2) para el avatar de un nombre. */
export function initials(name: string): string {
  return (
    name
      .replace(/[^\p{L}\p{N} ]/gu, " ")
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}

/** Minutos que el cliente lleva esperando respuesta; null si el último mensaje no es suyo. */
export function waitMinutes(
  c: Pick<Conversation, "lastMessageDirection" | "lastInboundAt">,
  now = Date.now(),
): number | null {
  if (c.lastMessageDirection !== "in" || !c.lastInboundAt) return null;
  const t = new Date(c.lastInboundAt).getTime();
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.floor((now - t) / 60_000));
}

export type WaitTone = "ok" | "warn" | "bad";

/** Color del tiempo de espera: verde, ámbar desde el 60 % de la meta, rojo si la pasa. */
export function waitTone(minutes: number | null, slaMinutes: number): WaitTone | null {
  if (minutes == null) return null;
  if (minutes > slaMinutes) return "bad";
  if (minutes >= slaMinutes * 0.6) return "warn";
  return "ok";
}

/** «12 min», «3 h» o «2 d». */
export function formatWait(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  if (minutes < 60 * 24) return `${Math.floor(minutes / 60)} h`;
  return `${Math.floor(minutes / 1440)} d`;
}
