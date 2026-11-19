"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useTaskMutations } from "@/hooks/useCrmPlanning";
import type { Task, TaskType } from "@/types/crm";
import { TASK_TYPE_LABEL, fromLimaInput, toLimaInput } from "./agenda";
import { NATIVE_SELECT_CLASS } from "./format";

export type TaskDialogMode = "create" | "edit" | "reschedule";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode?: TaskDialogMode;
  /** Tarea a editar o reprogramar. */
  task?: Task;
  /** Conversación a la que se vincula una tarea nueva. */
  conversationId?: string;
  /** Nombre del contacto, solo para el texto de ayuda. */
  contact?: string;
}

/** Primera hora en punto desde ahora, en hora Lima. */
function defaultDue() {
  const d = new Date(Date.now() + 3_600_000);
  d.setMinutes(0, 0, 0);
  return toLimaInput(d.toISOString());
}

/** Crear, editar o reprogramar una tarea de la Agenda. */
export default function TaskDialog({
  open,
  onOpenChange,
  mode = "create",
  task,
  conversationId,
  contact,
}: Props) {
  const m = useTaskMutations();
  const [type, setType] = useState<TaskType>(task?.type ?? "message");
  const [title, setTitle] = useState(task?.title ?? "");
  const [note, setNote] = useState(task?.note ?? "");
  const [due, setDue] = useState(task ? toLimaInput(task.dueAt) : defaultDue());
  const pending = m.create.isPending || m.update.isPending;
  const valid = mode === "reschedule" ? !!due : !!title.trim() && !!due;
  const done = { onSuccess: () => onOpenChange(false) };

  const submit = () => {
    if (!valid || pending) return;
    const dueAt = fromLimaInput(due);
    if (mode === "create") {
      m.create.mutate(
        {
          ...(conversationId ? { conversationId } : {}),
          type,
          title: title.trim(),
          ...(note.trim() ? { note: note.trim() } : {}),
          dueAt,
        },
        done,
      );
    } else if (task && mode === "reschedule") {
      m.update.mutate({ id: task.id, input: { dueAt } }, done);
    } else if (task) {
      m.update.mutate(
        { id: task.id, input: { type, title: title.trim(), note: note.trim() || null, dueAt } },
        done,
      );
    }
  };

  const heading =
    mode === "create" ? "Nueva tarea" : mode === "edit" ? "Editar tarea" : "Reprogramar tarea";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{heading}</DialogTitle>
          <DialogDescription>
            {mode === "reschedule"
              ? task?.title
              : contact
                ? `Recordatorio para ${contact}.`
                : "Queda asignada a ti. La hora es de Lima."}
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          {mode !== "reschedule" && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="task-type">Tipo</Label>
                <select
                  id="task-type"
                  className={cn(NATIVE_SELECT_CLASS, "h-9 text-sm")}
                  value={type}
                  onChange={(e) => setType(e.target.value as TaskType)}
                >
                  {(Object.keys(TASK_TYPE_LABEL) as TaskType[]).map((t) => (
                    <option key={t} value={t}>
                      {TASK_TYPE_LABEL[t]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="task-title">Título</Label>
                <Input
                  id="task-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ej.: Preguntar si decidió el pedido"
                  maxLength={160}
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="task-note">Nota (opcional)</Label>
                <Textarea
                  id="task-note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                  maxLength={500}
                />
              </div>
            </>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="task-due">Fecha y hora</Label>
            <Input
              id="task-due"
              type="datetime-local"
              value={due}
              onChange={(e) => setDue(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!valid || pending}>
              {mode === "create" ? "Crear tarea" : "Guardar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
