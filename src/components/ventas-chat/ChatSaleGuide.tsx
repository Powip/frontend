"use client";
import { useState } from "react";
import { Truck } from "lucide-react";
import { cn } from "@/lib/utils";
import { useChatCart } from "@/hooks/useChatCart";
import { useUpdateConversation } from "@/hooks/useCrmChat";
import { useScript } from "@/hooks/useCrmContent";
import type { Client } from "@/interfaces/ICliente";
import type { Conversation } from "@/types/crm";
import ConfirmDialog from "./ConfirmDialog";
import { firstName, stepText } from "./ContentLib";
import TemperatureBadge from "./TemperatureBadge";
import { PAGO_TEXT, currentStep, dispatchText, envioText } from "./saleGuide";

// Pantalla del chat según el mockup 152 (Ventas por chat): barra «Venta en 1
// minuto» y atajos de texto.
// Nada se envía solo: todo deja el texto en la caja para que la vendedora lo revise.

export { ENVIO_TEXT, PAGO_TEXT, dispatchText, windowHoursLeft } from "./saleGuide";

interface FillProps {
  conversation: Conversation;
  /** Texto actual de la caja de mensaje. */
  text: string;
  /** Pone el texto en la caja SIN enviarlo. */
  onFill: (text: string) => void;
  windowOpen: boolean;
}

/** Barra «Venta en 1 minuto»: pasos del guion numerados, hechos y actual. */
export function SaleStepsBar({ conversation, text, onFill, windowOpen }: FillProps) {
  const script = useScript();
  const update = useUpdateConversation(conversation.id);
  const { lowStock } = useChatCart(conversation.id);
  const [pending, setPending] = useState<number | null>(null);
  const steps = script.data?.steps ?? [];
  if (steps.length === 0) return null;
  const cur = currentStep(conversation, steps);
  const dispatch = dispatchText(script.data?.closingRules);
  const name = firstName(conversation);

  const apply = (i: number) => {
    onFill(stepText(steps[i], name));
    update.mutate({ scriptStep: i });
  };

  return (
    <div
      role="region"
      aria-label="Venta en 1 minuto"
      data-testid="sale-steps"
      className="flex flex-wrap items-center gap-2 border-b bg-background px-3 py-1.5"
    >
      <span className="text-xs font-semibold">Venta en 1 minuto</span>
      <ol className="flex flex-wrap items-center gap-1">
        {steps.map((s, i) => {
          const done = i < cur;
          const isCur = i === cur;
          return (
            <li key={i}>
              <button
                type="button"
                title={`${i + 1}. ${s.name}`}
                aria-label={`Paso ${i + 1}: ${s.name}`}
                aria-current={isCur ? "step" : undefined}
                disabled={!windowOpen || update.isPending}
                onClick={() => (text.trim() ? setPending(i) : apply(i))}
                className={cn(
                  "inline-flex h-[26px] items-center gap-1.5 rounded-full border p-0.5 text-[11.5px] font-semibold whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-60",
                  isCur && "border-primary bg-primary pr-2.5 text-primary-foreground",
                  done && "border-teal-600/30 bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300",
                  !isCur && !done && "bg-muted text-muted-foreground hover:bg-accent",
                )}
              >
                <i
                  className={cn(
                    "inline-grid h-4 w-4 place-items-center rounded-full text-[10px] not-italic",
                    isCur && "bg-primary-foreground text-primary",
                    done && "bg-teal-600 text-white",
                    !isCur && !done && "bg-border text-muted-foreground",
                  )}
                >
                  {i + 1}
                </i>
                {isCur && <span>{s.name}</span>}
              </button>
            </li>
          );
        })}
      </ol>
      {conversation.status === "open" && <TemperatureBadge conversation={conversation} />}
      {lowStock !== null && (
        <span
          data-testid="low-stock"
          className="ml-auto rounded-lg bg-amber-50 px-2 py-0.5 text-[11.5px] font-semibold text-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
        >
          Quedan {lowStock} · últimas unidades
        </span>
      )}
      {dispatch && (
        <span className={cn("inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2 py-0.5 text-[11.5px] font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300", lowStock === null && "ml-auto")}>
          <Truck className="h-3.5 w-3.5" aria-hidden /> {dispatch}
        </span>
      )}
      <ConfirmDialog
        open={pending !== null}
        title="¿Reemplazar lo que escribiste?"
        description="La caja ya tiene texto. El paso del guion lo reemplazará. No se envía nada: podrás revisarlo antes."
        confirmLabel="Reemplazar"
        onCancel={() => setPending(null)}
        onConfirm={() => {
          const i = pending;
          setPending(null);
          if (i !== null) apply(i);
        }}
      />
    </div>
  );
}

/** Atajos a la derecha de «Mensaje / Nota interna»: guion del paso, /envío y /pago. */
export function QuickChips({
  conversation,
  client,
  onInsert,
  disabled,
}: {
  conversation: Conversation;
  /** Para saber si «/envío» habla de delivery en Lima o de agencia. */
  client?: Client | null;
  onInsert: (text: string) => void;
  disabled: boolean;
}) {
  const script = useScript();
  const steps = script.data?.steps ?? [];
  const cur = steps.length ? currentStep(conversation, steps) : 0;
  const chip =
    "rounded-full border bg-background px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50";
  return (
    <span className="ml-auto flex flex-wrap items-center gap-1.5" data-testid="quick-chips">
      {steps.length > 0 && (
        <button
          type="button"
          className={chip}
          disabled={disabled}
          title={steps[cur].message}
          onClick={() => onInsert(stepText(steps[cur], firstName(conversation)))}
        >
          Guion · paso {cur + 1}
        </button>
      )}
      <button type="button" className={chip} disabled={disabled} onClick={() => onInsert(envioText(client))}>
        /envío
      </button>
      <button type="button" className={chip} disabled={disabled} onClick={() => onInsert(PAGO_TEXT)}>
        /pago
      </button>
    </span>
  );
}
