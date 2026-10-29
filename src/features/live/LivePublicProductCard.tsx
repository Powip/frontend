"use client";

import { Clock3, Loader2, Minus, Pin, Plus, ShoppingBag } from "lucide-react";
import { useId, useState } from "react";
import { LiveProductImage } from "./LiveShared";
import type { LiveProductGroup } from "./liveCatalog";
import { liveMoney } from "./liveService";
import type { LiveProduct } from "./types";

const action =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/20 px-3 py-2.5 text-xs font-semibold transition hover:border-[#25F4EE]/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#25F4EE] disabled:cursor-not-allowed disabled:opacity-40";

export default function LivePublicProductCard({
  group,
  featured,
  onAir,
  busy,
  quantities,
  canBuy,
  canReserve,
  canPay,
  availableFor,
  onQuantity,
  onAdd,
  onBuy,
  onReserve,
}: {
  group: LiveProductGroup;
  featured: boolean;
  onAir: boolean;
  busy: string;
  quantities: Record<string, number>;
  canBuy: boolean;
  canReserve: boolean;
  canPay: boolean;
  availableFor: (product: LiveProduct) => number;
  onQuantity: (variantId: string, quantity: number) => void;
  onAdd: (product: LiveProduct, quantity: number) => void;
  onBuy: (product: LiveProduct, quantity: number) => void;
  onReserve: (product: LiveProduct, quantity: number) => void;
}) {
  const id = useId();
  const [variantId, setVariantId] = useState(() =>
    group.variants.length === 1 ? group.variants[0].variantId : "",
  );
  const product = group.variants.find((variant) => variant.variantId === variantId);
  const preview = product ?? group.variants[0];
  const max = product ? availableFor(product) : 0;
  const quantity = product
    ? Math.max(1, Math.min(quantities[product.variantId] ?? 1, max || 1))
    : 1;
  const prices = group.variants.map((variant) => variant.livePrice);
  const minimum = Math.min(...prices);
  const maximum = Math.max(...prices);
  const unavailable = !product || max <= 0;
  const help = !product
    ? "Elige la variante que quieres antes de agregar o comprar."
    : product.availableStock <= 0
      ? "Esta variante está agotada. Elige otra opción."
      : max <= 0
        ? "Llegaste al máximo para esta variante."
        : `${product.availableStock} disponibles${product.maxPerCustomer ? ` · Máx. ${product.maxPerCustomer} por cliente` : ""}`;
  return (
    <article
      aria-labelledby={`${id}-name`}
      className={`min-w-0 rounded-2xl border p-4 ${featured ? "border-[#FE2C55]/50 bg-gradient-to-br from-[#FE2C55]/10 to-[#25F4EE]/5" : "border-white/10 bg-white/[0.035]"}`}
    >
      {featured ? (
        <p className="mb-4 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-[#FF8FA5]">
          <Pin className="h-3.5 w-3.5" />
          {onAir ? "Ahora en el live" : "Lo último que mostramos"}
        </p>
      ) : null}
      <div className="flex gap-4">
        <LiveProductImage product={preview} className="h-24 w-24 shrink-0" />
        <div className="min-w-0 flex-1">
          <h2 id={`${id}-name`} className="font-bold leading-snug">
            {group.name}
          </h2>
          {product ? <p className="mt-1 break-words text-xs text-zinc-400">{product.sku}</p> : null}
          <p className="mt-2 text-xl font-bold text-[#25F4EE]">
            {product
              ? liveMoney(product.livePrice)
              : minimum === maximum
                ? liveMoney(minimum)
                : `${liveMoney(minimum)} – ${liveMoney(maximum)}`}
          </p>
          {product && product.regularPrice > product.livePrice ? (
            <s className="text-xs text-zinc-400">{liveMoney(product.regularPrice)}</s>
          ) : null}
          <p className="mt-1 text-[10px] font-semibold text-[#FFB5C4]">Precio live</p>
        </div>
      </div>
      {group.variants.length > 1 || !product ? (
        <label htmlFor={`${id}-variant`} className="mt-4 block text-xs font-semibold">
          Elige una variante
          <select
            id={`${id}-variant`}
            className="mt-2 min-h-11 w-full min-w-0 rounded-xl border border-white/20 bg-[#16161C] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#25F4EE]"
            value={product?.variantId ?? ""}
            aria-describedby={`${id}-help`}
            disabled={!!busy}
            onChange={(event) => setVariantId(event.target.value)}
          >
            <option value="" disabled>
              Selecciona talla, color u opción
            </option>
            {group.variants.map((variant) => (
              <option key={variant.variantId} value={variant.variantId}>
                {variant.variantLabel || variant.sku} · {liveMoney(variant.livePrice)}
                {availableFor(variant) <= 0 ? " · Agotado o límite alcanzado" : ""}
              </option>
            ))}
          </select>
        </label>
      ) : product?.variantLabel ? (
        <p className="mt-3 text-xs text-zinc-300">{product.variantLabel}</p>
      ) : null}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p id={`${id}-help`} className="flex-1 text-xs leading-relaxed text-zinc-400">
          {help}
        </p>
        {product && max > 0 ? (
          <div className="inline-flex items-center gap-3 rounded-lg border border-white/15 bg-black/40">
            <button
              type="button"
              aria-label={`Quitar una unidad de ${group.name}`}
              disabled={quantity <= 1 || !!busy}
              className="p-3 disabled:opacity-30"
              onClick={() => onQuantity(product.variantId, quantity - 1)}
            >
              <Minus className="h-3 w-3" />
            </button>
            <span className="min-w-3 text-center text-sm font-bold tabular-nums">{quantity}</span>
            <button
              type="button"
              aria-label={`Agregar una unidad de ${group.name}`}
              disabled={quantity >= max || !!busy}
              className="p-3 disabled:opacity-30"
              onClick={() => onQuantity(product.variantId, quantity + 1)}
            >
              <Plus className="h-3 w-3" />
            </button>
          </div>
        ) : null}
      </div>
      <button
        type="button"
        className={`${action} mt-4 w-full border-[#25F4EE]/60 bg-[#25F4EE] text-[#0B0B0F] hover:bg-[#78FAF5]`}
        disabled={!!busy || unavailable || (!canBuy && !canReserve)}
        aria-describedby={`${id}-help`}
        onClick={() => product && onAdd(product, quantity)}
      >
        <Plus className="h-4 w-4" /> Agregar a mi compra
      </button>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {canBuy ? (
          <button
            type="button"
            className={action}
            disabled={!!busy || unavailable || !canPay}
            aria-describedby={`${id}-help`}
            onClick={() => product && onBuy(product, quantity)}
          >
            <ShoppingBag className="h-4 w-4" />
            Comprar ahora
          </button>
        ) : null}
        {canReserve ? (
          <button
            type="button"
            className={action}
            disabled={!!busy || unavailable}
            aria-describedby={`${id}-help`}
            onClick={() => product && onReserve(product, quantity)}
          >
            {busy === `reserve:${product?.variantId}` ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Clock3 className="h-4 w-4" />
            )}
            Apartar
          </button>
        ) : null}
      </div>
    </article>
  );
}
