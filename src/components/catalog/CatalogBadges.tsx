"use client";

import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { CHANNEL_LABEL, KIND_LABEL, productChannel, type ProductKind } from "@/lib/catalog/catalogProducts";
import { cn } from "@/lib/utils";

const CHANNEL_CLASS: Record<string, string> = {
  manual: "bg-muted text-muted-foreground border-transparent",
  shopify: "bg-emerald-100 text-emerald-800 border-transparent dark:bg-emerald-950/40 dark:text-emerald-300",
  yavendio: "bg-sky-100 text-sky-800 border-transparent dark:bg-sky-950/40 dark:text-sky-300",
  aliclik: "bg-amber-100 text-amber-800 border-transparent dark:bg-amber-950/40 dark:text-amber-300",
};

/** FEAT-24 H4 (H4-D5): «Shopify» deja de ser categoría y pasa a etiqueta de canal. */
export function ChannelBadge({ source }: { source: string | null | undefined }) {
  const channel = productChannel(source);
  return <Badge variant="outline" className={CHANNEL_CLASS[channel]}>{CHANNEL_LABEL[channel]}</Badge>;
}

export function KindBadge({ kind }: { kind: ProductKind }) {
  return <Badge variant="outline">{KIND_LABEL[kind]}</Badge>;
}

export function StatusBadge({ active }: { active: boolean }) {
  return <Badge variant="outline" className={active ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300" : "bg-muted text-muted-foreground"}>{active ? "Activo" : "Inactivo"}</Badge>;
}

/** Aviso de cuarentena (H4-D2): el SKU está repetido en la empresa y hay que renombrarlo. */
export function SkuConflictBadge() {
  return <Badge variant="outline" className="border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">SKU repetido</Badge>;
}

/** Miniatura de la foto (o las iniciales si no hay). */
export function ProductThumb({ src, name, size = 40, className }: { src?: string | null; name: string; size?: number; className?: string }) {
  const initials = name.trim().slice(0, 2).toUpperCase() || "—";
  return (
    <div className={cn("relative flex shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted text-xs font-medium text-muted-foreground", className)} style={{ width: size, height: size }}>
      {src ? <Image src={src} alt={name} width={size} height={size} unoptimized className="h-full w-full object-cover" /> : <span aria-hidden>{initials}</span>}
    </div>
  );
}
