import Link from "next/link";
import { Button } from "@/components/ui/button";
import { WaCard, WaCardHeader } from "@/components/whatsapp/ui/WaCard";
import { WaDot, WaPill } from "@/components/whatsapp/ui/WaPill";
import { WhatsAppGlyph } from "@/components/whatsapp/ui/WhatsAppGlyph";
import { waButton } from "@/components/whatsapp/ui/wa-classes";
import { WHATSAPP_NAME_STATUSES } from "@/features/whatsapp/enums/whatsapp.enums";
import type { WhatsAppAccount } from "@/features/whatsapp/models/connection.model";
import type { WhatsAppResourceState as ResourceState } from "@/features/whatsapp/models/resource-state.model";
import { resolveStoreConnection } from "@/features/whatsapp/utils/connection.util";
import { getInitials } from "@/features/whatsapp/utils/conversation-state.util";

const UNKNOWN_LABELS = {
  pending: "Estado de WhatsApp pendiente de integración",
  loading: "Cargando estado…",
  error: "Estado desconocido: no se pudo cargar",
  forbidden: "Sin permiso para ver el estado",
} as const;

const BADGE_COLORS = ["#7C3AED", "#0891B2", "#027778", "#DB2777", "#EA580C", "#4F46E5"];

function badgeColor(storeId: string) {
  let hash = 0;
  for (const char of storeId) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return BADGE_COLORS[hash % BADGE_COLORS.length];
}

interface StoreNumbersSectionProps {
  stores: { id: string; name: string }[];
  accounts: ResourceState<WhatsAppAccount[]>;
  selectedStoreId: string | null;
  onSelectStore: (storeId: string) => void;
  onConnect: (storeId: string) => void;
}

export function StoreNumbersSection({
  stores,
  accounts,
  selectedStoreId,
  onSelectStore,
  onConnect,
}: StoreNumbersSectionProps) {
  return (
    <WaCard aria-labelledby="store-numbers-title">
      <WaCardHeader
        titleId="store-numbers-title"
        title="Números por tienda"
        description="Cada tienda puede enviar desde su propio número. Si una tienda no tiene número, sus pedidos no generan avisos."
      />
      {stores.length === 0 ? (
        <p className="m-0 text-[13px] text-wa-muted">
          Tu empresa todavía no tiene tiendas.{" "}
          <Link href="/configuracion/tiendas" className="font-medium text-wa-primary underline">
            Crear una tienda
          </Link>
        </p>
      ) : (
        <ul className="m-0 list-none p-0" aria-label="Tiendas de tu empresa">
          {stores.map((store) => {
            const row = resolveStoreConnection(store.id, accounts);
            const selected = store.id === selectedStoreId;
            const inReview =
              row.kind === "connected" &&
              row.account.nameStatus === WHATSAPP_NAME_STATUSES.IN_REVIEW;
            const rejected =
              row.kind === "connected" &&
              row.account.nameStatus === WHATSAPP_NAME_STATUSES.REJECTED;
            return (
              <li
                key={store.id}
                className="flex flex-wrap items-center gap-3.5 border-t border-wa-border py-3.5 first:border-t-0 first:pt-0 last:pb-0"
              >
                <span
                  className="grid size-9 shrink-0 place-items-center rounded-[10px] text-[13px] font-bold text-white"
                  style={{ backgroundColor: badgeColor(store.id) }}
                  aria-hidden="true"
                >
                  {getInitials(store.name)}
                </span>
                <span className="min-w-[180px] flex-1">
                  <span className="block font-semibold">
                    {store.name}
                    {selected && (
                      <span className="ml-2 text-xs font-normal text-wa-muted">(mostrando)</span>
                    )}
                  </span>
                  {row.kind === "unknown" && (
                    <span className="block text-xs text-wa-muted">
                      {UNKNOWN_LABELS[row.reason]}
                    </span>
                  )}
                  {row.kind === "not-connected" && (
                    <span className="block text-xs text-wa-muted">Sin número conectado</span>
                  )}
                  {row.kind === "connected" && (
                    <span className="wa-num block text-xs text-wa-muted [overflow-wrap:anywhere]">
                      {[row.account.phone ?? "Número sin dato", row.account.verifiedName]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  )}
                </span>
                {row.kind === "connected" &&
                  (inReview ? (
                    <WaPill tone="warn">Nombre en revisión</WaPill>
                  ) : rejected ? (
                    <WaPill tone="err">Meta rechazó el nombre</WaPill>
                  ) : (
                    <WaPill tone="ok">
                      <WaDot className="size-1.5 shadow-none" />
                      Conectado
                    </WaPill>
                  ))}
                {row.kind === "not-connected" && <WaPill>Sin conectar</WaPill>}
                {row.kind === "connected" && (
                  <span className="wa-num min-w-[150px] text-xs text-wa-muted">
                    {inReview
                      ? "Puedes enviar mientras Meta revisa el nombre"
                      : row.account.messagesThisMonth === null
                        ? "Mensajes del mes sin dato"
                        : `${row.account.messagesThisMonth.toLocaleString("es-PE")} mensajes este mes`}
                  </span>
                )}
                {row.kind === "not-connected" && (
                  <span className="min-w-[150px] text-xs text-wa-muted">
                    Los avisos están apagados
                  </span>
                )}
                {row.kind === "connected" && !selected && (
                  <Button
                    type="button"
                    className={waButton({ size: "sm" })}
                    onClick={() => onSelectStore(store.id)}
                  >
                    Ver detalle
                    <span className="sr-only"> de {store.name}</span>
                  </Button>
                )}
                {row.kind === "not-connected" && (
                  <Button
                    type="button"
                    className={waButton({ variant: "whatsapp", size: "sm" })}
                    onClick={() => onConnect(store.id)}
                  >
                    <WhatsAppGlyph />
                    Conectar número
                    <span className="sr-only"> de {store.name}</span>
                  </Button>
                )}
                {row.kind === "unknown" && !selected && (
                  <Button
                    type="button"
                    className={waButton({ size: "sm" })}
                    onClick={() => onSelectStore(store.id)}
                  >
                    Ver tienda
                    <span className="sr-only"> {store.name}</span>
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </WaCard>
  );
}
