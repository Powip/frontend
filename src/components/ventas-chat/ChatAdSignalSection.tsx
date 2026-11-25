"use client";
import { useConversationAdSignal } from "@/hooks/useCrmMetaAds";
import type { Conversation } from "@/types/crm";
import { CapiStatusBadge } from "./AjustesMetaAdsCards";

const money = (value: number, currency: string) =>
  new Intl.NumberFormat("es-PE", { style: "currency", currency: currency || "PEN" }).format(value);

/**
 * «Señal a Meta» en el panel del chat: de qué anuncio llegó el cliente y si sus compras se
 * informaron a Meta (Conversions API). Si el chat no vino de un anuncio, solo explica por qué
 * sus ventas no se envían.
 */
export default function ChatAdSignalSection({ conversation }: { conversation: Conversation }) {
  const { data } = useConversationAdSignal(conversation.id);
  if (!data) return null;
  const reason = data.capi?.reason ? (
    <p className="text-xs text-muted-foreground" data-testid="chat-ad-signal-reason">
      {data.capi.reason}
    </p>
  ) : null;
  if (!data.fromAd) {
    if (!reason) return null;
    return (
      <section className="space-y-1.5" aria-label="Señal a Meta" data-testid="chat-ad-signal">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Señal a Meta
        </h3>
        {reason}
      </section>
    );
  }
  return (
    <section className="space-y-1.5" aria-label="Señal a Meta" data-testid="chat-ad-signal">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Señal a Meta
      </h3>
      <p className="text-sm">
        Llegó por el anuncio{" "}
        <span className="font-medium">{data.ad?.headline || data.ad?.sourceId || "sin nombre"}</span>
      </p>
      {reason}
      {data.purchases.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Aún no compra. Cuando se verifique su pedido, la venta se informa a Meta.
        </p>
      ) : (
        <ul className="space-y-1">
          {data.purchases.map((p, i) => (
            <li
              key={`${p.orderNumber ?? "sin-numero"}-${i}`}
              className="flex items-center justify-between gap-2 text-xs"
              title={p.lastError ?? undefined}
            >
              <span>
                Pedido {p.orderNumber ?? "—"} · {money(p.value, p.currency)}
              </span>
              <CapiStatusBadge status={p.status} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
