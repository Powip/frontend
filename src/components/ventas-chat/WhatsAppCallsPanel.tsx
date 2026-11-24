"use client";
import { Loader2, PhoneIncoming, PhoneOutgoing } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useCallSessionStats, useCallsConfig, useLiveCalls } from "@/hooks/useCallSessions";
import { useCrmMe } from "@/hooks/useCrmMe";
import type { CallSession } from "@/types/crmCallSessions";
import { formatCallDuration } from "./calls";
import { showPhone } from "./format";
import { requestWhatsAppCall } from "./WhatsAppCallOverlay";

const STATUS_LABEL: Record<CallSession["status"], string> = {
  ringing: "Sonando",
  active: "En llamada",
  ended: "Terminada",
  missed: "Perdida",
  rejected: "Rechazada",
  failed: "Falló",
};

const STATUS_TONE: Partial<Record<CallSession["status"], string>> = {
  ringing: "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300",
  active: "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300",
};

function Kpi({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-semibold tabular-nums">{value}</p>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function SessionRow({ s, action }: { s: CallSession; action?: React.ReactNode }) {
  const { phoneMasked } = useCrmMe();
  const Icon = s.direction === "in" ? PhoneIncoming : PhoneOutgoing;
  return (
    <li className="flex flex-wrap items-center gap-2 rounded-md border bg-card p-2 text-sm">
      <Icon className="h-4 w-4 text-primary" aria-hidden />
      <span className="min-w-0 flex-1 break-words sm:truncate font-medium">
        {s.contactName?.trim() || showPhone(s.contactPhone, phoneMasked) || "Cliente"}
      </span>
      <span className={`rounded-full border px-2 py-0.5 text-[11px] ${STATUS_TONE[s.status] ?? "border-slate-300 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-300"}`}>
        {STATUS_LABEL[s.status]}
      </span>
      {s.agentUserName && <span className="text-xs text-muted-foreground">{s.agentUserName}</span>}
      {s.durationSeconds != null && (
        <span className="text-xs text-muted-foreground">{formatCallDuration(s.durationSeconds)}</span>
      )}
      {s.simulated && <Badge variant="outline">Simulada</Badge>}
      {action}
    </li>
  );
}

/** Llamadas reales de WhatsApp: métricas de hoy, en curso y pendientes de resultado. */
export default function WhatsAppCallsPanel() {
  const { auth } = useAuth();
  const live = useLiveCalls(!!auth?.user?.id);
  const stats = useCallSessionStats(1);
  const config = useCallsConfig();
  const st = stats.data;
  const pending = live.data?.pendingResult ?? [];
  const current = live.data?.live ?? [];

  return (
    <section aria-label="Llamadas por WhatsApp" className="space-y-3 rounded-xl border p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-semibold">Llamadas por WhatsApp</h2>
        {config.data && !config.data.enabled && (
          <span className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[11px] text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
            Modo prueba (simulado)
          </span>
        )}
        {config.data?.recording && (
          <span className="rounded-full border border-rose-300 bg-rose-50 px-2 py-0.5 text-[11px] text-rose-700 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-300">
            Grabación activa
          </span>
        )}
        {stats.isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-label="Cargando" />}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          label="Llamadas hoy / contestadas"
          value={st ? `${st.total} / ${st.answered}` : "—"}
          hint={st ? `${st.incoming} recibidas · ${st.outgoing} hechas` : undefined}
        />
        <Kpi label="Perdidas hoy" value={st?.missed ?? "—"} />
        <Kpi
          label="Tiempo en llamada"
          value={st ? `${st.totalMinutes} min` : "—"}
          hint={st ? `Promedio ${formatCallDuration(st.avgSeconds)}` : undefined}
        />
        <Kpi
          label="Minutos que cobra Meta"
          value={st?.metaMinutes != null ? `${st.metaMinutes} min` : "—"}
          hint="Solo llamadas que hace la vendedora"
        />
        <Kpi
          label="En curso ahora"
          value={st ? st.ringingNow + st.activeNow : "—"}
          hint={st ? `${st.pendingResult} sin resultado` : undefined}
        />
      </div>

      {current.length > 0 && (
        <div className="space-y-1.5">
          <h3 className="text-xs font-semibold text-muted-foreground">En curso</h3>
          <ul className="space-y-1.5">
            {current.map((s) => (
              <SessionRow key={s.id} s={s} />
            ))}
          </ul>
        </div>
      )}

      {pending.length > 0 && (
        <div className="space-y-1.5">
          <h3 className="text-xs font-semibold text-muted-foreground">Falta anotar el resultado</h3>
          <ul className="space-y-1.5">
            {pending.map((s) => (
              <SessionRow
                key={s.id}
                s={s}
                action={
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => requestWhatsAppCall({ kind: "result", session: s })}
                  >
                    Anotar resultado
                  </Button>
                }
              />
            ))}
          </ul>
        </div>
      )}

      <p className="text-[11px] text-muted-foreground">
        Las llamadas que recibes no tienen costo. Las que haces tú las cobra Meta por minuto y necesitan
        el permiso del cliente.
        {config.data?.recording ? " Al cliente se le avisa que la llamada puede ser grabada." : ""}
      </p>
    </section>
  );
}
