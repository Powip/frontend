"use client";

import type { ReactNode } from "react";
import { RefreshCw } from "lucide-react";
import { useWarehouseQueue } from "@/components/almacen/WarehouseQueueContext";
import { Button } from "@/components/ui/button";
import type { QueuedAction } from "@/lib/offlineQueue";
import { describeQueuedAction, formatSavedAt, QUEUE_STATUS_LABEL } from "@/lib/warehouseMode";

// FEAT-24 H6-D (H6-D4) — la bandeja del celular: lo que falta enviar y lo que
// el servidor rechazó al sincronizar («Para revisar», con su mensaje: p. ej.
// el pedido ya lo despachó otra persona o falta stock). Desde acá se reintenta
// (con una clave nueva) o se descarta.

function ActionRow({ action, children }: { action: QueuedAction; children?: ReactNode }) {
  return (
    <li className="space-y-1 rounded-md border p-3" data-testid={`queued-${action.id}`}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium">{describeQueuedAction(action)}</p>
        <span className="shrink-0 text-xs text-muted-foreground">{formatSavedAt(action.createdAt)}</span>
      </div>
      <p className="text-xs text-muted-foreground">{QUEUE_STATUS_LABEL[action.status]}</p>
      {action.lastError ? (
        <p className={`text-sm ${action.status === "review" ? "text-destructive" : "text-muted-foreground"}`}>{action.lastError}</p>
      ) : null}
      {children}
    </li>
  );
}

export default function ReviewScreen() {
  const { outbox, review, online, syncing, flush, discard, retry, otherSessions } = useWarehouseQueue();

  return (
    <div className="space-y-5">
      <section className="space-y-2" aria-label="Para revisar">
        <h1 className="text-xl font-extrabold tracking-tight">Para revisar</h1>
        {review.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay nada para revisar.</p>
        ) : (
          <ul className="space-y-2">
            {review.map((action) => (
              <ActionRow key={action.id} action={action}>
                <div className="flex gap-2 pt-1">
                  <Button size="sm" variant="outline" onClick={() => void retry(action.id)}>
                    Reintentar
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => void discard(action.id)}>
                    Descartar
                  </Button>
                </div>
              </ActionRow>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2" aria-label="Por enviar">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Por enviar</h2>
          {outbox.length > 0 ? (
            <Button size="sm" variant="outline" disabled={!online || syncing} onClick={() => void flush()}>
              <RefreshCw className={`mr-1 h-4 w-4 ${syncing ? "animate-spin" : ""}`} aria-hidden="true" />
              {online ? "Enviar ahora" : "Sin señal"}
            </Button>
          ) : null}
        </div>
        {outbox.length === 0 ? (
          <p className="text-sm text-muted-foreground">Todo enviado.</p>
        ) : (
          <ul className="space-y-2">
            {outbox.map((action) => (
              <ActionRow key={action.id} action={action} />
            ))}
          </ul>
        )}
        {otherSessions > 0 ? (
          <p className="text-xs text-muted-foreground">
            Además hay {otherSessions} acción(es) de otro usuario o negocio en este celular; se envían cuando esa persona vuelva a entrar.
          </p>
        ) : null}
      </section>
    </div>
  );
}
