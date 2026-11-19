// FEAT-24 H2-F — sonido corto de error al escanear (Web Audio, sin archivos).
// Si el navegador no tiene audio o lo bloquea, no hace nada: el error se ve igual.

type AudioContextCtor = new () => AudioContext;

let shared: AudioContext | null = null;

function audioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor =
    (window as unknown as { AudioContext?: AudioContextCtor }).AudioContext ??
    (window as unknown as { webkitAudioContext?: AudioContextCtor }).webkitAudioContext;
  if (!Ctor) return null;
  if (!shared || shared.state === "closed") shared = new Ctor();
  return shared;
}

/** Dos pitidos graves de ~0,12 s. */
export function playErrorBeep(): void {
  try {
    const ctx = audioContext();
    if (!ctx) return;
    if (ctx.state === "suspended") void ctx.resume().catch(() => undefined);
    const start = ctx.currentTime;
    for (const offset of [0, 0.16]) {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = "square";
      oscillator.frequency.setValueAtTime(220, start + offset);
      gain.gain.setValueAtTime(0.15, start + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, start + offset + 0.12);
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start(start + offset);
      oscillator.stop(start + offset + 0.12);
    }
  } catch {
    // Sin audio: el aviso en pantalla alcanza.
  }
}

/** FEAT-24 H6-D — un pitido agudo y corto (~0,08 s) cuando el escaneo entró bien. */
export function playSuccessBeep(): void {
  try {
    const ctx = audioContext();
    if (!ctx) return;
    if (ctx.state === "suspended") void ctx.resume().catch(() => undefined);
    const start = ctx.currentTime;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(1320, start);
    gain.gain.setValueAtTime(0.12, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.08);
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start(start);
    oscillator.stop(start + 0.08);
  } catch {
    // Sin audio: el aviso en pantalla alcanza.
  }
}

/** Solo para tests: olvida el contexto compartido. */
export function resetErrorBeepForTests(): void {
  shared = null;
}
