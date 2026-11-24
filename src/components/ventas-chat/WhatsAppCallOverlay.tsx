"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Mic, MicOff, Phone, PhoneIncoming, PhoneOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useCallPermission, useCallSessionMutations, useCallsConfig, useLiveCalls } from "@/hooks/useCallSessions";
import { WhatsAppAudioCall } from "@/lib/webrtcCall";
import { cn } from "@/lib/utils";
import { crmError } from "@/services/crmService";
import { acceptCall, hangupCall, rejectCall, startCall } from "@/services/crmCallSessionsService";
import type { CallSession } from "@/types/crmCallSessions";
import CallLiveTools from "./CallLiveTools";
import CallResultCard, { type CallOutcome } from "./CallResultCard";
import CallScript from "./CallScript";
import CallShell, { contactOf, formatTimer } from "./CallShell";

export { formatTimer };

export const WA_CALL_EVENT = "powip:wa-call";

interface CallRequest {
  kind: "call";
  conversationId: string;
  contactName?: string | null;
  /** El permiso ya se revisó: llama sin preguntar. */
  start?: { simulated: boolean };
  /** Modo llamadas: al guardar ofrece pasar al siguiente. */
  queueMode?: boolean;
  onSaved?: (next: boolean) => void;
}

export type WhatsAppCallRequest =
  | CallRequest
  | { kind: "result"; session: CallSession };

/** Abre el flujo de llamada por WhatsApp desde cualquier pantalla de Ventas por chat. */
export function requestWhatsAppCall(detail: WhatsAppCallRequest) {
  window.dispatchEvent(new CustomEvent<WhatsAppCallRequest>(WA_CALL_EVENT, { detail }));
}

type Phase =
  | { name: "idle" }
  | { name: "permission"; conversationId: string; contactName: string | null }
  | { name: "connecting"; contactName: string | null; direction: "in" | "out" }
  | { name: "live"; session: CallSession }
  | { name: "result"; session: CallSession };

/**
 * Llamadas reales de WhatsApp: contesta las entrantes, hace las salientes
 * (pide permiso si hace falta), cuelga y anota el resultado.
 */
export default function WhatsAppCallOverlay() {
  const { auth } = useAuth();
  const meId = auth?.user?.id ?? null;
  const live = useLiveCalls(!!meId);
  const config = useCallsConfig();
  const m = useCallSessionMutations();

  const [phase, setPhase] = useState<Phase>({ name: "idle" });
  const [muted, setMuted] = useState(false);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const audio = useRef<WhatsAppAudioCall | null>(null);
  const answerApplied = useRef<string | null>(null);
  // Momento en que empezó la llamada en curso: datos de /live anteriores no la conocen todavía.
  const liveSince = useRef(0);
  // Pedido de la llamada saliente; null en las entrantes y en las pendientes de resultado.
  const [request, setRequest] = useState<CallRequest | null>(null);
  const [doneSteps, setDoneSteps] = useState<number[]>([]);

  const closeAudio = useCallback(() => {
    audio.current?.close();
    audio.current = null;
    answerApplied.current = null;
    setMuted(false);
  }, []);

  useEffect(() => () => closeAudio(), [closeAudio]);

  // Reloj de la llamada.
  useEffect(() => {
    if (phase.name !== "live") return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [phase.name]);

  // Sigue la llamada en curso con cada consulta de /live.
  const liveSessionId = phase.name === "live" ? phase.session.id : null;
  useEffect(() => {
    if (!liveSessionId || !live.data) return;
    const current = live.data.live.find((s) => s.id === liveSessionId);
    if (!current) {
      // Consulta hecha antes de crear la llamada: espera la siguiente.
      if (live.dataUpdatedAt < liveSince.current) return;
      // El cliente colgó (o no contestó): pasa a anotar el resultado.
      const ended =
        live.data.pendingResult.find((s) => s.id === liveSessionId) ??
        (phase.name === "live" ? { ...phase.session, status: "ended" as const } : null);
      closeAudio();
      if (ended) setPhase({ name: "result", session: ended });
      return;
    }
    if (current.direction === "out" && current.sdpAnswer && answerApplied.current !== current.id) {
      answerApplied.current = current.id;
      void audio.current?.applyAnswer(current.sdpAnswer);
    }
    setPhase((p) => (p.name === "live" && p.session.id === current.id ? { name: "live", session: current } : p));
    // phase.session solo se usa como respaldo cuando la llamada ya no está.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live.data, live.dataUpdatedAt, liveSessionId, closeAudio]);

  const incoming =
    phase.name === "idle"
      ? live.data?.live.find(
          (s) => s.direction === "in" && s.status === "ringing" && !s.agentUserId && !dismissed.includes(s.id),
        ) ?? null
      : null;

  const begin = (next: CallRequest | null) => {
    setRequest(next);
    setDoneSteps([]);
  };

  const answer = async (s: CallSession) => {
    begin(null);
    setPhase({ name: "connecting", contactName: contactOf(s), direction: "in" });
    const call = new WhatsAppAudioCall();
    audio.current = call;
    try {
      // Con el interruptor apagado todo es simulado: no se pide micrófono.
      const sdp = await call.answer(s.sdpOffer, s.simulated || config.data?.enabled === false);
      const session = await acceptCall(s.id, sdp);
      liveSince.current = Date.now();
      setPhase({ name: "live", session });
      void live.refetch();
    } catch (err) {
      closeAudio();
      setPhase({ name: "idle" });
      setDismissed((d) => [...d, s.id]);
      toast.error(crmError(err).message);
    }
  };

  const decline = async (s: CallSession) => {
    setDismissed((d) => [...d, s.id]);
    try {
      await rejectCall(s.id);
      void live.refetch();
    } catch (err) {
      toast.error(crmError(err).message);
    }
  };

  const call = async (conversationId: string, contactName: string | null, simulated: boolean) => {
    setPhase({ name: "connecting", contactName, direction: "out" });
    const audioCall = new WhatsAppAudioCall();
    audio.current = audioCall;
    try {
      const sdp = await audioCall.offer(simulated);
      const session = await startCall(conversationId, sdp);
      liveSince.current = Date.now();
      setPhase({ name: "live", session });
      void live.refetch();
    } catch (err) {
      closeAudio();
      const e = crmError(err);
      if (e.code === "CALL_PERMISSION_REQUIRED") {
        setPhase({ name: "permission", conversationId, contactName });
      } else {
        setPhase({ name: "idle" });
      }
      toast.error(e.message);
    }
  };

  const hangup = async (s: CallSession) => {
    try {
      const ended = await hangupCall(s.id);
      closeAudio();
      setPhase({ name: "result", session: ended });
      void live.refetch();
    } catch (err) {
      toast.error(crmError(err).message);
    }
  };

  // Pedidos desde la cola, el chat o el panel de llamadas. Se vuelve a suscribir
  // en cada render para decidir con la fase actual.
  useEffect(() => {
    const onRequest = (ev: Event) => {
      const detail = (ev as CustomEvent<WhatsAppCallRequest>).detail;
      if (!detail) return;
      if (phase.name === "live" || phase.name === "connecting") {
        toast.error("Ya tienes una llamada en curso.");
        return;
      }
      begin(detail.kind === "call" ? detail : null);
      if (detail.kind === "result") {
        setPhase({ name: "result", session: detail.session });
        return;
      }
      const contactName = detail.contactName ?? null;
      if (detail.start) void call(detail.conversationId, contactName, detail.start.simulated);
      else setPhase({ name: "permission", conversationId: detail.conversationId, contactName });
    };
    window.addEventListener(WA_CALL_EVENT, onRequest);
    return () => window.removeEventListener(WA_CALL_EVENT, onRequest);
  });

  const saveResult = (session: CallSession, { input, closing, lostReason, next }: CallOutcome) => {
    const { conversationId } = session;
    m.saveResult.mutate(
      { id: session.id, input },
      {
        onSuccess: () => {
          setPhase({ name: "idle" });
          if (conversationId && closing) m.sendToChat.mutate({ conversationId, body: closing });
          if (conversationId && lostReason) m.markLost.mutate({ conversationId, lostReason });
          request?.onSaved?.(next);
        },
      },
    );
  };

  const recording = config.data?.recording === true;

  return (
    <>
      {incoming && (
        <IncomingCard
          session={incoming}
          onAnswer={() => answer(incoming)}
          onDecline={() => decline(incoming)}
        />
      )}
      {phase.name === "permission" && (
        <PermissionCard
          conversationId={phase.conversationId}
          contactName={phase.contactName}
          sending={m.requestPermission.isPending}
          onRequest={() => m.requestPermission.mutate(phase.conversationId)}
          onCall={(simulated) => call(phase.conversationId, phase.contactName, simulated)}
          onClose={() => setPhase({ name: "idle" })}
        />
      )}
      {phase.name === "connecting" && (
        <CallShell title={phase.contactName || "Cliente"}>
          <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            {phase.direction === "in" ? "Contestando…" : "Llamando por WhatsApp…"}
          </p>
        </CallShell>
      )}
      {phase.name === "live" && (
        <LiveCard
          session={phase.session}
          now={now}
          muted={muted}
          recording={recording}
          onMute={() => {
            setMuted((v) => {
              audio.current?.setMuted(!v);
              return !v;
            });
          }}
          onHangup={() => hangup(phase.session)}
          doneSteps={doneSteps}
          onToggleStep={(i) =>
            setDoneSteps((steps) => (steps.includes(i) ? steps.filter((s) => s !== i) : [...steps, i]))
          }
        />
      )}
      {phase.name === "result" && (
        <CallResultCard
          key={phase.session.id}
          session={phase.session}
          saving={m.saveResult.isPending}
          queueMode={request?.queueMode === true}
          doneSteps={doneSteps}
          onClose={() => setPhase({ name: "idle" })}
          onSave={(outcome) => saveResult(phase.session, outcome)}
        />
      )}
    </>
  );
}

function SimulatedNote({ simulated }: { simulated: boolean }) {
  if (!simulated) return null;
  return (
    <p className="rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-[11px] text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
      Modo prueba: WhatsApp Calling está apagado, la llamada es simulada y no tiene audio.
    </p>
  );
}

function IncomingCard({
  session,
  onAnswer,
  onDecline,
}: {
  session: CallSession;
  onAnswer: () => void;
  onDecline: () => void;
}) {
  return (
    <CallShell title={contactOf(session)} label="Llamada entrante de WhatsApp">
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <PhoneIncoming className="h-4 w-4 text-primary" aria-hidden /> Te llama por WhatsApp…
      </p>
      {session.contactName && session.contactPhone && (
        <p className="text-xs text-muted-foreground">{session.contactPhone}</p>
      )}
      <SimulatedNote simulated={session.simulated} />
      <div className="flex gap-2">
        <Button type="button" className="flex-1" onClick={onAnswer}>
          <Phone /> Contestar
        </Button>
        <Button type="button" variant="destructive" className="flex-1" onClick={onDecline}>
          <PhoneOff /> Rechazar
        </Button>
      </div>
    </CallShell>
  );
}

function PermissionCard({
  conversationId,
  contactName,
  sending,
  onRequest,
  onCall,
  onClose,
}: {
  conversationId: string;
  contactName: string | null;
  sending: boolean;
  onRequest: () => void;
  onCall: (simulated: boolean) => void;
  onClose: () => void;
}) {
  const perm = useCallPermission(conversationId);
  const state = perm.data;
  return (
    <CallShell title={contactName || "Cliente"} onClose={onClose} label="Llamar por WhatsApp">
      {perm.isLoading && (
        <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Revisando permiso…
        </p>
      )}
      {perm.isError && (
        <p role="alert" className="text-sm text-destructive">
          {crmError(perm.error).message}
        </p>
      )}
      {state && <SimulatedNote simulated={state.simulated} />}
      {state?.canCall && (
        <>
          <p className="text-sm text-muted-foreground">El cliente dio permiso para recibir llamadas.</p>
          <Button type="button" className="w-full" onClick={() => onCall(state.simulated)}>
            <Phone /> Llamar
          </Button>
        </>
      )}
      {state && !state.canCall && (
        <>
          <p className="text-sm font-medium">Pedir permiso para llamar</p>
          <div className="space-y-2 rounded-lg border bg-muted/50 p-3 text-sm">
            <p>{state.message ?? "¿Te puedo llamar 1 minuto por WhatsApp para ayudarte con tu pedido?"}</p>
            <div className="flex gap-2 text-xs">
              <span className="rounded-md border bg-card px-2 py-1">📞 Sí, llámenme</span>
              <span className="rounded-md border bg-card px-2 py-1">Ahora no</span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Si el cliente acepta, el botón Llamar se activa. Las llamadas que hace la vendedora las
            cobra Meta por minuto.
          </p>
          {state.status === "pending" || state.sent ? (
            <p role="status" className="text-xs text-primary">
              Pedido enviado. Esperando la respuesta del cliente…
            </p>
          ) : null}
          <div className="flex gap-2">
            <Button
              type="button"
              className="flex-1"
              disabled={sending || !state.canRequest}
              onClick={onRequest}
            >
              {sending && <Loader2 className="animate-spin" />} Enviar pedido de permiso
            </Button>
            <Button type="button" variant="outline" onClick={() => perm.refetch()}>
              Revisar
            </Button>
          </div>
          {!state.canRequest && (
            <p className="text-[11px] text-muted-foreground">
              WhatsApp no deja pedir permiso otra vez todavía. Intenta más tarde.
            </p>
          )}
        </>
      )}
    </CallShell>
  );
}

function LiveCard({
  session,
  now,
  muted,
  recording,
  onMute,
  onHangup,
  doneSteps,
  onToggleStep,
}: {
  session: CallSession;
  now: number;
  muted: boolean;
  recording: boolean;
  onMute: () => void;
  onHangup: () => void;
  doneSteps: number[];
  onToggleStep: (step: number) => void;
}) {
  const ringing = session.status === "ringing";
  const since = session.answeredAt ?? session.createdAt;
  const seconds = (now - new Date(since).getTime()) / 1000;
  return (
    <CallShell title={contactOf(session)}>
      <div className="flex items-center justify-between text-sm">
        <span className={cn(ringing ? "text-muted-foreground" : "text-emerald-700 dark:text-emerald-300")}>
          {ringing ? "Llamando por WhatsApp…" : "En llamada"}
        </span>
        <span className="font-mono tabular-nums" aria-label="Tiempo de llamada">
          {formatTimer(ringing ? 0 : seconds)}
        </span>
      </div>
      {session.contactName && session.contactPhone && (
        <p className="text-xs text-muted-foreground">{session.contactPhone}</p>
      )}
      {recording && (
        <p className="inline-flex items-center gap-1.5 rounded-full border border-rose-300 bg-rose-50 px-2 py-0.5 text-[11px] text-rose-700 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-300">
          <span className="h-1.5 w-1.5 rounded-full bg-rose-500" aria-hidden /> Grabando · se avisó al cliente
        </p>
      )}
      <SimulatedNote simulated={session.simulated} />
      <div className="flex gap-2">
        <Button type="button" variant="outline" onClick={onMute} aria-pressed={muted}>
          {muted ? <MicOff /> : <Mic />} {muted ? "Activar micrófono" : "Silenciar"}
        </Button>
        <Button type="button" variant="destructive" className="flex-1" onClick={onHangup}>
          <PhoneOff /> Colgar
        </Button>
      </div>
      <p className="text-[11px] text-muted-foreground">Si no contesta, cuelga y registra el resultado.</p>
      <CallScript title="Guion · Venta en 1 minuto" done={doneSteps} onToggle={onToggleStep} />
      {session.conversationId && <CallLiveTools conversationId={session.conversationId} />}
    </CallShell>
  );
}
