"use client";
import { useClientHistory, useOtherChannels } from "@/hooks/useClientProfile";
import { useConversationAdSignal } from "@/hooks/useCrmMetaAds";
import type { Client } from "@/interfaces/ICliente";
import { cn } from "@/lib/utils";
import type { Conversation } from "@/types/crm";
import { CHANNEL_LABEL, formatMoney, phoneForCustomer } from "./format";
import { channelsText, lastPurchaseText } from "./clientProfile";

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      {children}
    </h3>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <p className="flex items-center justify-between gap-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="min-w-0 break-words text-right font-medium">{value}</span>
    </p>
  );
}

/** Ciudad del cliente y por dónde llegó (anuncio o canal). */
export function ClientOriginRows({
  conversation,
  client,
}: {
  conversation: Conversation;
  client?: Client | null;
}) {
  const ad = useConversationAdSignal(conversation.id).data?.ad;
  return (
    <>
      <Row label="Ciudad" value={client?.city || client?.province || "Sin dato"} />
      <Row label="Llegó por" value={ad?.headline || CHANNEL_LABEL[conversation.channel]} />
    </>
  );
}

function Stat({ label, value, alert }: { label: string; value: string | number; alert?: boolean }) {
  return (
    <div className="min-w-0 rounded-md border p-2 text-center">
      <p className={cn("break-words text-sm font-semibold", alert && "text-destructive")}>{value}</p>
      <p className="text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}

/** Compras, rechazos y gasto del cliente con la empresa. Sin datos de Core no inventa ceros. */
export function ClientHistorySection({ clientId }: { clientId: string }) {
  const { data } = useClientHistory(clientId);
  if (!data) return null;
  return (
    <section className="space-y-2" aria-label="Historial con la marca">
      <SectionTitle>Historial con la marca</SectionTitle>
      <div className="grid grid-cols-3 gap-2">
        <Stat label="Compras" value={data.purchases} />
        <Stat label="Rechazos" value={data.rejections} alert={data.rejections > 0} />
        <Stat label="Gastado" value={formatMoney(data.spent)} />
      </div>
      <p className="text-xs text-muted-foreground">{lastPurchaseText(data.lastPurchaseAt)}</p>
    </section>
  );
}

/** Otros canales por los que escribió el mismo cliente. */
export function OtherChannelsSection({ conversation }: { conversation: Conversation }) {
  const hasPhone = !!phoneForCustomer(conversation);
  const { data } = useOtherChannels(conversation.id, hasPhone);
  if (hasPhone && !data) return null;
  return (
    <section className="space-y-1.5" aria-label="Otros canales">
      <SectionTitle>Otros canales</SectionTitle>
      <p className="text-xs text-muted-foreground">
        {channelsText(conversation.channel, hasPhone, data ?? [])}
      </p>
    </section>
  );
}
