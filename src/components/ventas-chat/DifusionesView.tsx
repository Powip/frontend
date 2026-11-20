"use client";
import { useState } from "react";
import { Loader2, Pause, Pencil, Play, Plus, Send, Trash2, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { crmError } from "@/services/crmService";
import { useCrmEvents } from "@/hooks/useCrmChat";
import {
  useAudienceCount,
  useBroadcastMutations,
  useBroadcasts,
  useTemplates,
} from "@/hooks/useCrmEngagement";
import { usePipelines } from "@/hooks/useCrmPlanning";
import type { Broadcast, Stage } from "@/types/crm";
import BroadcastDialog from "./BroadcastDialog";
import ConfirmDialog from "./ConfirmDialog";
import { CRM_UNREACHABLE } from "./ConversationList";
import LiveIndicator from "./LiveIndicator";
import {
  BROADCAST_STATUS,
  TONE_CLASS,
  audienceLabel,
  broadcastActions,
  broadcastProgress,
  type BroadcastAction,
} from "./engagement";

function formatWhen(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleString("es-PE", {
    timeZone: "America/Lima",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <span>
      <b className="tabular-nums">{value}</b> {label}
    </span>
  );
}

function BroadcastRow({
  b,
  stages,
  onAction,
}: {
  b: Broadcast;
  stages: Stage[];
  onAction: (action: BroadcastAction, b: Broadcast) => void;
}) {
  const info = BROADCAST_STATUS[b.status];
  const pct = broadcastProgress(b);
  const stageName = stages.find((s) => s.id === b.audience.stageId)?.name;
  const actions = broadcastActions(b.status);
  const schedule =
    b.status === "scheduled" && b.scheduledAt ? `Sale el ${formatWhen(b.scheduledAt)}` : null;
  return (
    <li data-testid="broadcast-row" className="space-y-2 rounded-md border bg-card p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">{b.name}</span>
        <Badge className={TONE_CLASS[info.tone]}>{info.label}</Badge>
        {schedule && <span className="text-xs text-muted-foreground">{schedule}</span>}
      </div>
      <p className="text-xs text-muted-foreground">
        Plantilla {b.templateName} · Público: {audienceLabel(b.audience, stageName)}
        {b.createdByName ? ` · Creada por ${b.createdByName}` : ""}
      </p>
      {b.status !== "draft" && (
        <div className="space-y-1">
          <Progress value={pct} aria-label={`Progreso de ${b.name}`} />
          <p className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
            <span>
              <b className="tabular-nums">{b.sentCount}</b> de{" "}
              <b className="tabular-nums">{b.total}</b> enviados
            </span>
            <Metric label="entregados" value={b.deliveredCount} />
            <Metric label="leídos" value={b.readCount} />
            <Metric label="fallidos" value={b.failedCount} />
          </p>
        </div>
      )}
      {actions.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-1">
          {actions.includes("edit") && (
            <Button type="button" size="sm" variant="outline" onClick={() => onAction("edit", b)}>
              <Pencil /> Editar
            </Button>
          )}
          {actions.includes("send") && (
            <Button type="button" size="sm" onClick={() => onAction("send", b)}>
              <Send /> Enviar
            </Button>
          )}
          {actions.includes("pause") && (
            <Button type="button" size="sm" variant="outline" onClick={() => onAction("pause", b)}>
              <Pause /> Pausar
            </Button>
          )}
          {actions.includes("resume") && (
            <Button type="button" size="sm" variant="outline" onClick={() => onAction("resume", b)}>
              <Play /> Reanudar
            </Button>
          )}
          {actions.includes("cancel") && (
            <Button type="button" size="sm" variant="outline" onClick={() => onAction("cancel", b)}>
              <XCircle /> Cancelar
            </Button>
          )}
          {actions.includes("delete") && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              aria-label={`Eliminar difusión ${b.name}`}
              onClick={() => onAction("delete", b)}
            >
              <Trash2 /> Eliminar
            </Button>
          )}
        </div>
      )}
    </li>
  );
}

/** Confirmación de envío de un borrador: dice a cuántas personas llegará. */
function SendDraftConfirm({ b, onClose }: { b: Broadcast; onClose: () => void }) {
  const count = useAudienceCount(b.audience);
  const m = useBroadcastMutations();
  const n = count.data;
  const canSend = typeof n === "number" && n > 0;
  const text = count.isLoading
    ? "Contando a quién se enviará…"
    : count.isError
      ? `No se pudo contar el público: ${crmError(count.error).message}`
      : n === 0
        ? "El público está vacío: no hay a quién enviar."
        : `Se enviará «${b.name}» a ${n} ${n === 1 ? "persona" : "personas"} ahora. El envío va por lotes y solo entre las 07:00 y las 20:00 (hora de Lima). Los mensajes enviados no se pueden recuperar.`;
  return (
    <ConfirmDialog
      open
      title="Confirmar envío"
      description={text}
      confirmLabel={canSend ? "Sí, enviar" : "Entendido"}
      onCancel={onClose}
      onConfirm={() => {
        if (canSend) m.send.mutate({ id: b.id });
        onClose();
      }}
    />
  );
}

type DialogState = { broadcast?: Broadcast } | null;

/** Pestaña Difusiones: envíos masivos con plantilla y progreso en vivo. */
export default function DifusionesView() {
  const live = useCrmEvents();
  const list = useBroadcasts();
  const pipelines = usePipelines();
  const templates = useTemplates();
  const m = useBroadcastMutations();
  const [dialog, setDialog] = useState<DialogState>(null);
  const [sending, setSending] = useState<Broadcast | null>(null);
  const [confirm, setConfirm] = useState<{ kind: "delete" | "cancel"; b: Broadcast } | null>(null);
  const stages = pipelines.data?.flatMap((p) => p.stages) ?? [];
  const err = list.isError ? crmError(list.error) : null;

  const onAction = (action: BroadcastAction, b: Broadcast) => {
    if (action === "edit") setDialog({ broadcast: b });
    else if (action === "send") setSending(b);
    else if (action === "pause") m.pause.mutate(b.id);
    else if (action === "resume") m.resume.mutate(b.id);
    else if (action === "cancel") setConfirm({ kind: "cancel", b });
    else setConfirm({ kind: "delete", b });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm text-muted-foreground">
          Envía una plantilla aprobada por Meta a muchos contactos a la vez. Solo aplica a chats de WhatsApp.
        </p>
        <Button type="button" size="sm" className="ml-auto" onClick={() => setDialog({})}>
          <Plus /> Nueva difusión
        </Button>
        <LiveIndicator state={live} />
      </div>

      {list.isLoading && (
        <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando difusiones…
        </p>
      )}
      {err && (
        <div role="alert" className="space-y-2 text-sm">
          <p className="font-medium text-destructive">
            {err.unreachable ? CRM_UNREACHABLE : err.message}
          </p>
          <Button size="sm" variant="outline" onClick={() => list.refetch()}>
            Reintentar
          </Button>
        </div>
      )}
      {list.data && list.data.length === 0 && (
        <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
          Aún no hiciste ninguna difusión.
        </p>
      )}
      {list.data && list.data.length > 0 && (
        <ul className="space-y-2">
          {list.data.map((b) => (
            <BroadcastRow key={b.id} b={b} stages={stages} onAction={onAction} />
          ))}
        </ul>
      )}

      {dialog && (
        <BroadcastDialog
          open
          broadcast={dialog.broadcast}
          stages={stages}
          templates={templates.data}
          templatesLoading={templates.isLoading}
          templatesError={templates.isError ? crmError(templates.error).message : null}
          onOpenChange={(o) => !o && setDialog(null)}
        />
      )}
      {sending && <SendDraftConfirm b={sending} onClose={() => setSending(null)} />}
      <ConfirmDialog
        open={!!confirm}
        title={confirm?.kind === "cancel" ? "Cancelar difusión" : "Eliminar difusión"}
        description={
          !confirm
            ? ""
            : confirm.kind === "cancel"
              ? `Se detendrá «${confirm.b.name}». Lo ya enviado no se puede recuperar y no se podrá reanudar.`
              : `Se eliminará «${confirm.b.name}». No se puede deshacer.`
        }
        confirmLabel={confirm?.kind === "cancel" ? "Sí, cancelar" : "Eliminar"}
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          if (confirm?.kind === "cancel") m.cancel.mutate(confirm.b.id);
          else if (confirm) m.remove.mutate(confirm.b.id);
          setConfirm(null);
        }}
      />
    </div>
  );
}
