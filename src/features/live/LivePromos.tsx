import { liveMoney } from "./liveService";
import type { LiveCartPromos, LivePromoOffer, LiveQuoteItem, LiveReservation } from "./types";

/**
 * FEAT-33 L7b (C7): volumen y regalo de POWIP Live, con los textos del mockup.
 * - Producto: «📦 Desde 3 unidades: S/ 50.00 c/u · llevas 2, te falta 1» (o «✓ ya tienes el precio pack»).
 * - Arriba del catálogo: «🎁 Por compras desde S/ 200 te llevas gratis …. Te faltan S/ X.» o «¡Ganaste tu regalo!».
 * El servidor calcula lo cobrado; acá solo se muestra.
 */
export function liveVolumeFor(promos: LivePromoOffer | null | undefined, variantIds: string[]) {
  return promos?.volumes.find((volume) => volume.variantIds.some((id) => variantIds.includes(id))) || null;
}

export function LiveVolumeHint({
  volume,
  reservations,
}: {
  volume: LivePromoOffer["volumes"][number];
  reservations: LiveReservation[];
}) {
  const units = reservations
    .filter((r) => !r.isGift && volume.variantIds.includes(r.variantId))
    .reduce((n, r) => n + r.quantity, 0);
  const loose = units % volume.minQty;
  const missing = volume.minQty - loose;
  const progress = !units
    ? ""
    : loose === 0
      ? " · ✓ ya tienes el precio pack"
      : ` · llevas ${units}, te falta${missing > 1 ? "n" : ""} ${missing}`;
  return (
    <p className="mb-0.5 mt-1 rounded-[10px] bg-[var(--acc-soft)] px-2.5 py-[7px] text-[13px] font-semibold text-[var(--acc-tx)]">
      {`📦 Desde ${volume.minQty} unidades: ${liveMoney(volume.packPrice / volume.minQty)} c/u${progress}`}
    </p>
  );
}

export function LiveGiftBanner({
  promos,
  cart,
}: {
  promos: LivePromoOffer | null | undefined;
  cart: LiveCartPromos | null | undefined;
}) {
  const reached = cart?.gift || null;
  const next = cart?.suggestions.find(
    (s): s is Extract<LiveCartPromos["suggestions"][number], { kind: "GIFT" }> => s.kind === "GIFT",
  );
  const offer = reached
    ? null
    : promos?.gifts.find((gift) => gift.id === next?.promoId) ||
      [...(promos?.gifts || [])]
        .filter((gift) => gift.minAmount !== null)
        .sort((a, b) => (a.minAmount || 0) - (b.minAmount || 0))[0];
  if (!reached && !offer) return null;
  return (
    <p
      role="note"
      aria-label="Regalo"
      className="mx-4 mt-3 rounded-[14px] bg-[var(--acc-soft)] px-3.5 py-3 text-[13.5px] text-[var(--b-ink)]"
    >
      🎁{" "}
      {reached ? (
        <>
          <b>¡Ganaste tu regalo!</b> {reached.giftName} va gratis en tu pedido.
        </>
      ) : offer!.minAmount !== null ? (
        <>
          Por compras desde <b>{liveMoney(offer!.minAmount)}</b> te llevas gratis {offer!.giftName}.
          {next ? ` Te faltan ${liveMoney(next.missingAmount)}.` : ""}
        </>
      ) : (
        <>Con tu compra te llevas gratis {offer!.giftName}.</>
      )}
    </p>
  );
}

/** Resumen del pago: prendas compradas (sin el regalo), descuento de promos y el regalo. */
export function livePromoSummary(items: LiveQuoteItem[] | null | undefined) {
  const list = items || [];
  const cents = list.reduce((n, item) => n + Math.round((item.promoDiscount || 0) * 100), 0);
  return {
    units: list.filter((item) => !item.isGift).reduce((n, item) => n + item.quantity, 0),
    discount: cents / 100,
    gift: list.find((item) => item.isGift)?.name || null,
  };
}
