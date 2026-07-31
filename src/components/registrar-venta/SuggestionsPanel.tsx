"use client";

import { Button } from "@/components/ui/button";
import { Gift, Sparkles, PackageCheck, Lightbulb } from "lucide-react";
import { Pack } from "@/interfaces/IPack";
import { packNetUnit } from "@/hooks/usePacksEngine";

const fmt = (n: number) => `S/ ${n.toFixed(2)}`;

interface SuggestionsPanelProps {
  packs: Pack[];
  channel?: string;
  appliedPacks: Record<string, unknown>;
  modelQtyInCart: (productKey: string) => number;
  subtotalPayable: number;
  totalUnits: number;
  isAdmin: boolean;
  onApplyPack: (pack: Pack) => void;
  onAutoFillVolume: (pack: Pack) => void;
  onAutoAddBundleItem: (productKey: string) => void;
}

export default function SuggestionsPanel({
  packs,
  channel,
  appliedPacks,
  modelQtyInCart,
  subtotalPayable,
  totalUnits,
  isAdmin,
  onApplyPack,
  onAutoFillVolume,
  onAutoAddBundleItem,
}: SuggestionsPanelProps) {
  const active = packs.filter((p) => p.active && (!channel || p.channels.includes(channel)));

  const items: { icon: React.ReactNode; title: React.ReactNode; desc: React.ReactNode; action?: React.ReactNode }[] = [];

  active.forEach((p) => {
    if (appliedPacks[p.id]) return;

    if (p.type === "VOLUME") {
      const q = modelQtyInCart(p.product.productKey);
      if (q > 0 && q < p.minQty) {
        const falta = p.minQty - q;
        const save = p.product.price * p.minQty - p.packPrice;
        items.push({
          icon: <PackageCheck className="h-4 w-4" />,
          title: (
            <>
              Agrega {falta} más y arma el <b>{p.name}</b>
            </>
          ),
          desc: (
            <>
              Cierra con {fmt(p.packPrice)} total y el cliente ahorra {fmt(Math.max(0, save))}.
            </>
          ),
          action: (
            <Button size="sm" className="bg-violet-600 hover:bg-violet-700 text-white" onClick={() => onAutoFillVolume(p)}>
              Sumar {falta} u.
            </Button>
          ),
        });
      } else if (q >= p.minQty) {
        items.push({
          icon: <PackageCheck className="h-4 w-4" />,
          title: (
            <>
              Aplica el <b>{p.name}</b> para cerrar
            </>
          ),
          desc: (
            <>
              Ya califica. Baja a {fmt(p.packPrice)} total
              {isAdmin ? ` (${fmt(packNetUnit(p))} c/u neto)` : ""}.
            </>
          ),
          action: (
            <Button size="sm" className="bg-violet-600 hover:bg-violet-700 text-white" onClick={() => onApplyPack(p)}>
              Aplicar
            </Button>
          ),
        });
      }
    }

    if (p.type === "GIFT") {
      if (p.triggerBy === "amount") {
        const falta = (p.minAmount || 0) - subtotalPayable;
        if (subtotalPayable > 0 && falta > 0) {
          items.push({
            icon: <Gift className="h-4 w-4" />,
            title: (
              <>
                A {fmt(falta)} del regalo: <b>{p.name}</b>
              </>
            ),
            desc: (
              <>
                Sube el ticket a {fmt(p.minAmount || 0)} y el cliente elige 1 de {p.gifts.length} regalos.
              </>
            ),
          });
        }
      } else {
        const falta = (p.minQty || 0) - totalUnits;
        if (totalUnits > 0 && falta > 0) {
          items.push({
            icon: <Gift className="h-4 w-4" />,
            title: <>Agrega {falta} prenda(s) y gana un regalo</>,
            desc: (
              <>
                Con {p.minQty} prendas el cliente elige 1 de {p.gifts.length} regalos ({p.name}).
              </>
            ),
          });
        }
      }
    }

    if (p.type === "BUNDLE") {
      const present = p.items.filter((i) => modelQtyInCart(i.productKey) > 0);
      const missing = p.items.filter((i) => modelQtyInCart(i.productKey) === 0);
      const save = p.items.reduce((a, i) => a + i.price, 0) - p.packPrice;
      if (present.length > 0 && missing.length > 0) {
        items.push({
          icon: <Sparkles className="h-4 w-4" />,
          title: (
            <>
              Ofrece el <b>{p.name}</b>
            </>
          ),
          desc: (
            <>
              Falta agregar: {missing.map((i) => i.productName).join(", ")}. El combo cierra en{" "}
              {fmt(p.packPrice)} y ahorra {fmt(Math.max(0, save))}.
            </>
          ),
          action: (
            <div className="flex flex-wrap gap-1.5">
              {missing.map((i) => (
                <Button
                  key={i.productKey}
                  size="sm"
                  variant="outline"
                  onClick={() => onAutoAddBundleItem(i.productKey)}
                >
                  + {i.productName}
                </Button>
              ))}
            </div>
          ),
        });
      } else if (missing.length === 0) {
        items.push({
          icon: <Sparkles className="h-4 w-4" />,
          title: (
            <>
              Aplica el <b>{p.name}</b>
            </>
          ),
          desc: (
            <>
              Tienes ambos productos. Cierra en {fmt(p.packPrice)} y ahorra {fmt(Math.max(0, save))}.
            </>
          ),
          action: (
            <Button size="sm" className="bg-violet-600 hover:bg-violet-700 text-white" onClick={() => onApplyPack(p)}>
              Aplicar bundle
            </Button>
          ),
        });
      }
    }
  });

  if (!items.length) {
    return (
      <div className="flex items-start gap-3 rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 to-card p-4 dark:border-violet-800 dark:from-violet-500/10">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-violet-600 text-white">
          <Lightbulb className="h-4 w-4" />
        </span>
        <div>
          <h4 className="text-sm font-bold text-violet-700 dark:text-violet-300">Sugerencias para cerrar</h4>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
            Agrega productos y POWIP te sugerirá packs y combos para cerrar con mejor ticket.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-2 px-0.5 text-sm font-bold text-foreground">
        <Lightbulb className="h-4 w-4 text-violet-600 dark:text-violet-300" />
        Sugerencias para cerrar
      </div>
      {items.map((item, idx) => (
        <div
          key={idx}
          className="flex gap-2.5 rounded-xl border border-violet-200 bg-gradient-to-b from-violet-50/70 to-transparent p-3 dark:border-violet-800 dark:from-violet-500/10"
        >
          <div className="w-7 h-7 rounded-lg bg-violet-100 text-violet-600 dark:bg-violet-500/20 dark:text-violet-300 flex items-center justify-center shrink-0">
            {item.icon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold">{item.title}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{item.desc}</div>
            {item.action && <div className="mt-2">{item.action}</div>}
          </div>
        </div>
      ))}
    </div>
  );
}
