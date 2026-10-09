import { WhatsAppResourceState } from "@/components/whatsapp/WhatsAppResourceState";
import { WHATSAPP_QUEUE_SOURCE_LABELS } from "@/features/whatsapp/constants/whatsapp-scheduling-catalog";
import type { WhatsAppUpcomingQueue } from "@/features/whatsapp/models/queue.model";
import type { WhatsAppResourceState as ResourceState } from "@/features/whatsapp/models/resource-state.model";
import { formatLimaDayLabel, formatLimaTime } from "@/features/whatsapp/utils/lima-time.util";
import { cn } from "@/lib/utils";

interface UpcomingQueueSectionProps {
  queue: ResourceState<WhatsAppUpcomingQueue>;
  now?: Date;
  onRetry?: () => void;
}

export function UpcomingQueueSection({ queue, now, onRetry }: UpcomingQueueSectionProps) {
  return (
    <section
      aria-labelledby="upcoming-queue-title"
      className="space-y-4 rounded-xl border bg-card p-4 shadow-sm sm:p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 id="upcoming-queue-title" className="font-semibold">
            Próximas 24 horas
          </h3>
          <p className="text-sm text-muted-foreground">
            Avisos ya calculados por el servicio y esperando su hora de salida.
          </p>
        </div>
        {queue.kind === "ready" && (
          <span className="rounded-full border px-2.5 py-1 text-xs font-semibold tabular-nums">
            {queue.data.total.toLocaleString("es-PE")} en cola
          </span>
        )}
      </div>
      <WhatsAppResourceState
        state={queue}
        pendingTitle="Cola pendiente de integración"
        pendingDescription="La cola la calcula y la ejecuta el servicio de avisos. Esta pantalla solo la mostrará; no programa ni envía nada desde el navegador."
        loadingLabel="Cargando la cola"
        errorTitle="No se pudo cargar la cola"
        onRetry={onRetry}
        isEmpty={(data) => data.groups.length === 0}
        empty={
          <p className="text-sm text-muted-foreground">
            No hay avisos programados para las próximas 24 horas.
          </p>
        }
      >
        {(data) => (
          <ol className="divide-y" aria-label="Avisos en cola">
            {data.groups.map((group) => (
              <li
                key={group.id}
                className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 py-2.5 text-sm sm:grid-cols-[4.5rem_minmax(0,1fr)_auto]"
              >
                <time
                  dateTime={group.sendAt.toISOString()}
                  className="font-medium tabular-nums text-muted-foreground"
                >
                  {formatLimaTime(group.sendAt)}
                  <span className="block text-[11px] font-normal">
                    {formatLimaDayLabel(group.sendAt, now)}
                  </span>
                </time>
                <span className="min-w-0">
                  <span
                    aria-hidden="true"
                    className={cn(
                      "mr-2 inline-block h-2.5 w-2.5 rounded-full",
                      group.deferred ? "bg-amber-500" : "bg-emerald-500",
                    )}
                  />
                  <span className="break-all font-mono font-semibold">{group.name}</span> ·{" "}
                  {group.orders.toLocaleString("es-PE")} {group.orders === 1 ? "pedido" : "pedidos"}
                  <span className="block text-xs text-muted-foreground">
                    {WHATSAPP_QUEUE_SOURCE_LABELS[group.source]} · {group.sourceLabel}
                  </span>
                </span>
                <span
                  className={cn(
                    "col-span-2 text-xs sm:col-span-1 sm:text-right",
                    group.deferred ? "text-amber-700 dark:text-amber-300" : "text-muted-foreground",
                  )}
                >
                  {group.deferred && group.deferredTo
                    ? `Pasa a ${formatLimaDayLabel(group.deferredTo, now).toLowerCase()} ${formatLimaTime(group.deferredTo)}`
                    : (group.reason ?? "")}
                  {group.deferred && group.reason ? ` · ${group.reason}` : ""}
                </span>
              </li>
            ))}
          </ol>
        )}
      </WhatsAppResourceState>
    </section>
  );
}
