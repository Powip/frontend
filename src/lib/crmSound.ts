/** Sonidos y avisos de la Bandeja (mismas claves que ms-crm `sound-prefs`). */

export const SOUND_EVENTS = ["msg", "hot", "demora", "sla", "pago", "rech", "call"] as const;
export type SoundEvent = (typeof SOUND_EVENTS)[number];
export const SOUND_TONES = ["ding", "pop", "alerta", "campana", "doble", "grave"] as const;
export type SoundTone = (typeof SOUND_TONES)[number];

/** Evento que solo fija el administrador. */
export const LOCKED_EVENT: SoundEvent = "sla";

export const EVENT_LABEL: Record<SoundEvent, string> = {
  msg: "Mensaje nuevo",
  hot: "Cliente caliente",
  demora: "Demora sin responder",
  sla: "Chat por vencer (SLA)",
  pago: "Pago recibido",
  rech: "Rechazo o pérdida",
  call: "Llamada entrante",
};

export const TONE_LABEL: Record<SoundTone, string> = {
  ding: "Ding",
  pop: "Pop",
  alerta: "Alerta",
  campana: "Campana",
  doble: "Doble",
  grave: "Grave",
};

export interface SoundEventPrefs {
  on: boolean;
  tone: SoundTone;
}

export interface SoundPrefs {
  on: boolean;
  vol: number;
  turno: boolean;
  tab: boolean;
  vibrate: boolean;
  events: Record<SoundEvent, SoundEventPrefs>;
}

export interface SoundPrefsResponse {
  team: SoundPrefs;
  mine: SoundPrefs | null;
  effective: SoundPrefs;
}

/** Notas (Hz) y duración (s) de cada tono. */
const NOTES: Record<SoundTone, { f: number; d: number; wave?: OscillatorType }[]> = {
  ding: [{ f: 880, d: 0.18 }],
  pop: [{ f: 520, d: 0.07, wave: "triangle" }],
  alerta: [
    { f: 740, d: 0.14, wave: "square" },
    { f: 740, d: 0.14, wave: "square" },
  ],
  campana: [
    { f: 988, d: 0.16 },
    { f: 1319, d: 0.28 },
  ],
  doble: [
    { f: 660, d: 0.1 },
    { f: 880, d: 0.14 },
  ],
  grave: [{ f: 196, d: 0.3, wave: "sawtooth" }],
};

export function toneNotes(tone: SoundTone) {
  return NOTES[tone] ?? NOTES.ding;
}

let ctx: AudioContext | null = null;

function audioCtor(): typeof AudioContext | null {
  if (typeof window === "undefined") return null;
  return (
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext ??
    null
  );
}

/** `true` si el navegador ya dejó reproducir sonido (hubo un gesto del usuario). */
export function soundUnlocked(): boolean {
  return !!ctx && ctx.state === "running";
}

/** Crea o reanuda el AudioContext. Debe llamarse desde un clic del usuario. */
export async function unlockSound(): Promise<boolean> {
  const Ctor = audioCtor();
  if (!Ctor) return false;
  if (!ctx) ctx = new Ctor();
  if (ctx.state === "suspended") {
    try {
      await ctx.resume();
    } catch {
      return false;
    }
  }
  return ctx.state === "running";
}

/** Reproduce un tono. Devuelve `false` si no se pudo (sin permiso o sin audio). */
export function playTone(tone: SoundTone, volume: number): boolean {
  if (!ctx || ctx.state !== "running") return false;
  const gainValue = Math.max(0, Math.min(100, volume)) / 100;
  let at = ctx.currentTime;
  for (const note of toneNotes(tone)) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = note.wave ?? "sine";
    osc.frequency.value = note.f;
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, gainValue * 0.4), at + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + note.d);
    osc.connect(gain).connect(ctx.destination);
    osc.start(at);
    osc.stop(at + note.d + 0.02);
    at += note.d + 0.04;
  }
  return true;
}

/** Hora "HH:MM" -> minutos, o null. */
function minutes(value: string | null | undefined): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value ?? "");
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

/** `true` si `now` cae dentro del turno [start, end]. Turno sin definir = siempre dentro. */
export function insideShift(
  now: Date,
  shift?: { start?: string | null; end?: string | null } | null,
): boolean {
  const start = minutes(shift?.start);
  const end = minutes(shift?.end);
  if (start === null || end === null) return true;
  const cur = now.getHours() * 60 + now.getMinutes();
  return start <= end ? cur >= start && cur <= end : cur >= start || cur <= end;
}

export interface ShouldPlayInput {
  prefs: SoundPrefs;
  event: SoundEvent;
  /** Chat al que pertenece el aviso. */
  conversationId?: string | null;
  /** Chat abierto ahora mismo con la pestaña visible. */
  openConversationId?: string | null;
  tabVisible: boolean;
  inShift: boolean;
}

/** Reglas del mockup: apagado general o por evento, sin sonido en el chat abierto y silencio fuera de turno. */
export function shouldPlay(input: ShouldPlayInput): boolean {
  const { prefs, event } = input;
  if (!prefs.on) return false;
  if (!prefs.events[event]?.on) return false;
  if (prefs.turno && !input.inShift) return false;
  if (
    input.tabVisible &&
    input.conversationId &&
    input.openConversationId &&
    input.conversationId === input.openConversationId
  ) {
    return false;
  }
  return true;
}

/** Título de la pestaña con el número de pendientes: «(3) POWIP». */
export function tabTitle(base: string, count: number): string {
  const clean = base.replace(/^\(\d+\)\s*/, "");
  return count > 0 ? `(${count}) ${clean}` : clean;
}

export const SOUND_EVENT_NAME = "crm:sound";

export interface SoundEventDetail {
  event: SoundEvent;
  conversationId?: string | null;
}

/** Lo dispara la capa SSE; lo escucha `useCrmSounds`. */
export function emitSound(detail: SoundEventDetail): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<SoundEventDetail>(SOUND_EVENT_NAME, { detail }));
}
