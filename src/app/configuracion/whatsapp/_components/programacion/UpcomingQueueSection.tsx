import { WaCard, WaCardHeader } from "@/components/whatsapp/ui/WaCard";
import { WaPill } from "@/components/whatsapp/ui/WaPill";
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
    <WaCard aria-labelledby="upcoming-queue-title">
      <WaCardHeader
        level={3}
        titleId="upcoming-queue-title"
        title="Próximas 24 horas"
        description="Avisos ya calculados por el servicio y esperando su hora de salida."
        actions={
          queue.kind === "ready" && (
            <WaPill className="wa-num">{queue.data.total.toLocaleString("es-PE")} en cola</WaPill>
          )
        }
      />
      <WhatsAppResourceState
        state={queue}
        pendingTitle="Cola pendiente de integración"
        pendingDescription="La cola la calcula y la ejecuta el servicio de avisos. Esta pantalla solo la mostrará; no programa ni envía nada desde el navegador."
        loadingLabel="Cargando la cola"
        errorTitle="No se pudo cargar la cola"
        onRetry={onRetry}
        isEmpty={(data) => data.groups.length === 0}
        empty={
          <p className="m-0 text-[13px] text-wa-muted">
            No hay avisos programados para las próximas 24 horas.
          </p>
        }
      >
        {(data) => (
          <ol className="m-0 flex list-none flex-col p-0" aria-label="Avisos en cola">
            {data.groups.map((group) => (
              <li
                key={group.id}
                className="grid grid-cols-[52px_14px_minmax(0,1fr)] items-center gap-x-2.5 gap-y-0.5 py-2 text-[13px] sm:grid-cols-[52px_14px_minmax(0,1fr)_auto]"
              >
                <time
                  dateTime={group.sendAt.toISOString()}
                  className="wa-num font-medium text-wa-muted"
                >
                  {formatLimaTime(group.sendAt)}
                  <span className="block text-[10.5px] font-normal">
                    {formatLimaDayLabel(group.sendAt, now)}
                  </span>
                </time>
                <span
                  aria-hidden="true"
                  className={cn(
                    "size-2.5 justify-self-center rounded-full",
                    group.deferred ? "bg-wa-amber" : "bg-wa-whatsapp",
                  )}
                />
                <span className="min-w-0">
                  <b className="font-semibold [overflow-wrap:anywhere]">{group.name}</b> ·{" "}
                  <span className="wa-num">
                    {group.orders.toLocaleString("es-PE")}{" "}
                    {group.orders === 1 ? "pedido" : "pedidos"}
                  </span>
                  <span className="block text-xs text-wa-muted">
                    {WHATSAPP_QUEUE_SOURCE_LABELS[group.source]} · {group.sourceLabel}
                  </span>
                </span>
                <span
                  className={cn(
                    "col-start-3 text-xs sm:col-start-auto sm:text-right",
                    group.deferred ? "text-wa-amber" : "text-wa-muted",
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
    </WaCard>
  );
}
