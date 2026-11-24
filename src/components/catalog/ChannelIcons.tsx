"use client";

import { cn } from "@/lib/utils";
import {
  CHANNEL_STATE_LABEL,
  POWIP_CHANNELS,
  RULE_CHANNELS,
  type ChannelState,
  type PowipChannelMeta,
  type ProductChannelStates,
} from "@/lib/catalog/productChannels";

/** Punto de estado (spec §7.1): verde = publicado, verde agua = al día, ámbar, rojo, gris = pausado, vacío = no activado. */
export type DotKind = "green" | "teal" | "amber" | "red" | "gray" | "none";

const DOT_CLASS: Record<DotKind, string> = {
  green: "bg-emerald-500 border-emerald-500",
  teal: "bg-[#027778] border-[#027778]",
  amber: "bg-amber-500 border-amber-500",
  red: "bg-red-600 border-red-600",
  gray: "bg-slate-400 border-slate-400",
  none: "bg-transparent border-slate-400",
};

export function ChannelChip({ label, color, size = "sm" }: { label: string; color: string; size?: "sm" | "lg" }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-grid shrink-0 place-items-center rounded-md font-bold tracking-tight text-white",
        size === "lg" ? "h-8 min-w-8 px-1 text-[10.5px]" : "h-[22px] min-w-[22px] px-0.5 text-[9px]",
      )}
      style={{ background: color }}
    >
      {label}
    </span>
  );
}

export function StateDot({ kind, className }: { kind: DotKind; className?: string }) {
  return <i aria-hidden className={cn("inline-block h-2.5 w-2.5 rounded-full border-2", DOT_CLASS[kind], className)} />;
}

const STATE_DOT: Record<ChannelState, DotKind> = { al_dia: "teal", no_activado: "none" };

function StripItem({ meta, label, color, dot, title }: { meta?: PowipChannelMeta; label: string; color: string; dot: DotKind; title: string }) {
  return (
    <span className="relative inline-flex" title={title} aria-label={title} role="img" data-channel={meta?.code}>
      <ChannelChip label={label} color={color} />
      <StateDot kind={dot} className="absolute -bottom-0.5 -right-0.5 h-2 w-2 border-white bg-clip-padding ring-1 ring-white dark:ring-slate-900" />
    </span>
  );
}

/**
 * Columna «Canales» de la lista de productos (§7.1): un ícono por canal de POWIP con su punto y, si el producto
 * vino de Shopify, el de Shopify («Lo administra Shopify»: Shopify sigue siendo dueño en la fase 1).
 */
export function ProductChannelStrip({ states, fromShopify }: { states: ProductChannelStates; fromShopify: boolean }) {
  return (
    <span className="inline-flex flex-nowrap items-center gap-1.5">
      {POWIP_CHANNELS.filter((meta) => (RULE_CHANNELS as readonly string[]).includes(meta.code)).map((meta) => {
        const state = states.states[meta.code as (typeof RULE_CHANNELS)[number]];
        return <StripItem key={meta.code} meta={meta} label={meta.short} color={meta.color} dot={STATE_DOT[state]} title={`${meta.name}: ${CHANNEL_STATE_LABEL[state]}`} />;
      })}
      {fromShopify ? <StripItem label="SH" color="#1f8a4c" dot="green" title="Shopify: Lo administra Shopify" /> : null}
    </span>
  );
}

/** Leyenda de los puntos, debajo de la tabla (§7.1). */
export function ChannelLegend() {
  const items: Array<[DotKind, string]> = [
    ["green", "Publicado / lo administra Shopify"],
    ["teal", "Al día (canal POWIP)"],
    ["amber", "Cambios sin publicar o faltan datos"],
    ["red", "Error del canal"],
    ["gray", "Sin publicar o pausado"],
    ["none", "No activado"],
  ];
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-label="Leyenda de canales">
      {items.map(([kind, text]) => (
        <span key={kind} className="inline-flex items-center gap-1.5"><StateDot kind={kind} />{text}</span>
      ))}
    </div>
  );
}
