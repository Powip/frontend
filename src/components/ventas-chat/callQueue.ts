import type { Task } from "@/types/crm";
import type { CallProspect, ProspectReason } from "@/types/crmCalls";
import { formatDue, groupTasks } from "./agenda";

export type CallReason = "scheduled" | ProspectReason;

/** Una fila de la cola de llamadas. */
export interface CallQueueItem {
  key: string;
  reason: CallReason;
  /** «Agendada Hoy 10:00», «Link sin pagar · S/ 89.00»… */
  detail: string;
  conversationId: string | null;
  contactName: string | null;
  contactPhone: string | null;
  agentName: string | null;
  /** Solo las llamadas agendadas vienen de una tarea. */
  task?: Task;
}

export const CALL_REASON_LABEL: Record<CallReason, string> = {
  scheduled: "Agendada",
  link: "Link sin pagar",
  warm: "Tibio",
  cod: "COD · No contesta",
};

export const CALL_REASON_TONE: Record<CallReason, string> = {
  scheduled: "border-teal-600/30 bg-teal-50 text-teal-700",
  link: "border-primary/30 bg-primary/10 text-primary",
  warm: "border-amber-300 bg-amber-50 text-amber-800",
  cod: "border-rose-300 bg-rose-50 text-rose-700",
};

/** Después de las agendadas, por probabilidad de compra. */
const PROSPECT_ORDER: ProspectReason[] = ["link", "warm", "cod"];

function prospectDetail({ reason, total }: CallProspect): string {
  if (reason === "warm") return "Tibio · leyó y no compró";
  if (reason === "cod") return "COD en No contesta";
  return total == null ? "Link sin pagar" : `Link sin pagar · S/ ${total.toFixed(2)}`;
}

function fromTask(task: Task, now: number): CallQueueItem {
  return {
    key: task.id,
    reason: "scheduled",
    detail: `Agendada ${formatDue(task.dueAt, now)}`,
    conversationId: task.conversationId,
    contactName: task.contactName,
    contactPhone: task.contactPhone,
    agentName: task.assignedUserName,
    task,
  };
}

function fromProspect(prospect: CallProspect): CallQueueItem {
  return {
    key: prospect.conversationId,
    reason: prospect.reason,
    detail: prospectDetail(prospect),
    conversationId: prospect.conversationId,
    contactName: prospect.contactName,
    contactPhone: prospect.contactPhone,
    agentName: prospect.assignedUserName,
  };
}

/**
 * Cola de hoy por probabilidad de compra: agendadas (vencidas o de hoy), links
 * sin pagar, tibios y contra entrega sin respuesta. Un chat sale una sola vez.
 */
export function callQueue(tasks: Task[], prospects: CallProspect[], now: number): CallQueueItem[] {
  const { overdue, today } = groupTasks(tasks.filter((t) => t.type === "call"), now);
  const scheduled = [...overdue, ...today].map((t) => fromTask(t, now));
  const rest = PROSPECT_ORDER.flatMap((reason) => prospects.filter((p) => p.reason === reason)).map(fromProspect);
  const seen = new Set<string>();
  return [...scheduled, ...rest].filter(({ conversationId }) => {
    if (!conversationId) return true;
    if (seen.has(conversationId)) return false;
    seen.add(conversationId);
    return true;
  });
}
