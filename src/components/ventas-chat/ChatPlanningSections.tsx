"use client";
import { useState } from "react";
import { BellPlus, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { crmError } from "@/services/crmService";
import { useUpdateConversation } from "@/hooks/useCrmChat";
import { usePipelines, useTaskMutations, useTasks } from "@/hooks/useCrmPlanning";
import type { Conversation, Stage } from "@/types/crm";
import LostReasonDialog from "./LostReasonDialog";
import TaskDialog from "./TaskDialog";
import { TASK_TYPE_LABEL, formatDue } from "./agenda";
import { NATIVE_SELECT_CLASS, contactLabel } from "./format";

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      {children}
    </h3>
  );
}

/** Etapa del embudo de la conversación; si es «perdida» pide el motivo. */
export function PipelineSection({ conversation }: { conversation: Conversation }) {
  const pipelines = usePipelines();
  const update = useUpdateConversation(conversation.id);
  const [lost, setLost] = useState<Stage | null>(null);

  const list = pipelines.data;
  const pipeline =
    list?.find((p) => p.id === conversation.pipelineId) ?? list?.find((p) => p.isDefault) ?? list?.[0];
  const current = pipeline?.stages.find((s) => s.id === conversation.stageId);

  const change = (stageId: string) => {
    const stage = pipeline?.stages.find((s) => s.id === stageId);
    if (!stage || stage.id === conversation.stageId) return;
    if (stage.kind === "lost") setLost(stage);
    else update.mutate({ stageId: stage.id });
  };

  return (
    <section className="space-y-2" aria-label="Embudo">
      <SectionTitle>Embudo</SectionTitle>
      {pipelines.isLoading && (
        <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando embudo…
        </p>
      )}
      {pipelines.isError && (
        <p role="alert" className="text-sm text-destructive">
          {crmError(pipelines.error).message}
        </p>
      )}
      {pipeline && (
        <div className="space-y-1.5">
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            {current && (
              <span
                aria-hidden
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: current.color }}
              />
            )}
            {pipeline.name}
          </p>
          <select
            aria-label="Etapa de la conversación"
            className={cn(NATIVE_SELECT_CLASS, "h-9 text-sm")}
            value={current?.id ?? ""}
            disabled={update.isPending}
            onChange={(e) => change(e.target.value)}
          >
            {!current && (
              <option value="" disabled>
                Sin etapa
              </option>
            )}
            {pipeline.stages.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          {current?.kind === "lost" && conversation.lostReason && (
            <p className="text-xs text-muted-foreground">Motivo: {conversation.lostReason}</p>
          )}
        </div>
      )}
      {lost && (
        <LostReasonDialog
          open
          contact={contactLabel(conversation)}
          onCancel={() => setLost(null)}
          onConfirm={(lostReason) => {
            update.mutate({ stageId: lost.id, lostReason });
            setLost(null);
          }}
        />
      )}
    </section>
  );
}

/** Tareas pendientes de la conversación y botón «Recordatorio». */
export function TasksSection({ conversation }: { conversation: Conversation }) {
  const tasks = useTasks({
    assigned: "all",
    status: "pending",
    conversationId: conversation.id,
  });
  const m = useTaskMutations();
  const [creating, setCreating] = useState(false);
  return (
    <section className="space-y-2" aria-label="Tareas">
      <SectionTitle>Tareas</SectionTitle>
      {tasks.isLoading && (
        <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando tareas…
        </p>
      )}
      {tasks.isError && (
        <p role="alert" className="text-sm text-destructive">
          {crmError(tasks.error).message}
        </p>
      )}
      {tasks.data && tasks.data.length === 0 && (
        <p className="text-sm text-muted-foreground">Sin tareas pendientes.</p>
      )}
      {tasks.data && tasks.data.length > 0 && (
        <ul className="space-y-1.5">
          {tasks.data.map((t) => (
            <li
              key={t.id}
              data-testid="chat-task"
              className="flex items-start gap-2 rounded-md border p-2 text-sm"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{t.title}</p>
                <p className="text-xs text-muted-foreground">
                  {TASK_TYPE_LABEL[t.type]} · {formatDue(t.dueAt)}
                </p>
              </div>
              <Button
                type="button"
                size="icon-sm"
                variant="outline"
                aria-label={`Marcar hecha: ${t.title}`}
                onClick={() => m.update.mutate({ id: t.id, input: { status: "done" } })}
              >
                <Check />
              </Button>
            </li>
          ))}
        </ul>
      )}
      <Button type="button" size="sm" variant="outline" onClick={() => setCreating(true)}>
        <BellPlus /> Recordatorio
      </Button>
      {creating && (
        <TaskDialog
          open
          conversationId={conversation.id}
          contact={contactLabel(conversation)}
          onOpenChange={(o) => !o && setCreating(false)}
        />
      )}
    </section>
  );
}
