"use client";
import type { LiveProduct } from "./types";
import { LiveProductImage } from "./LiveShared";
import { liveMoney } from "./liveService";
export default function LiveProductsTable({
  products,
  disabled,
  onEdit,
  onPublish,
}: {
  products: LiveProduct[];
  disabled: boolean;
  onEdit: (p: LiveProduct) => void;
  onPublish: (p: LiveProduct, enabled: boolean) => void;
}) {
  const groups = new Map<string, LiveProduct[]>();
  for (const p of products) {
    const id = p.productId || p.variantId;
    groups.set(id, [...(groups.get(id) || []), p]);
  }
  return (
    <div className="space-y-3">
      {[...groups].map(([id, variants]) => (
        <details key={id} className="rounded-xl border">
          <summary className="flex min-h-20 cursor-pointer flex-wrap items-center gap-3 p-4">
            <LiveProductImage product={variants[0]} className="h-14 w-14" />
            <div className="flex-1">
              <p className="font-semibold">{variants[0].name}</p>
              <p className="text-xs text-muted-foreground">
                {variants.length} variantes · {variants.reduce((n, v) => n + v.availableStock, 0)}{" "}
                disponibles
              </p>
            </div>
            <p className="text-sm">
              Tienda {liveMoney(Math.min(...variants.map((v) => v.regularPrice)))}
              <br />
              <strong>Live {liveMoney(Math.min(...variants.map((v) => v.livePrice)))}</strong>
            </p>
          </summary>
          <div className="divide-y px-4">
            {variants.map((v) => (
              <div key={v.variantId} className="flex flex-wrap items-center gap-3 py-3">
                <div className="flex-1">
                  <p className="text-sm font-semibold">{v.variantLabel || v.sku}</p>
                  <p className="text-xs text-muted-foreground">
                    {v.sku} ·{" "}
                    {v.availableStock > 0
                      ? `${v.availableStock} disponibles`
                      : "Oculta · sin stock"}{" "}
                    · Máx. {v.maxPerCustomer || "sin límite"}
                  </p>
                </div>
                <p className="text-sm">{liveMoney(v.livePrice)}</p>
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    aria-label={`Publicar ${v.name} ${v.variantLabel || v.sku}`}
                    checked={v.enabled}
                    disabled={disabled || (!v.enabled && v.availableStock <= 0)}
                    onChange={(e) => onPublish(v, e.target.checked)}
                  />
                  Publicado
                </label>
                <button
                  className="min-h-11 rounded-xl border px-3 text-sm"
                  disabled={disabled}
                  onClick={() => onEdit(v)}
                >
                  Editar
                </button>
              </div>
            ))}
          </div>
        </details>
      ))}
    </div>
  );
}
