"use client";
import { useEffect, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { WhatsAppAudioCall } from "@/lib/webrtcCall";
import { sendCallLiveAi } from "@/services/crmCallSessionsService";
import type { CallLiveAiState, LiveSpeaker } from "@/types/crmCallSessions";

/** Cada cuánto suma una frase la llamada de ejemplo (modo de prueba, sin llave). */
export const DEMO_TICK_MS = 3500;
/** Largo de cada trozo de audio real que se transcribe. */
const CHUNK_MS = 6000;

export const LIVE_AI_OFF_TEXT = "La IA en vivo está apagada en Canales y tiendas.";
export const LIVE_AI_RING_TIP = "Abre con el precio y termina con «¿Para dónde lo deseas?».";

/** Graba un stream en trozos de audio sueltos (cada trozo se transcribe solo). */
function recordChunks(stream: MediaStream, onChunk: (blob: Blob) => void): () => void {
  if (typeof MediaRecorder === "undefined") return () => undefined;
  let stopped = false;
  let recorder: MediaRecorder | null = null;
  const next = () => {
    if (stopped) return;
    const parts: Blob[] = [];
    recorder = new MediaRecorder(stream);
    recorder.ondataavailable = (e) => e.data.size && parts.push(e.data);
    recorder.onstop = () => {
      if (parts.length) onChunk(new Blob(parts, { type: recorder?.mimeType || "audio/webm" }));
      next();
    };
    recorder.start();
    setTimeout(() => recorder?.state === "recording" && recorder.stop(), CHUNK_MS);
  };
  next();
  return () => {
    stopped = true;
    if (recorder?.state === "recording") recorder.stop();
  };
}

/**
 * IA en vivo (mockup 152): transcripción, «La IA sugiere» y pasos del guion que
 * marca sola. Con llave de transcripción escucha el audio real; sin llave corre
 * una llamada de ejemplo para probar en local.
 */
export default function CallLiveAi({
  callId,
  enabled,
  ringing,
  audioCall,
  onState,
}: {
  callId: string;
  /** Ajuste «La IA escucha y sugiere en vivo». */
  enabled: boolean;
  ringing: boolean;
  audioCall: WhatsAppAudioCall | null;
  /** Avisa pasos cumplidos y resumen para la tarjeta de resultado. */
  onState?: (state: CallLiveAiState) => void;
}) {
  const [state, setState] = useState<CallLiveAiState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const onStateRef = useRef(onState);
  onStateRef.current = onState;
  const live = enabled && !ringing;

  useEffect(() => {
    if (!live) return;
    let cancelled = false;
    let busy = false;
    const push = async (chunk?: { audio: Blob; speaker: LiveSpeaker }) => {
      if (busy && !chunk) return;
      busy = true;
      try {
        const next = await sendCallLiveAi(callId, chunk);
        if (cancelled) return;
        setState(next);
        setError(null);
        onStateRef.current?.(next);
        return next;
      } catch {
        if (!cancelled) setError("La IA no pudo escuchar este tramo.");
      } finally {
        busy = false;
      }
    };
    const stops: Array<() => void> = [];
    // Primera pasada: dice el modo. Sin llave (mock) sigue la llamada de ejemplo.
    void push().then((first) => {
      if (cancelled || !first) return;
      if (first.mode === "mock") {
        const timer = setInterval(() => {
          void push().then((s) => s?.done && clearInterval(timer));
        }, DEMO_TICK_MS);
        stops.push(() => clearInterval(timer));
        return;
      }
      const mic = audioCall?.localStream;
      const customer = audioCall?.remoteStream;
      if (mic) stops.push(recordChunks(mic, (audio) => void push({ audio, speaker: "agent" })));
      if (customer) stops.push(recordChunks(customer, (audio) => void push({ audio, speaker: "customer" })));
    });
    return () => {
      cancelled = true;
      stops.forEach((stop) => stop());
    };
  }, [live, callId, audioCall]);

  const tip = !enabled ? LIVE_AI_OFF_TEXT : ringing || !state ? LIVE_AI_RING_TIP : state.tip;
  return (
    <div className="space-y-2" aria-label="IA en vivo">
      <div className="rounded-lg border border-primary/30 bg-primary/5 p-2">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-primary">
          <Sparkles className="h-3.5 w-3.5" aria-hidden /> La IA sugiere
          {state?.mode === "mock" && (
            <span className="ml-auto rounded-full bg-amber-100 px-1.5 text-[10px] font-medium text-amber-800">
              Modo prueba · sin llave
            </span>
          )}
        </p>
        <p className="mt-1 text-xs" role="status">
          {tip}
        </p>
      </div>
      <div className="rounded-lg border p-2">
        <p className="text-xs font-semibold">
          Transcripción en vivo{" "}
          {!enabled && <span className="font-normal text-muted-foreground">(apagada)</span>}
        </p>
        <div className="mt-1 max-h-40 space-y-1 overflow-y-auto text-xs" aria-live="polite">
          {enabled && !state?.lines.length && (
            <p className="text-muted-foreground">{ringing ? "Empieza cuando contesten." : "Escuchando…"}</p>
          )}
          {state?.lines.map((l, i) => (
            <p key={i} className={cn(l.who === "agent" ? "text-teal-800 dark:text-teal-300" : "")}>
              <b>{l.who === "agent" ? "Tú" : "Cliente"}:</b> {l.text}
              {l.objection && (
                <span className="ml-1 rounded-full bg-amber-100 px-1.5 text-[10px] text-amber-800">
                  Objeción · {l.objection}
                </span>
              )}
            </p>
          ))}
        </div>
        {error && <p className="mt-1 text-[11px] text-rose-700">{error}</p>}
      </div>
    </div>
  );
}
