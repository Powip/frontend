import type { Task } from "@/types/crm";

const TZ = "America/Lima";
/** Lima no usa horario de verano: siempre UTC-5. */
const LIMA_OFFSET = "-05:00";

export interface TaskGroups {
  overdue: Task[];
  today: Task[];
  upcoming: Task[];
}

function dayKey(d: Date | string | number) {
  return new Date(d).toLocaleDateString("en-CA", { timeZone: TZ });
}

/**
 * Agrupa tareas pendientes por fecha (hora Lima):
 * Vencidas = ya pasó la hora; Hoy = hoy y aún no pasó; Próximas = otro día.
 * Cada grupo queda ordenado por `dueAt` ascendente.
 */
export function groupTasks(tasks: Task[], now: Date | number = new Date()): TaskGroups {
  const nowMs = new Date(now).getTime();
  const today = dayKey(nowMs);
  const out: TaskGroups = { overdue: [], today: [], upcoming: [] };
  const sorted = [...tasks].sort(
    (a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime(),
  );
  for (const t of sorted) {
    const due = new Date(t.dueAt).getTime();
    if (due < nowMs) out.overdue.push(t);
    else if (dayKey(due) === today) out.today.push(t);
    else out.upcoming.push(t);
  }
  return out;
}

/** ISO → valor de `<input type="datetime-local">` en hora Lima («2026-11-19T15:30»). */
export function toLimaInput(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString("en-CA", { timeZone: TZ });
  const time = d.toLocaleTimeString("en-GB", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return `${date}T${time}`;
}

/** Valor de `datetime-local` interpretado en hora Lima → ISO (UTC). */
export function fromLimaInput(value: string): string {
  return new Date(`${value}:00${LIMA_OFFSET}`).toISOString();
}

export function formatDue(iso: string, now: Date | number = new Date()): string {
  const d = new Date(iso);
  const time = d.toLocaleTimeString("es-PE", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  if (dayKey(d) === dayKey(now)) return `Hoy ${time}`;
  const date = d.toLocaleDateString("es-PE", {
    timeZone: TZ,
    day: "2-digit",
    month: "2-digit",
  });
  return `${date} ${time}`;
}

export const TASK_TYPE_LABEL: Record<Task["type"], string> = {
  message: "Mensaje",
  call: "Llamada",
  other: "Otro",
};
