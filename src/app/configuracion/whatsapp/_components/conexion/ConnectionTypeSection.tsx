"use client";

import { Check, type LucideIcon, Smartphone, UserRound, X, Zap } from "lucide-react";
import { useId } from "react";
import { WaCard, WaCardHeader } from "@/components/whatsapp/ui/WaCard";
import { WaPill, type WaTone } from "@/components/whatsapp/ui/WaPill";
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

interface ConnectionTypeSectionProps {
  storeName: string;
  status: ResourceState<WhatsAppConnectionStatus>;
  /** Tocar una tarjeta pide cambiar el modo; la marca solo sigue al modo guardado. */
  onSelect?: (type: WhatsAppConnectionType) => void;
  /** Por qué no se puede cambiar (permiso o integración pendiente). */
  blockedReason?: string | null;
  /** Respuesta al toque cuando no hay nada que cambiar. */
  notice?: string | null;
}

const TYPE_PRESENTATION: Record<WhatsAppConnectionType, { icon: LucideIcon; tone: WaTone }> = {
  [WHATSAPP_CONNECTION_TYPES.API]: { icon: Zap, tone: "ok" },
  [WHATSAPP_CONNECTION_TYPES.COEXISTENCE]: { icon: Smartphone, tone: "info" },
  [WHATSAPP_CONNECTION_TYPES.APP_MANUAL]: { icon: UserRound, tone: "warn" },
};

function TypeCard({
  definition,
  current,
  onSelect,
}: {
  definition: ConnectionTypeDefinition;
  current: boolean;
  onSelect?: () => void;
}) {
  const titleId = useId();
  const { icon: Icon, tone } = TYPE_PRESENTATION[definition.value];
  return (
    <li
      aria-labelledby={titleId}
      aria-current={current ? "true" : undefined}
      className="flex min-w-0"
    >
      <button
        type="button"
        aria-labelledby={titleId}
        aria-pressed={current}
        disabled={!onSelect}
        onClick={onSelect}
        className={cn(
          "flex w-full min-w-0 flex-col gap-2 rounded-[14px] border-[1.5px] border-wa-border bg-wa-surface p-4 text-left",
          "enabled:cursor-pointer enabled:hover:border-wa-whatsapp",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wa-whatsapp",
          current && "border-wa-whatsapp bg-wa-whatsapp-soft",
        )}
      >
        <span className="flex items-center justify-between gap-2">
          <span className="grid size-9 place-items-center rounded-[10px] border border-wa-border bg-wa-surface-2 text-wa-whatsapp-dark">
            <Icon className="size-[18px]" aria-hidden="true" />
          </span>
          <span className="flex flex-wrap items-center justify-end gap-1.5">
            {current && (
              <WaPill tone="ok">
                <Check className="size-3" aria-hidden="true" />
                En uso
              </WaPill>
            )}
            <WaPill tone={tone}>{definition.badge}</WaPill>
          </span>
        </span>
        <span id={titleId} className="text-[15px] font-semibold text-wa-fg">
          {definition.title}
        </span>
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
      </button>
    </li>
  );
}

export function ConnectionTypeSection({
  storeName,
  status,
  onSelect,
  blockedReason,
  notice,
}: ConnectionTypeSectionProps) {
  const ready = status.kind === "ready" ? status.data : null;
  const connected =
    ready !== null &&
    ready.state !== null &&
    ready.state !== WHATSAPP_CONNECTION_STATES.NOT_CONNECTED &&
    ready.state !== WHATSAPP_CONNECTION_STATES.DISCONNECTED;
  const current = connected ? ready.connectionType : null;

  return (
    <WaCard aria-labelledby="connection-type-title">
      <WaCardHeader
        titleId="connection-type-title"
        title="Tipo de conexión"
        description={
          ready === null
            ? `Así se conecta el número principal de ${storeName}. El tipo actual se mostrará cuando POWIP informe la conexión de la tienda.`
            : !connected
              ? `Conecta un número de ${storeName} para ver su tipo.`
              : `Así está conectado hoy el número principal de ${storeName}. Para cambiar el modo, toca otra tarjeta.`
        }
      />
      <ul className="grid grid-cols-1 gap-3.5 min-[1050px]:grid-cols-3">
        {CONNECTION_TYPE_DEFINITIONS.map((definition) => (
          <TypeCard
            key={definition.value}
            definition={definition}
            current={current === definition.value}
            onSelect={onSelect && !blockedReason ? () => onSelect(definition.value) : undefined}
          />
        ))}
      </ul>
      {blockedReason && <p className="m-0 mt-3 text-xs text-wa-muted">{blockedReason}</p>}
      <p role="status" className="m-0 mt-3 text-[13px] text-wa-fg empty:hidden">
        {notice}
      </p>
    </WaCard>
  );
}
