"use client";
import WhatsAppCallButton, { CALL_BUTTON_CLASS } from "./WhatsAppCallButton";
import WhatsAppCallsPanel from "./WhatsAppCallsPanel";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Info, Loader2, MessageCircle, PhoneCall, PhoneIncoming, PhoneOutgoing, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useCrmMe } from "@/hooks/useCrmMe";
import { isMaskedPhone, telHref } from "@/lib/crmPhone";
import { crmError } from "@/services/crmService";
import { useCrmEvents } from "@/hooks/useCrmChat";
import { useCallMode } from "@/hooks/useCallMode";
import { useCallPermission, useCallSessionStats } from "@/hooks/useCallSessions";
import { useCallMutations, useCallProspects, useCallStats, useCalls } from "@/hooks/useCrmCalls";
import { useTaskMutations, useTasks } from "@/hooks/useCrmPlanning";
import type { Call, CallDays, CallStats } from "@/types/crmCalls";
import { CRM_UNREACHABLE } from "./ConversationList";
import CallDialog from "./CallDialog";
import ConfirmDialog from "./ConfirmDialog";
import LiveIndicator from "./LiveIndicator";
import { CALL_REASON_LABEL, CALL_REASON_TONE, callQueue, type CallQueueItem } from "./callQueue";
import {
  CALL_DAYS_OPTIONS,
  CALL_DIRECTION_LABEL,
  CALL_RESULT_LABEL,
  CALL_RESULT_TONE,
  answeredPercent,
  callContact,
  formatCallDuration,
} from "./calls";
import { bandejaUrl, formatMoney, showPhone } from "./format";

function Segmented<T extends string | number>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div role="group" aria-label={label} className="flex gap-1">
      {options.map((o) => (
        <Button
          key={String(o.value)}
          type="button"
          size="sm"
          variant={o.value === value ? "default" : "outline"}
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </Button>
      ))}
    </div>
  );
}

const MINE_OPTIONS = [
  { value: "me" as const, label: "Mías" },
  { value: "all" as const, label: "Todas" },
];

function Kpi({
  label,
  value,
  hint,
  testId,
  tone,
}: {
  label: string;
  value: string | number;
  hint?: string;
  testId: string;
  tone?: string;
}) {
  return (
    <div className="rounded-lg border bg-card p-4" data-testid={testId}>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className={cn("text-2xl font-semibold tabular-nums", tone)}>{value}</p>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

/** «2 min 10 s» para el promedio por llamada. */
function avgLabel(seconds: number): string {
  if (!seconds) return "Sin llamadas contestadas";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `Promedio ${m ? `${m} min ` : ""}${s} s por llamada`;
}

function ErrorBox({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const e = crmError(error);
  return (
    <div role="alert" className="space-y-2 text-sm">
      <p className="font-medium text-destructive">{e.unreachable ? CRM_UNREACHABLE : e.message}</p>
      <Button size="sm" variant="outline" onClick={onRetry}>
        Reintentar
      </Button>
    </div>
  );
}

function CallLink({ phone }: { phone: string | null | undefined }) {
  const href = telHref(phone);
  if (!href) {
    return (
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled
        title={
          isMaskedPhone(phone)
            ? "El teléfono está oculto: llama por WhatsApp"
            : "No hay un teléfono para llamar"
        }
      >
        <PhoneCall /> Llamar por teléfono
      </Button>
    );
  }
  return (
    <Button asChild size="sm" variant="outline">
      <a href={href}>
        <PhoneCall /> Llamar por teléfono
      </a>
    </Button>
  );
}

const PERIOD_LABEL: Record<CallDays, string> = { 1: "hoy", 7: "en 7 días", 30: "en 30 días" };

function Stats({ days }: { days: CallDays }) {
  const stats = useCallStats(days);
  // Llamadas reales por WhatsApp: promedio y minutos que cobra Meta.
  const live = useCallSessionStats(days);
  if (stats.isLoading) {
    return (
      <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Cargando resumen…
      </p>
    );
  }
  if (stats.isError) return <ErrorBox error={stats.error} onRetry={() => stats.refetch()} />;
  const s = stats.data as (CallStats & { soldAmount?: number }) | undefined;
  if (!s) return null;
  const avg = live.data?.avgSeconds || (s.answered ? Math.round((s.totalMinutes * 60) / s.answered) : 0);
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" data-testid="call-kpis">
      <Kpi
        testId="kpi-calls"
        label={`Llamadas ${PERIOD_LABEL[days]}`}
        value={s.calls}
        hint={`${s.answered} contestadas (${answeredPercent(s.calls, s.answered)} %)`}
      />
      <Kpi
        testId="kpi-sold"
        label="Ventas por llamada"
        value={s.sold}
        tone="text-emerald-600 dark:text-emerald-400"
        hint={`${formatMoney(s.soldAmount ?? 0)} cobrado durante la llamada`}
      />
      <Kpi testId="kpi-minutes" label="Tiempo en llamada" value={`${s.totalMinutes} min`} hint={avgLabel(avg)} />
      <Kpi
        testId="kpi-meta"
        label="Minutos que cobra Meta"
        value={`${live.data?.metaMinutes ?? 0} min`}
        tone="text-amber-600 dark:text-amber-400"
        hint="Solo llamadas que hace la vendedora"
      />
    </div>
  );
}

/** Motivo, vendedora y si el cliente aceptó que lo llamen. */
function useRowSummary({ detail, agentName, conversationId }: CallQueueItem): string {
  const { data } = useCallPermission(conversationId);
  const permission = data && (data.canCall ? "aceptó llamadas" : "falta permiso");
  return [detail, agentName, permission].filter(Boolean).join(" · ");
}

function QueueRow({
  item,
  position,
  onResult,
  onOpenChat,
}: {
  item: CallQueueItem;
  position: number;
  onResult: (item: CallQueueItem) => void;
  onOpenChat: (id: string) => void;
}) {
  const { phoneMasked } = useCrmMe();
  const summary = useRowSummary(item);
  const { conversationId, contactName, contactPhone, reason, task } = item;
  return (
    <li data-testid="queue-row" className="space-y-1.5 rounded-md border bg-card p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="w-5 text-xs font-semibold tabular-nums text-muted-foreground">{position}</span>
        <span className="font-medium">{contactName || showPhone(contactPhone, phoneMasked) || "Sin contacto"}</span>
        <Badge variant="outline" className={cn("ml-auto", CALL_REASON_TONE[reason])}>
          {CALL_REASON_LABEL[reason]}
        </Badge>
      </div>
      <p className="text-xs text-muted-foreground">{summary}</p>
      {task && <p className="text-xs">{task.title}</p>}
      <div className="flex flex-wrap gap-2 pt-1">
        {conversationId && (
          <WhatsAppCallButton conversationId={conversationId} contactName={contactName} askLabel="Pedir" />
        )}
        <CallLink phone={contactPhone} />
        {conversationId && (
          <Button type="button" size="sm" variant="outline" onClick={() => onOpenChat(conversationId)}>
            <MessageCircle /> Chat
          </Button>
        )}
        <Button type="button" size="sm" variant="outline" onClick={() => onResult(item)}>
          Registrar resultado
        </Button>
      </div>
    </li>
  );
}

function CallRow({
  call,
  canDelete,
  onDelete,
  onOpenChat,
}: {
  call: Call;
  canDelete: boolean;
  onDelete: (c: Call) => void;
  onOpenChat: (id: string) => void;
}) {
  const Icon = call.direction === "in" ? PhoneIncoming : PhoneOutgoing;
  const { phoneMasked } = useCrmMe();
  return (
    <li data-testid="call-row" className="space-y-1.5 rounded-md border bg-card p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <Icon className="h-4 w-4 text-muted-foreground" aria-label={CALL_DIRECTION_LABEL[call.direction]} />
        <span className="font-medium">{callContact(call, phoneMasked)}</span>
        <Badge variant="outline" className={cn(CALL_RESULT_TONE[call.result])}>
          {CALL_RESULT_LABEL[call.result]}
        </Badge>
        <span className="ml-auto text-xs text-muted-foreground">
          {new Date(call.createdAt).toLocaleString("es-PE", {
            timeZone: "America/Lima",
            day: "2-digit",
            month: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          })}
        </span>
      </div>
      <p className="text-xs text-muted-foreground">
        {CALL_DIRECTION_LABEL[call.direction]} · {formatCallDuration(call.durationSeconds)}
        {call.userName ? ` · ${call.userName}` : ""}
      </p>
      {call.notes && <p className="whitespace-pre-wrap text-xs">{call.notes}</p>}
      <div className="flex flex-wrap gap-2 pt-1">
        {call.conversationId && (
          <Button type="button" size="sm" variant="outline" onClick={() => onOpenChat(call.conversationId!)}>
            <MessageCircle /> Chat
          </Button>
        )}
        {canDelete && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            aria-label={`Eliminar llamada con ${callContact(call, phoneMasked)}`}
            onClick={() => onDelete(call)}
          >
            <Trash2 /> Eliminar
          </Button>
        )}
      </div>
    </li>
  );
}

/**
 * Pestaña Llamadas: registro manual de las llamadas que el equipo hace con su
 * teléfono, y llamadas reales por WhatsApp (WhatsAppCallsPanel + overlay).
 */
export default function LlamadasView() {
  const router = useRouter();
  const { auth } = useAuth();
  const meId = auth?.user?.id;
  const { isAdmin, phoneMasked } = useCrmMe();
  const live = useCrmEvents();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const [days, setDays] = useState<CallDays>(1);
  const [queueOwner, setQueueOwner] = useState<"me" | "all">("me");
  const [historyOwner, setHistoryOwner] = useState<"me" | "all">("me");
  const [dialog, setDialog] = useState<{ item?: CallQueueItem } | null>(null);
  const [deleting, setDeleting] = useState<Call | null>(null);

  const tasks = useTasks({ assigned: queueOwner, status: "pending" });
  const prospects = useCallProspects(queueOwner);
  const startCallMode = useCallMode();
  const history = useCalls({ days, mine: historyOwner === "me" });
  const taskM = useTaskMutations();
  const callM = useCallMutations();

  const queue = callQueue(tasks.data ?? [], prospects.data ?? [], now);
  const openChat = (id: string) => router.push(bandejaUrl(id));

  return (
    <div className="space-y-5">
      <div
        role="note"
        className="flex items-start gap-2 rounded-md border border-sky-300 bg-sky-50 p-3 text-sm text-sky-900 dark:border-sky-800 dark:bg-sky-950/30 dark:text-sky-200"
      >
        <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <p>
          Contesta y haz llamadas por WhatsApp desde Powip: al colgar anotas el resultado. Las
          llamadas que haces con tu teléfono las registras a mano con «Registrar llamada».
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Segmented label="Periodo" options={CALL_DAYS_OPTIONS} value={days} onChange={setDays} />
        <Button type="button" size="sm" onClick={() => setDialog({})}>
          <Plus /> Registrar llamada
        </Button>
        <span className="ml-auto">
          <LiveIndicator state={live} />
        </span>
      </div>

      <WhatsAppCallsPanel />

      <Stats days={days} />

      <div className="grid gap-5 lg:grid-cols-2">
        <section aria-label="Cola de llamadas" className="space-y-2 rounded-lg border bg-card p-4">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold">Cola de llamadas</h2>
            <Badge variant="secondary">{queue.length}</Badge>
            <span className="ml-auto">
              <Segmented label="Cola de" options={MINE_OPTIONS} value={queueOwner} onChange={setQueueOwner} />
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2 rounded-md border border-teal-600/30 bg-teal-50 p-3 dark:bg-teal-950/30">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">Modo llamadas</p>
              <p className="text-xs text-muted-foreground">
                Tu cola de hoy, ordenada por probabilidad de compra. Al colgar pasa a la siguiente.
              </p>
            </div>
            <Button type="button" size="sm" className={CALL_BUTTON_CLASS} onClick={() => void startCallMode(queue)}>
              <PhoneCall /> Empezar a llamar
            </Button>
          </div>
          {tasks.isLoading && (
            <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Cargando cola…
            </p>
          )}
          {tasks.isError && <ErrorBox error={tasks.error} onRetry={() => tasks.refetch()} />}
          {prospects.isError && <ErrorBox error={prospects.error} onRetry={() => prospects.refetch()} />}
          {tasks.data && !prospects.isLoading && queue.length === 0 && (
            <div className="rounded-md border border-dashed p-3 text-center text-xs text-muted-foreground">
              <p>No hay llamadas pendientes.</p>
              <p>Cuando un cliente agende o deje un link sin pagar, aparecerá aquí.</p>
            </div>
          )}
          <ul className="space-y-2">
            {queue.map((item, i) => (
              <QueueRow
                key={item.key}
                item={item}
                position={i + 1}
                onResult={(row) => setDialog({ item: row })}
                onOpenChat={openChat}
              />
            ))}
          </ul>
        </section>

        <section aria-label="Historial de llamadas" className="space-y-2 rounded-lg border bg-card p-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="min-w-0">
              <h2 className="text-sm font-semibold">{days === 1 ? "Llamadas de hoy" : `Llamadas ${PERIOD_LABEL[days]}`}</h2>
              <p className="text-xs text-muted-foreground">Resultado, duración y notas de cada llamada.</p>
            </div>
            <span className="ml-auto">
              <Segmented label="Historial de" options={MINE_OPTIONS} value={historyOwner} onChange={setHistoryOwner} />
            </span>
          </div>
          {history.isLoading && (
            <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Cargando historial…
            </p>
          )}
          {history.isError && <ErrorBox error={history.error} onRetry={() => history.refetch()} />}
          {history.data && history.data.length === 0 && (
            <p className="rounded-md border border-dashed p-3 text-center text-xs text-muted-foreground">
              Aún no hay llamadas registradas en este periodo.
            </p>
          )}
          <ul className="space-y-2">
            {history.data?.map((c) => (
              <CallRow
                key={c.id}
                call={c}
                canDelete={isAdmin || (!!meId && c.userId === meId)}
                onDelete={setDeleting}
                onOpenChat={openChat}
              />
            ))}
          </ul>
        </section>
      </div>

      {dialog && (
        <CallDialog
          open
          onOpenChange={(o) => !o && setDialog(null)}
          conversationId={dialog.item?.conversationId ?? undefined}
          contact={dialog.item ? (dialog.item.contactName || showPhone(dialog.item.contactPhone, phoneMasked) || undefined) : undefined}
          phone={isMaskedPhone(dialog.item?.contactPhone) ? undefined : (dialog.item?.contactPhone ?? undefined)}
          onSaved={() => {
            const task = dialog.item?.task;
            if (task) taskM.update.mutate({ id: task.id, input: { status: "done" } });
          }}
        />
      )}
      <ConfirmDialog
        open={!!deleting}
        title="Eliminar llamada"
        description={
          deleting ? `Se eliminará la llamada con ${callContact(deleting, phoneMasked)} del registro. No se puede deshacer.` : ""
        }
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) callM.remove.mutate(deleting.id);
          setDeleting(null);
        }}
      />
    </div>
  );
}
