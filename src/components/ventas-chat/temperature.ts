import type { Conversation } from "@/types/crm";
import type { TemperatureKey } from "@/types/crmContent";

export const TEMPERATURE_BADGE: Record<TemperatureKey, { label: string; variant: "error" | "warning" | "info" }> = {
  caliente: { label: "Caliente", variant: "error" },
  tibio: { label: "Tibio", variant: "warning" },
  frio: { label: "Frío", variant: "info" },
};

const DAY_MS = 24 * 3_600_000;

function isRecent(iso: string | null | undefined, now: number): boolean {
  const t = iso ? new Date(iso).getTime() : NaN;
  return Number.isFinite(t) && now - t < DAY_MS;
}

/** Caliente = dio zona, talla o color hace poco; Frío = dejó de responder; si no, Tibio. */
export function temperatureOf(
  c: Pick<Conversation, "hotAt" | "lastInboundAt">,
  now = Date.now(),
): TemperatureKey {
  if (isRecent(c.hotAt, now)) return "caliente";
  return isRecent(c.lastInboundAt, now) ? "tibio" : "frio";
}

/** Chat abierto con señal de compra reciente: va primero en la lista. */
export function isReadyToBuy(
  c: Pick<Conversation, "hotAt" | "lastInboundAt" | "status">,
  now = Date.now(),
): boolean {
  return c.status === "open" && temperatureOf(c, now) === "caliente";
}
