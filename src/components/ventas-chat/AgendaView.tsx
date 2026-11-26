"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, Check, ChevronDown, ChevronRight, Loader2, MessageCircle, Pencil, Phone, Plus, Send, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { crmError } from "@/services/crmService";
import { useCrmEvents } from "@/hooks/useCrmChat";
import { useCrmMe } from "@/hooks/useCrmMe";
import { useTaskMutations, useTasks } from "@/hooks/useCrmPlanning";
import { useCrmSettings, useTeamMembers } from "@/hooks/useCrmTeam";
import type { Task } from "@/types/crm";
import { CRM_UNREACHABLE } from "./ConversationList";
import ConfirmDialog from "./ConfirmDialog";
import LiveIndicator from "./LiveIndicator";
import TaskDialog, { type TaskDialogMode } from "./TaskDialog";
import { TASK_TYPE_LABEL, formatDue, groupTasks } from "./agenda";
import { bandejaUrl, showPhone } from "./format";

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
  /** Próximos días no muestran «Posponer» (mockup 152). */
  canPostpone?: boolean;
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}

function TaskRow({ task, now, overdue, canPostpone = true, onDone, onReschedule, onEdit, onDelete, onOpenChat }: RowProps) {
  const { phoneMasked } = useCrmMe();
  const contact = task.contactName || showPhone(task.contactPhone, phoneMasked);
  return (
    <li
      data-testid="task-row"
      className={cn(
        "space-y-1.5 rounded-md border bg-card p-3 text-sm",
        overdue && "border-destructive/50",
      )}
    >
      <div className="flex items-center gap-2">
        <span
          aria-hidden
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#4C2FB5]/10 text-xs font-semibold text-[#4C2FB5] dark:text-violet-300"
        >
          {initials(contact || task.title)}
        </span>
        <span className="min-w-0 flex-1 truncate font-medium">{contact || task.title}</span>
        <Badge variant="secondary" className={task.type === "call" ? "bg-[#4C2FB5]/10 text-[#4C2FB5] dark:text-violet-300" : undefined}>
          {TASK_TYPE_LABEL[task.type]}
        </Badge>
      </div>
      <p className="text-xs">
        <span className={cn(overdue ? "font-medium text-destructive" : "text-muted-foreground")}>
          {formatDue(task.dueAt, now)}
        </span>
        {" · "}
        <span className="font-medium">{task.title}</span>
      </p>
      {task.note && (
        <p className="whitespace-pre-wrap rounded-md bg-muted/50 p-2 text-xs text-muted-foreground">{task.note}</p>
      )}
      {task.assignedUserName && (
        <p className="text-xs text-muted-foreground">{`Asignada a ${task.assignedUserName}`}</p>
      )}
      <div className="flex flex-wrap gap-2 pt-1">
        {task.conversationId && task.type !== "other" && (
          <Button
            type="button"
            size="sm"
            className="bg-[#4C2FB5] text-white hover:bg-[#4C2FB5]/90"
            onClick={() => onOpenChat(task.conversationId!)}
          >
            {task.type === "call" ? (
              <>
                <Phone /> Llamar
              </>
            ) : (
              <>
                <Send /> Enviar
              </>
            )}
          </Button>
        )}
        <Button type="button" size="sm" variant="outline" onClick={() => onDone(task)}>
          <Check /> Hecha
        </Button>
        {canPostpone && (
          <Button type="button" size="sm" variant="outline" onClick={() => onReschedule(task)}>
            <CalendarClock /> Posponer
          </Button>
        )}
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
            <MessageCircle /> Abrir chat
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
  const { phoneMasked, isAdmin } = useCrmMe();
  // "me", "all" o el id de una vendedora (filtro en la lista de todo el equipo).
  const [who, setWho] = useState<string>("me");
  const assigned: "me" | "all" = who === "me" ? "me" : "all";
  const members = useTeamMembers();
  const settings = useCrmSettings(isAdmin);
  const hours = settings.data?.hours;
  const [showDone, setShowDone] = useState(false);
  const [dialog, setDialog] = useState<{ mode: TaskDialogMode; task?: Task } | null>(null);
  const [deleting, setDeleting] = useState<Task | null>(null);
  const pending = useTasks({ assigned, status: "pending" });
  const done = useTasks({ assigned, status: "done" }, showDone);
  const m = useTaskMutations();

  const visible = (pending.data ?? []).filter((t) => who === "me" || who === "all" || t.assignedUserId === who);
  const groups = groupTasks(visible, now);
  const err = pending.isError ? crmError(pending.error) : null;
  const handlers = {
    now,
    onDone: (t: Task) => m.update.mutate({ id: t.id, input: { status: "done" as const } }),
    onReschedule: (t: Task) => setDialog({ mode: "reschedule", task: t }),
    onEdit: (t: Task) => setDialog({ mode: "edit", task: t }),
    onDelete: setDeleting,
    onOpenChat: (id: string) => router.push(bandejaUrl(id)),
  };

  const sections: Array<{ key: keyof typeof groups; title: string; empty: string; tone: string }> = [
    { key: "overdue", title: "Vencidos", empty: "Nada vencido. ¡Bien!", tone: "border-t-destructive text-destructive" },
    { key: "today", title: "Hoy en tu turno", empty: "Sin pendientes para hoy", tone: "border-t-[#4C2FB5] text-[#4C2FB5] dark:text-violet-300" },
    { key: "upcoming", title: "Próximos días", empty: "Sin pendientes próximos", tone: "border-t-teal-600 text-teal-700 dark:text-teal-400" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-sm font-medium">
          Agenda de
          <select
            aria-label="Agenda de"
            className="h-8 rounded-md border bg-background px-2 text-sm"
            value={who}
            onChange={(e) => setWho(e.target.value)}
          >
            <option value="me">Mis pendientes</option>
            <option value="all">Todo el equipo</option>
            {(members.data ?? []).map((p) => (
              <option key={p.userId} value={p.userId}>
                {p.userName}
              </option>
            ))}
          </select>
        </label>
        {hours && (
          <span className="rounded-full bg-[#4C2FB5]/10 px-2 py-0.5 text-xs font-medium text-[#4C2FB5] dark:text-violet-300">
            Turno: {hours.start} – {hours.end}
          </span>
        )}
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
            <section
              key={s.key}
              aria-label={s.title}
              className={cn("space-y-2 rounded-lg border border-t-4 bg-card p-3", s.tone.split(" ")[0])}
            >
              <h2 className={cn("flex items-center gap-2 text-sm font-semibold", s.tone.split(" ").slice(1).join(" "))}>
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
                    <TaskRow key={t.id} task={t} overdue={s.key === "overdue"} canPostpone={s.key !== "upcoming"} {...handlers} />
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
                  <span className="text-xs">{t.contactName || showPhone(t.contactPhone, phoneMasked)}</span>
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
