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
import { useCrmMe } from "@/hooks/useCrmMe";
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
import { formatMoney } from "./format";

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

/** Respuestas y ventas a 7 días (las agrega ms-crm al listar). */
type BroadcastWithResults = Broadcast & { replies?: number; sales?: number; salesAmount?: number };

function BroadcastRow({
  b,
  stages,
  canManage,
  onAction,
}: {
  b: BroadcastWithResults;
  stages: Stage[];
  canManage: boolean;
  onAction: (action: BroadcastAction, b: Broadcast) => void;
}) {
  const info = BROADCAST_STATUS[b.status];
  const pct = broadcastProgress(b);
  const stageName = stages.find((s) => s.id === b.audience.stageId)?.name;
  const actions = canManage ? broadcastActions(b.status) : [];
  const when =
    b.status === "scheduled" && b.scheduledAt
      ? formatWhen(b.scheduledAt)
      : b.status === "sent"
        ? formatWhen(b.finishedAt ?? b.startedAt)
        : null;
  const sales = b.sales ?? 0;
  return (
    <tr data-testid="broadcast-row" className="border-t align-top">
      <td className="px-3 py-2">
        <span className="font-semibold">{b.name}</span>
        <span className="block text-[11px] text-muted-foreground">
          Plantilla {b.templateName}
          {b.createdByName ? ` · Creada por ${b.createdByName}` : ""}
        </span>
      </td>
      <td className="px-3 py-2 text-xs">
        {audienceLabel(b.audience, stageName)}
        {b.total > 0 && <span className="block text-muted-foreground">{b.total} contactos</span>}
      </td>
      <td className="px-3 py-2">
        <Badge className={TONE_CLASS[info.tone]}>{info.label}</Badge>
        {when && <span className="block pt-0.5 text-[11px] text-muted-foreground">{when}</span>}
        {(b.status === "sending" || b.status === "paused") && (
          <div className="mt-1 w-28 space-y-0.5">
            <Progress value={pct} aria-label={`Progreso de ${b.name}`} />
            <span className="text-[11px] text-muted-foreground">
              <b className="tabular-nums">{b.sentCount}</b> de <b className="tabular-nums">{b.total}</b>
              {b.failedCount > 0 && ` · ${b.failedCount} fallidos`}
            </span>
          </div>
        )}
      </td>
      <td className="px-3 py-2 text-right tabular-nums" data-testid="bc-delivered">
        {b.status === "draft" ? "—" : b.deliveredCount}
      </td>
      <td className="px-3 py-2 text-right tabular-nums" data-testid="bc-read">
        {b.status === "draft" ? "—" : b.readCount}
      </td>
      <td className="px-3 py-2 text-right tabular-nums" data-testid="bc-replies">
        {b.status === "draft" ? "—" : (b.replies ?? 0)}
      </td>
      <td className="px-3 py-2 text-right font-semibold tabular-nums" data-testid="bc-sales">
        {sales > 0 ? `${sales} · ${formatMoney(b.salesAmount ?? 0)}` : "—"}
      </td>
      <td className="whitespace-nowrap px-3 py-2 text-right">
        <div className="flex flex-wrap justify-end gap-1">
          {actions.includes("edit") && (
            <Button type="button" size="sm" variant="outline" onClick={() => onAction("edit", b)}>
              <Pencil /> {b.status === "draft" ? "Continuar" : "Editar"}
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
              variant="ghost"
              aria-label={`Eliminar difusión ${b.name}`}
              onClick={() => onAction("delete", b)}
            >
              <Trash2 />
            </Button>
          )}
        </div>
      </td>
    </tr>
  );
}

const HEAD: Array<[string, boolean]> = [
  ["Difusión", false],
  ["Público", false],
  ["Estado", false],
  ["Entregados", true],
  ["Leídos", true],
  ["Respuestas", true],
  ["Ventas", true],
  ["", false],
];

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
  // R4: solo el administrador crea y maneja difusiones (el backend también lo exige).
  const { isAdmin } = useCrmMe();

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
      <details className="rounded-md border bg-muted/30 p-3 text-sm">
        <summary className="cursor-pointer font-medium">Cómo funcionan las difusiones</summary>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
          <li>Solo plantillas aprobadas por Meta (Marketing o Utilidad). Meta cobra por mensaje entregado a la cuenta del negocio.</li>
          <li>Nunca se envían a quien pidió baja. Solo aplican a chats de WhatsApp.</li>
          <li>Las respuestas entran a la Bandeja; las ventas se atribuyen a la difusión por 7 días.</li>
        </ul>
      </details>

      <section aria-label="Difusiones" className="space-y-3 rounded-lg border bg-card p-4">
        <div className="flex flex-wrap items-start gap-2">
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold">Difusiones</h2>
            <p className="text-xs text-muted-foreground">
              Mensajes masivos a públicos del CRM: recompra, lanzamientos y perdidos.
            </p>
          </div>
          <LiveIndicator state={live} />
          {isAdmin ? (
            <Button type="button" size="sm" onClick={() => setDialog({})}>
              <Plus /> Nueva difusión
            </Button>
          ) : (
            <span className="rounded-full bg-[#4C2FB5]/10 px-2 py-0.5 text-[11px] font-medium text-[#4C2FB5] dark:text-violet-300">
              Solo el administrador crea difusiones
            </span>
          )}
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
        <div className="relative overflow-x-auto rounded-md border">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground">
              <tr>
                {HEAD.map(([h, right], i) => (
                  <th key={i} className={right ? "px-3 py-2 text-right font-medium" : "px-3 py-2 font-medium"}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {list.data.map((b) => (
                <BroadcastRow key={b.id} b={b} stages={stages} canManage={isAdmin} onAction={onAction} />
              ))}
            </tbody>
          </table>
        </div>
      )}
      </section>

      {isAdmin && dialog && (
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
