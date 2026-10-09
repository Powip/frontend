"use client";

import { Info } from "lucide-react";
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
import { BlockedActionButton } from "@/components/whatsapp/BlockedActionButton";
import { WhatsAppResourceState } from "@/components/whatsapp/WhatsAppResourceState";
import type { WhatsAppResourceState as ResourceState } from "@/features/whatsapp/models/resource-state.model";
import type { WhatsAppRulePreview } from "@/features/whatsapp/models/rule.model";
import { formatLimaDateTime } from "@/features/whatsapp/utils/lima-time.util";
import { cn } from "@/lib/utils";
import type { RuleActivationRequest } from "./RuleCard";

const ACTIVATION_BLOCKED_ID = "activate-rule-blocked";

type ActivationScope = "new" | "existing";

interface ActivateRuleDialogProps {
  request: RuleActivationRequest | null;
  preview: ResourceState<WhatsAppRulePreview>;
  canPersist: boolean;
  onClose: () => void;
  onActivate?: (request: RuleActivationRequest, includeExisting: boolean) => void;
}

function formatCost(preview: WhatsAppRulePreview): string | null {
  if (!preview.estimatedCost?.pen) return null;
  return `S/ ${preview.estimatedCost.pen}`;
}

export function ActivateRuleDialog({
  request,
  preview,
  canPersist,
  onClose,
  onActivate,
}: ActivateRuleDialogProps) {
  const [scope, setScope] = useState<ActivationScope>("new");
  const isCountOnly = request?.mode === "count";
  const readyCount = preview.kind === "ready" ? preview.data.matchingOrders : null;
  const existingAvailable = readyCount !== null && readyCount > 0;
  const blocked = !canPersist || !onActivate || !!request?.hasUnsavedChanges;

  const existingLabel =
    readyCount === null
      ? "También a los pedidos que ya están en este estado (cantidad desconocida)"
      : readyCount === 0
        ? "También a los pedidos actuales (no hay pedidos que cumplan esta regla)"
        : `También a los ${readyCount.toLocaleString("es-PE")} pedidos actuales`;

  return (
    <Dialog open={!!request} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
        {request && (
          <>
            <DialogHeader>
              <DialogTitle>
                {isCountOnly ? "Pedidos actuales" : "Activar"}: {request.rule.label}
              </DialogTitle>
              <DialogDescription>Criterios: {request.scopeSummary}</DialogDescription>
            </DialogHeader>

            {request.hasUnsavedChanges && (
              <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
                Tienes cambios sin guardar en este aviso. El conteo y la activación usan la
                configuración guardada; guarda los cambios antes de activar.
              </p>
            )}

            <WhatsAppResourceState
              state={preview}
              pendingTitle="Conteo y costo pendientes de integración"
              pendingDescription="El número de pedidos actuales y el costo estimado se mostrarán cuando el servicio de avisos esté disponible. No se usa cero como sustituto."
              loadingLabel="Calculando pedidos actuales"
              errorTitle="No se pudo calcular el conteo"
            >
              {(data) => (
                <div className="flex gap-2.5 rounded-lg border bg-muted/40 p-3 text-sm">
                  <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <div className="space-y-1">
                    {data.matchingOrders === 0 ? (
                      <p>Hoy no hay pedidos que cumplan esta regla.</p>
                    ) : (
                      <p>
                        Hoy hay{" "}
                        <strong>{data.matchingOrders.toLocaleString("es-PE")} pedidos</strong> que
                        ya están en {data.orderStateLabel ?? "este estado"} y cumplen esta regla.
                        {formatCost(data) && (
                          <>
                            {" "}
                            Enviarles ahora costaría <strong>{formatCost(data)}</strong> (lo cobra
                            Meta).
                          </>
                        )}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Calculado el {formatLimaDateTime(data.computedAt)} (hora de Lima). Al activar,
                      el sistema vuelve a calcular los pedidos; este número puede cambiar.
                    </p>
                  </div>
                </div>
              )}
            </WhatsAppResourceState>

            {!isCountOnly && (
              <fieldset className="space-y-2">
                <legend className="text-sm font-medium">A qué pedidos avisar</legend>
                {(
                  [
                    {
                      value: "new",
                      label: "Solo pedidos nuevos",
                      hint: "Empieza a avisar desde ahora. Recomendado.",
                      disabled: false,
                    },
                    {
                      value: "existing",
                      label: existingLabel,
                      hint: "Se envían respetando el horario permitido.",
                      disabled: !existingAvailable,
                    },
                  ] as const
                ).map((option) => (
                  <label
                    key={option.value}
                    className={cn(
                      "flex cursor-pointer gap-3 rounded-lg border p-3 text-sm has-[:checked]:border-emerald-500 has-[:checked]:bg-emerald-50 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring dark:has-[:checked]:bg-emerald-500/10",
                      option.disabled && "cursor-not-allowed opacity-60",
                    )}
                  >
                    <input
                      type="radio"
                      name="activation-scope"
                      value={option.value}
                      checked={scope === option.value}
                      disabled={option.disabled}
                      onChange={() => setScope(option.value)}
                      className="mt-1"
                    />
                    <span>
                      <span className="block font-medium">{option.label}</span>
                      <span className="block text-xs text-muted-foreground">{option.hint}</span>
                    </span>
                  </label>
                ))}
              </fieldset>
            )}

            <DialogFooter className="flex-col gap-3 sm:flex-col">
              {!isCountOnly && blocked && (
                <p id={ACTIVATION_BLOCKED_ID} className="text-sm text-muted-foreground">
                  {request.hasUnsavedChanges
                    ? "Guarda los cambios del aviso antes de activarlo."
                    : "La activación estará disponible cuando se conecte el servicio de avisos automáticos. El aviso sigue apagado y no se encoló ningún mensaje."}
                </p>
              )}
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button type="button" variant="outline" onClick={onClose}>
                  {isCountOnly ? "Cerrar" : "Cancelar"}
                </Button>
                {!isCountOnly && (
                  <BlockedActionButton
                    blocked={blocked}
                    blockedReasonId={ACTIVATION_BLOCKED_ID}
                    onClick={() => onActivate?.(request, scope === "existing")}
                  >
                    Activar
                  </BlockedActionButton>
                )}
              </div>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
