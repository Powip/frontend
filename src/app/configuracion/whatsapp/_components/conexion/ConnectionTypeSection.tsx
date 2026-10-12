"use client";

import { Check, type LucideIcon, Smartphone, UserRound, X, Zap } from "lucide-react";
import { useId, useState } from "react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { BlockedActionButton } from "@/components/whatsapp/BlockedActionButton";
import { WaCard, WaCardHeader } from "@/components/whatsapp/ui/WaCard";
import { WaPill, type WaTone } from "@/components/whatsapp/ui/WaPill";
import {
  waButton,
  waDialogBody,
  waDialogContent,
  waDialogFooter,
  waDialogHeader,
  waDialogTitle,
} from "@/components/whatsapp/ui/wa-classes";
import {
  CONNECTION_TYPE_DEFINITIONS,
  type ConnectionTypeDefinition,
} from "@/features/whatsapp/constants/whatsapp-connection-catalog";
import {
  WHATSAPP_CONNECTION_STATES,
  WHATSAPP_CONNECTION_TYPES,
  type WhatsAppConnectionType,
} from "@/features/whatsapp/enums/whatsapp.enums";
import type { WhatsAppConnectionStatus } from "@/features/whatsapp/models/connection.model";
import type { WhatsAppResourceState as ResourceState } from "@/features/whatsapp/models/resource-state.model";
import { cn } from "@/lib/utils";
import { type ActionState, type ConnectionMutations, errorMessage } from "./connection-types";

interface ConnectionTypeSectionProps {
  storeName: string;
  status: ResourceState<WhatsAppConnectionStatus>;
  accountId: string | null;
  blockedReason: string | null;
  changeType: ConnectionMutations["changeType"];
}

const TYPE_PRESENTATION: Record<WhatsAppConnectionType, { icon: LucideIcon; tone: WaTone }> = {
  [WHATSAPP_CONNECTION_TYPES.API]: { icon: Zap, tone: "ok" },
  [WHATSAPP_CONNECTION_TYPES.COEXISTENCE]: { icon: Smartphone, tone: "info" },
  [WHATSAPP_CONNECTION_TYPES.APP_MANUAL]: { icon: UserRound, tone: "warn" },
};

const TYPE_CARD =
  "relative flex min-w-0 flex-col gap-2 rounded-[14px] border-[1.5px] border-wa-border bg-wa-surface p-4 transition-[border-color,background-color]";

function TypeCardBody({ definition }: { definition: ConnectionTypeDefinition }) {
  const { icon: Icon, tone } = TYPE_PRESENTATION[definition.value];
  return (
    <>
      <span className="flex items-center justify-between">
        <span className="grid size-9 place-items-center rounded-[10px] border border-wa-border bg-wa-surface-2 text-wa-whatsapp-dark">
          <Icon className="size-[18px]" aria-hidden="true" />
        </span>
        <WaPill tone={tone}>{definition.badge}</WaPill>
      </span>
      <span className="text-[15px] font-semibold text-wa-fg">{definition.title}</span>
      <span className="text-[13px] text-wa-muted">{definition.summary}</span>
      <span className="mt-1 flex flex-col gap-1 text-[12.5px] text-wa-fg">
        <span className="sr-only">Ventajas:</span>
        {definition.advantages.map((item) => (
          <span key={item} className="flex items-start gap-1.5">
            <Check className="mt-[3px] size-3.5 shrink-0 text-wa-green" aria-hidden="true" />
            {item}
          </span>
        ))}
        <span className="sr-only">Limitaciones:</span>
        {definition.limitations.map((item) => (
          <span key={item} className="flex items-start gap-1.5">
            <X className="mt-[3px] size-3.5 shrink-0 text-wa-red" aria-hidden="true" />
            {item}
          </span>
        ))}
      </span>
    </>
  );
}

export function ConnectionTypeSection({
  storeName,
  status,
  accountId,
  blockedReason,
  changeType,
}: ConnectionTypeSectionProps) {
  const reasonId = useId();
  const [target, setTarget] = useState<ConnectionTypeDefinition | null>(null);
  const [action, setAction] = useState<ActionState>({ kind: "idle" });
  const ready = status.kind === "ready" ? status.data : null;
  const current = ready?.connectionType ?? null;
  const connected =
    ready !== null &&
    ready.state !== null &&
    ready.state !== WHATSAPP_CONNECTION_STATES.NOT_CONNECTED &&
    ready.state !== WHATSAPP_CONNECTION_STATES.DISCONNECTED;
  const selectable = connected && !!accountId;
  const reason = blockedReason ?? (!changeType ? "No se puede cambiar el tipo todavía." : null);

  const confirm = async () => {
    if (!target || !accountId || !changeType || blockedReason || action.kind === "pending") return;
    setAction({ kind: "pending" });
    try {
      await changeType({ accountId, connectionType: target.value });
      setTarget(null);
      setAction({ kind: "idle" });
    } catch (caught) {
      setAction({ kind: "error", message: errorMessage(caught, "No se pudo cambiar el tipo.") });
    }
  };

  return (
    <WaCard aria-labelledby="connection-type-title">
      <WaCardHeader
        titleId="connection-type-title"
        title="Tipo de conexión"
        description={
          ready === null
            ? `Así se conecta el número principal de ${storeName}. El tipo actual se mostrará cuando POWIP informe la conexión de la tienda.`
            : !connected
              ? `Conecta un número de ${storeName} para elegir el tipo.`
              : `Elige cómo se conecta el número principal de ${storeName}. Elegir otro pide confirmación y no cambia nada hasta que POWIP lo confirme.`
        }
      />
      {selectable ? (
        <fieldset className="grid grid-cols-1 gap-3.5 min-[1050px]:grid-cols-3">
          <legend className="sr-only">Tipo de conexión de {storeName}</legend>
          {CONNECTION_TYPE_DEFINITIONS.map((definition) => {
            const checked = current === definition.value;
            return (
              <label
                key={definition.value}
                className={cn(
                  TYPE_CARD,
                  "cursor-pointer has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-solid has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-wa-primary",
                  checked && "border-wa-whatsapp bg-wa-whatsapp-soft",
                )}
              >
                <input
                  type="radio"
                  name={`connection-type-${storeName}`}
                  value={definition.value}
                  checked={checked}
                  onChange={() => {
                    if (!checked) {
                      setAction({ kind: "idle" });
                      setTarget(definition);
                    }
                  }}
                  className="sr-only"
                />
                <TypeCardBody definition={definition} />
              </label>
            );
          })}
        </fieldset>
      ) : (
        <ul className="grid grid-cols-1 gap-3.5 min-[1050px]:grid-cols-3">
          {CONNECTION_TYPE_DEFINITIONS.map((definition) => (
            <li key={definition.value} className={TYPE_CARD}>
              <TypeCardBody definition={definition} />
            </li>
          ))}
        </ul>
      )}
      <AlertDialog open={target !== null} onOpenChange={(open) => !open && setTarget(null)}>
        <AlertDialogContent className={cn(waDialogContent, "sm:max-w-[440px]")}>
          <AlertDialogHeader className={waDialogHeader}>
            <AlertDialogTitle className={waDialogTitle}>
              ¿Cambiar a «{target?.title}»?
            </AlertDialogTitle>
          </AlertDialogHeader>
          <div className={cn(waDialogBody, "space-y-3")}>
            <AlertDialogDescription className="m-0 text-sm text-wa-muted">
              {target?.changeEffect}
            </AlertDialogDescription>
            {action.kind === "error" && (
              <p role="alert" className="text-[13px] text-wa-red">
                {action.message}
              </p>
            )}
            {reason && (
              <p id={reasonId} className="text-xs text-wa-muted">
                {reason}
              </p>
            )}
          </div>
          <AlertDialogFooter className={waDialogFooter}>
            <AlertDialogCancel className={waButton()}>Cancelar</AlertDialogCancel>
            <BlockedActionButton
              className={waButton({ variant: "primary" })}
              blocked={!!reason || action.kind === "pending"}
              blockedReasonId={reasonId}
              onClick={confirm}
            >
              Cambiar
            </BlockedActionButton>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </WaCard>
  );
}
