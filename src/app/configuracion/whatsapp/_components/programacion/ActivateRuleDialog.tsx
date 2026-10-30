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
import { WaCallout } from "@/components/whatsapp/ui/WaCallout";
import { WaDialogClose } from "@/components/whatsapp/ui/WaDialogClose";
import {
  waButton,
  waDialogBody,
  waDialogContent,
  waDialogFooter,
  waDialogHeader,
  waDialogTitle,
} from "@/components/whatsapp/ui/wa-classes";
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
      <DialogContent
        showCloseButton={false}
        className={cn(waDialogContent, "flex max-h-[calc(100dvh-2rem)] flex-col sm:max-w-[500px]")}
      >
        {request && (
          <>
            <DialogHeader className={waDialogHeader}>
              <DialogTitle className={waDialogTitle}>
                {isCountOnly ? "Pedidos actuales" : "Activar"}: {request.rule.label}
              </DialogTitle>
              <WaDialogClose />
            </DialogHeader>
            <div className={cn(waDialogBody, "flex min-h-0 flex-col gap-3.5 overflow-y-auto")}>
              <DialogDescription className="m-0 text-xs text-wa-muted">
                Criterios: {request.scopeSummary}
              </DialogDescription>

              {request.hasUnsavedChanges && (
                <WaCallout tone="amber">
                  Tienes cambios sin guardar en este aviso. El conteo y la activación usan la
                  configuración guardada; guarda los cambios antes de activar.
                </WaCallout>
              )}

              <WhatsAppResourceState
                state={preview}
                pendingTitle="Conteo y costo pendientes de integración"
                pendingDescription="El número de pedidos actuales y el costo estimado se mostrarán cuando el servicio de avisos esté disponible. No se usa cero como sustituto."
                loadingLabel="Calculando pedidos actuales"
                errorTitle="No se pudo calcular el conteo"
              >
                {(data) => (
                  <WaCallout icon={Info}>
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
                      <p className="m-0 text-xs text-wa-muted">
                        Calculado el {formatLimaDateTime(data.computedAt)} (hora de Lima). Al
                        activar, el sistema vuelve a calcular los pedidos; este número puede
                        cambiar.
                      </p>
                    </div>
                  </WaCallout>
                )}
              </WhatsAppResourceState>

              {!isCountOnly && (
                <fieldset className="m-0 flex flex-col gap-2.5 border-0 p-0">
                  <legend className="sr-only">A qué pedidos avisar</legend>
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
                        "flex cursor-pointer items-center gap-3 rounded-xl border border-wa-border px-3.5 py-3 has-[:checked]:border-wa-whatsapp has-[:checked]:bg-wa-whatsapp-soft has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-solid has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-wa-primary",
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
                        className="size-4 shrink-0 accent-wa-blue"
                      />
                      <span>
                        <span className="block font-semibold">{option.label}</span>
                        <span className="block text-xs text-wa-muted">{option.hint}</span>
                      </span>
                    </label>
                  ))}
                </fieldset>
              )}

              {!isCountOnly && blocked && (
                <p id={ACTIVATION_BLOCKED_ID} className="m-0 text-xs text-wa-muted">
                  {request.hasUnsavedChanges
                    ? "Guarda los cambios del aviso antes de activarlo."
                    : "La activación estará disponible cuando se conecte el servicio de avisos automáticos. El aviso sigue apagado y no se encoló ningún mensaje."}
                </p>
              )}
            </div>
            <DialogFooter className={waDialogFooter}>
              <Button type="button" className={waButton()} onClick={onClose}>
                {isCountOnly ? "Cerrar" : "Cancelar"}
              </Button>
              {!isCountOnly && (
                <BlockedActionButton
                  className={waButton({ variant: "primary" })}
                  blocked={blocked}
                  blockedReasonId={ACTIVATION_BLOCKED_ID}
                  onClick={() => onActivate?.(request, scope === "existing")}
                >
                  Activar
                </BlockedActionButton>
              )}
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
