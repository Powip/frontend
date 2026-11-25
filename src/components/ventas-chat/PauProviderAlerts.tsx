"use client";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDismissPauProviderAlert, usePauProviderAlerts } from "@/hooks/useCrmPau";
import type { PauProviderAlert } from "@/types/crm";

interface Props {
  /** Solo los avisos de este chat. Sin dato, todos los de la empresa. */
  conversationId?: string;
  /** No repetir los de este chat (ya se ven en la barra de Pau del chat abierto). */
  excludeConversationId?: string | null;
  /** Cuántos mostrar como máximo. */
  limit?: number;
}

const hour = (iso: string) =>
  new Date(iso).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" });

/**
 * Aviso de respaldo de Pau: «El proveedor X falló: <motivo>. Se está continuando con Y».
 * Es solo para el equipo: nunca va en el mensaje al cliente. El mismo fallo repetido
 * se muestra una vez con «se repitió N veces»; «Entendido» lo cierra.
 */
export default function PauProviderAlerts({ conversationId, excludeConversationId, limit = 3 }: Props) {
  const alerts = usePauProviderAlerts(conversationId);
  const dismiss = useDismissPauProviderAlert();
  // Un ms-crm viejo (sin esta ruta) o una respuesta rara: no se muestra nada.
  const items = (Array.isArray(alerts.data) ? alerts.data : [])
    .filter((a) => !excludeConversationId || a.conversationId !== excludeConversationId)
    .slice(0, limit);
  if (!items.length) return null;

  return (
    <div className="space-y-2" data-testid="pau-provider-alerts">
      {items.map((a: PauProviderAlert) => (
        <div
          key={a.id}
          role="alert"
          className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-2 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="font-medium">
              {a.continuedWith ? "Pau cambió de proveedor de IA" : "Pau no pudo usar ningún proveedor de IA"}
            </p>
            <p>{a.message}</p>
            <p className="text-xs opacity-80">
              {a.count > 1
                ? `Se repitió ${a.count} veces · primera ${hour(a.firstAt)} · última ${hour(a.lastAt)}`
                : `A las ${hour(a.lastAt)}`}
              {a.kind === "auto" ? " · en una respuesta automática" : ""}
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="shrink-0 border-amber-300 bg-transparent text-amber-900 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-200"
            disabled={dismiss.isPending}
            onClick={() => dismiss.mutate(a.id)}
          >
            Entendido
          </Button>
        </div>
      ))}
    </div>
  );
}
