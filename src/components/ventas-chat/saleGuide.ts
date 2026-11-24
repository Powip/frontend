import type { Conversation } from "@/types/crm";
import type { ScriptClosingRules, ScriptStep } from "@/types/crmContent";
import type { Client } from "@/interfaces/ICliente";

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

export const ENVIO_TEXT =
  "En Lima el delivery es gratis y HOY mismo podemos despachar. ¿A qué dirección deseas que te enviemos?";
export const PAGO_TEXT =
  "Puedes pagar con Yape o tarjeta desde el link que te envío. Es seguro y te llega tu comprobante. ¿Cómo prefieres pagar?";

type ClientPlace = Pick<Client, "city" | "province">;

/** Ciudad del cliente si está fuera de Lima; null si es de Lima o no se sabe. */
function provinceCity(client: ClientPlace | null | undefined): string | null {
  const city = (client?.city || client?.province || "").trim();
  return city && !/lima|callao/i.test(city) ? city : null;
}

/** Respuesta rápida «/envío»: delivery en Lima o agencia en provincia. */
export function envioText(client?: ClientPlace | null): string {
  const city = provinceCity(client);
  if (!city) return ENVIO_TEXT;
  return `Sí hacemos envíos a ${city} por Shalom con envío gratis y HOY mismo podemos despachar. ¿A qué agencia deseas que te enviemos?`;
}

function hoursUntil(t: number, now: number): number {
  return Number.isFinite(t) && t > now ? Math.ceil((t - now) / HOUR_MS) : 0;
}

/** Horas que faltan para que cierre la ventana (redondeo hacia arriba); 0 si ya cerró. */
export function windowHoursLeft(c: Pick<Conversation, "windowExpiresAt">, now = Date.now()): number {
  return c.windowExpiresAt ? hoursUntil(new Date(c.windowExpiresAt).getTime(), now) : 0;
}

type ChannelWindow = Pick<Conversation, "channel" | "lastInboundAt" | "windowExpiresAt">;

/** Meta da 24 h de respuesta libre y hasta 7 días como «agente humano». */
function hasHumanAgentWindow(c: ChannelWindow): boolean {
  return c.channel === "instagram" || c.channel === "messenger";
}

/** Horas de respuesta libre que quedan (en Instagram y Messenger, 24 h). */
export function replyHoursLeft(c: ChannelWindow, now = Date.now()): number {
  const left = windowHoursLeft(c, now);
  if (!hasHumanAgentWindow(c) || !c.lastInboundAt) return left;
  return Math.min(left, hoursUntil(new Date(c.lastInboundAt).getTime() + DAY_MS, now));
}

/** Pasaron las 24 h, pero aún se puede responder como agente humano. */
export function isHumanAgentOnly(c: ChannelWindow, now = Date.now()): boolean {
  return hasHumanAgentWindow(c) && windowHoursLeft(c, now) > 0 && replyHoursLeft(c, now) === 0;
}

/** Hora actual de Lima en minutos desde medianoche. */
function limaMinutes(now: Date): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Lima",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? 0) % 24;
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return h * 60 + m;
}

/** «Despacho hoy» antes de la hora de corte de Lima; si ya pasó, «Despacho mañana». */
export function dispatchText(
  rules: Pick<ScriptClosingRules, "cutoffTime"> | undefined,
  now = new Date(),
): string | null {
  const match = rules?.cutoffTime?.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const cutoff = Number(match[1]) * 60 + Number(match[2]);
  return limaMinutes(now) < cutoff ? `Despacho hoy si confirma antes de ${rules?.cutoffTime}` : "Despacho mañana";
}

/** Paso actual del guion (0 = primero), acotado a los pasos que existen. */
export function currentStep(c: Pick<Conversation, "scriptStep">, steps: ScriptStep[]): number {
  const raw = typeof c.scriptStep === "number" ? c.scriptStep : 0;
  return Math.max(0, Math.min(raw, steps.length - 1));
}
