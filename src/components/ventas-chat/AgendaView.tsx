"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, Check, ChevronDown, ChevronRight, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { crmError } from "@/services/crmService";
import { useCrmEvents } from "@/hooks/useCrmChat";
import { useTaskMutations, useTasks } from "@/hooks/useCrmPlanning";
import type { Task } from "@/types/crm";
import { CRM_UNREACHABLE } from "./ConversationList";
import ConfirmDialog from "./ConfirmDialog";
import LiveIndicator from "./LiveIndicator";
import TaskDialog, { type TaskDialogMode } from "./TaskDialog";
import { TASK_TYPE_LABEL, formatDue, groupTasks } from "./agenda";
import { bandejaUrl } from "./format";

function useNow(intervalMs = 60_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

interface RowProps {
  task: Task;
  now: number;
  overdue?: boolean;
  onDone: (t: Task) => void;
  onReschedule: (t: Task) => void;
  onEdit: (t: Task) => void;
  onDelete: (t: Task) => void;
  onOpenChat: (id: string) => void;
}

function TaskRow({ task, now, overdue, onDone, onReschedule, onEdit, onDelete, onOpenChat }: RowProps) {
  const contact = task.contactName || task.contactPhone;
  return (
    <li
      data-testid="task-row"
      className={cn(
        "space-y-1.5 rounded-md border bg-card p-3 text-sm",
        overdue && "border-destructive/50",
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary">{TASK_TYPE_LABEL[task.type]}</Badge>
        <span className="font-medium">{task.title}</span>
        <span className={cn("ml-auto text-xs", overdue ? "font-medium text-destructive" : "text-muted-foreground")}>
          {formatDue(task.dueAt, now)}
        </span>
      </div>
      {task.note && <p className="whitespace-pre-wrap text-xs text-muted-foreground">{task.note}</p>}
      {(contact || task.assignedUserName) && (
        <p className="text-xs text-muted-foreground">
          {contact}
          {contact && task.assignedUserName ? " · " : ""}
          {task.assignedUserName ? `Asignada a ${task.assignedUserName}` : ""}
        </p>
      )}
      <div className="flex flex-wrap gap-2 pt-1">
        <Button type="button" size="sm" onClick={() => onDone(task)}>
          <Check /> Hecha
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => onReschedule(task)}>
          <CalendarClock /> Reprogramar
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => onEdit(task)}>
          <Pencil /> Editar
        </Button>
        {task.conversationId && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => onOpenChat(task.conversationId!)}
          >
            Abrir chat
          </Button>
        )}
        <Button
          type="button"
          size="sm"
          variant="outline"
          aria-label={`Eliminar tarea ${task.title}`}
          onClick={() => onDelete(task)}
        >
          <Trash2 /> Eliminar
        </Button>
      </div>
    </li>
  );
}

/** Agenda de la vendedora: pendientes vencidos, de hoy y próximos (hora Lima). */
export default function AgendaView() {
  const router = useRouter();
  const live = useCrmEvents();
  const now = useNow();
  const [assigned, setAssigned] = useState<"me" | "all">("me");
  const [showDone, setShowDone] = useState(false);
  const [dialog, setDialog] = useState<{ mode: TaskDialogMode; task?: Task } | null>(null);
  const [deleting, setDeleting] = useState<Task | null>(null);
  const pending = useTasks({ assigned, status: "pending" });
  const done = useTasks({ assigned, status: "done" }, showDone);
  const m = useTaskMutations();

  const groups = groupTasks(pending.data ?? [], now);
  const err = pending.isError ? crmError(pending.error) : null;
  const handlers = {
    now,
    onDone: (t: Task) => m.update.mutate({ id: t.id, input: { status: "done" as const } }),
    onReschedule: (t: Task) => setDialog({ mode: "reschedule", task: t }),
    onEdit: (t: Task) => setDialog({ mode: "edit", task: t }),
    onDelete: setDeleting,
    onOpenChat: (id: string) => router.push(bandejaUrl(id)),
  };

  const sections: Array<{ key: keyof typeof groups; title: string; empty: string }> = [
    { key: "overdue", title: "Vencidas", empty: "Nada vencido." },
    { key: "today", title: "Hoy", empty: "Sin pendientes para hoy." },
    { key: "upcoming", title: "Próximas", empty: "Sin pendientes próximos." },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Tareas de" className="flex gap-1">
          {(
            [
              ["me", "Mías"],
              ["all", "Todas"],
            ] as const
          ).map(([value, label]) => (
            <Button
              key={value}
              type="button"
              size="sm"
              variant={assigned === value ? "default" : "outline"}
              aria-pressed={assigned === value}
              onClick={() => setAssigned(value)}
            >
              {label}
            </Button>
          ))}
        </div>
        <Button type="button" size="sm" onClick={() => setDialog({ mode: "create" })}>
          <Plus /> Nueva tarea
        </Button>
        <span className="ml-auto">
          <LiveIndicator state={live} />
        </span>
      </div>

      {pending.isLoading && (
        <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando agenda…
        </p>
      )}
      {err && (
        <div role="alert" className="space-y-2 text-sm">
          <p className="font-medium text-destructive">
            {err.unreachable ? CRM_UNREACHABLE : err.message}
          </p>
          <Button size="sm" variant="outline" onClick={() => pending.refetch()}>
            Reintentar
          </Button>
        </div>
      )}

      {pending.data && (
        <div className="grid gap-4 lg:grid-cols-3">
          {sections.map((s) => (
            <section key={s.key} aria-label={s.title} className="space-y-2">
              <h2
                className={cn(
                  "flex items-center gap-2 text-sm font-semibold",
                  s.key === "overdue" && "text-destructive",
                )}
              >
                {s.title}
                <Badge variant="secondary">{groups[s.key].length}</Badge>
              </h2>
              {groups[s.key].length === 0 ? (
                <p className="rounded-md border border-dashed p-3 text-center text-xs text-muted-foreground">
                  {s.empty}
                </p>
              ) : (
                <ul className="space-y-2">
                  {groups[s.key].map((t) => (
                    <TaskRow key={t.id} task={t} overdue={s.key === "overdue"} {...handlers} />
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      )}

      <section aria-label="Hechas" className="space-y-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-expanded={showDone}
          onClick={() => setShowDone((v) => !v)}
        >
          {showDone ? <ChevronDown /> : <ChevronRight />} Hechas
        </Button>
        {showDone && (
          <>
            {done.isLoading && (
              <p role="status" className="text-sm text-muted-foreground">
                Cargando…
              </p>
            )}
            {done.isError && (
              <p role="alert" className="text-sm font-medium text-destructive">
                {crmError(done.error).message}
              </p>
            )}
            {done.data?.length === 0 && (
              <p className="text-sm text-muted-foreground">Aún no hay tareas hechas.</p>
            )}
            <ul className="space-y-1.5">
              {done.data?.map((t) => (
                <li
                  key={t.id}
                  data-testid="done-row"
                  className="flex flex-wrap items-center gap-2 rounded-md border p-2 text-sm text-muted-foreground"
                >
                  <Check className="h-4 w-4 text-emerald-600" />
                  <span className="line-through">{t.title}</span>
                  <span className="text-xs">{t.contactName || t.contactPhone}</span>
                  {t.doneAt && <span className="ml-auto text-xs">{formatDue(t.doneAt, now)}</span>}
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      {dialog && (
        <TaskDialog
          open
          mode={dialog.mode}
          task={dialog.task}
          onOpenChange={(o) => !o && setDialog(null)}
        />
      )}
      <ConfirmDialog
        open={!!deleting}
        title="Eliminar tarea"
        description={deleting ? `Se eliminará «${deleting.title}». No se puede deshacer.` : ""}
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) m.remove.mutate(deleting.id);
          setDeleting(null);
        }}
      />
    </div>
  );
}
