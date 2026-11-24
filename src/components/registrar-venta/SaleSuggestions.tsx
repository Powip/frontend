"use client";

import { useState, type ReactNode } from "react";
import { Gift, Lightbulb, PackageCheck, Sparkles } from "lucide-react";
import type { PackSuggestion, SaleSuggestion } from "@/services/promotionsService";

const ICONS = { PACK: PackageCheck, VOLUME: Sparkles, GIFT: Gift } as const;

/**
 * FEAT-32 M6a (spec §7.17) — «Sugerencias para cerrar» de la venta nueva: las del motor de promociones, en su
 * orden y con su texto (pack, volumen, regalo). El pack trae «Agregar pack» (sin SKU no se ofrece). Debajo
 * (`children`) siguen las de los bundles anteriores mientras haya alguno activo. Sin motor (edición, lead)
 * (`enabled = false`) solo se muestra `children`: el panel de siempre.
 */
export default function SaleSuggestions({
  enabled = true,
  suggestions,
  hasProducts,
  failed,
  onAddPack,
  children,
}: {
  enabled?: boolean;
  suggestions: SaleSuggestion[];
  hasProducts: boolean;
  failed?: boolean;
  onAddPack: (suggestion: PackSuggestion) => Promise<void> | void;
  children?: ReactNode;
}) {
  const [adding, setAdding] = useState<string | null>(null);
  const items = hasProducts ? suggestions.filter((item) => item.kind !== "PACK" || !!item.sku) : [];

  if (!enabled) return <>{children}</>;

  const addPack = async (suggestion: PackSuggestion) => {
    setAdding(suggestion.packVariantId);
    try {
      await onAddPack(suggestion);
    } finally {
      setAdding(null);
    }
  };

  return (
    <section
      aria-label="Sugerencias para cerrar"
      className="rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/5 to-card p-4 dark:border-primary/40 dark:from-primary/10"
    >
      <div className="flex items-center gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-primary text-white">
          <Lightbulb className="h-4 w-4" aria-hidden="true" />
        </span>
        <h4 className="text-sm font-bold text-primary">Sugerencias para cerrar</h4>
      </div>
      {failed ? (
        <p role="status" className="mt-2 text-xs text-muted-foreground">
          No se pudieron calcular las promociones.
        </p>
      ) : items.length ? (
        <ul className="mt-2.5 space-y-2">
          {items.map((item) => {
            const Icon = ICONS[item.kind];
            const key = item.kind === "PACK" ? `pack-${item.packVariantId}` : `${item.kind}-${item.promoId}`;
            return (
              <li key={key} className="flex items-start gap-2 text-sm">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary dark:bg-primary/20">
                  <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1 leading-relaxed">
                  {item.text}
                  {item.kind === "PACK" ? (
                    <>
                      {" "}
                      <button
                        type="button"
                        className="font-semibold text-primary underline-offset-2 hover:underline disabled:opacity-50"
                        disabled={adding !== null}
                        onClick={() => void addPack(item)}
                      >
                        Agregar pack
                      </button>
                    </>
                  ) : null}
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
          Agrega productos y POWIP te sugerirá packs, volumen y regalos para cerrar la venta.
        </p>
      )}
      {children}
    </section>
  );
}
