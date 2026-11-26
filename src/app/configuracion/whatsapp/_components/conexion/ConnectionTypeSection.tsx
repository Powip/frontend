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
}

const TYPE_PRESENTATION: Record<WhatsAppConnectionType, { icon: LucideIcon; tone: WaTone }> = {
  [WHATSAPP_CONNECTION_TYPES.API]: { icon: Zap, tone: "ok" },
  [WHATSAPP_CONNECTION_TYPES.COEXISTENCE]: { icon: Smartphone, tone: "info" },
  [WHATSAPP_CONNECTION_TYPES.APP_MANUAL]: { icon: UserRound, tone: "warn" },
};

/** Types POWIP cannot connect yet: shown, never selectable. */
const UNDER_CONSTRUCTION: WhatsAppConnectionType[] = [WHATSAPP_CONNECTION_TYPES.APP_MANUAL];

function TypeCard({
  definition,
  current,
}: {
  definition: ConnectionTypeDefinition;
  current: boolean;
}) {
  const titleId = useId();
  const { icon: Icon, tone } = TYPE_PRESENTATION[definition.value];
  const pending = UNDER_CONSTRUCTION.includes(definition.value);
  return (
    <li
      aria-labelledby={titleId}
      aria-current={current ? "true" : undefined}
      aria-disabled={pending ? "true" : undefined}
      className={cn(
        "relative flex min-w-0 flex-col gap-2 rounded-[14px] border-[1.5px] border-wa-border bg-wa-surface p-4",
        current && "border-wa-whatsapp bg-wa-whatsapp-soft",
        pending && "border-dashed bg-wa-surface-2",
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
          {pending ? (
            <WaPill tone="warn">En construcción</WaPill>
          ) : (
            <WaPill tone={tone}>{definition.badge}</WaPill>
          )}
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
    </li>
  );
}

export function ConnectionTypeSection({ storeName, status }: ConnectionTypeSectionProps) {
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
              : `Así está conectado hoy el número principal de ${storeName}. El tipo depende de cómo se conectó con Meta: para cambiarlo hay que volver a conectar el número.`
        }
      />
      <ul className="grid grid-cols-1 gap-3.5 min-[1050px]:grid-cols-3">
        {CONNECTION_TYPE_DEFINITIONS.map((definition) => (
          <TypeCard
            key={definition.value}
            definition={definition}
            current={current === definition.value}
          />
        ))}
      </ul>
    </WaCard>
  );
}
