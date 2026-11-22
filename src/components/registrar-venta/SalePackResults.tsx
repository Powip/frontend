"use client";

import { useEffect, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { PackageOpen } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { PackLineContents } from "@/components/packs/PackLineContents";
import { listPacks, type PackView } from "@/services/packsService";
import { packAvailableIn, packComponentsSnapshot } from "@/lib/packs/salePack";
import Thumb from "./Thumb";

const PACKS_LIMIT = 12;
const fmt = (n: number) => `S/ ${n.toFixed(2)}`;

/**
 * FEAT-24 H9 (H9-D2) — packs en el buscador de la venta manual. Un pack no tiene ítem de inventario, así
 * que no sale en la búsqueda por almacén: se busca aparte en ms-products (`GET /packs`, solo activos) y
 * se muestra con el disponible que el backend calcula para el almacén elegido. Si la búsqueda falla, el
 * bloque no aparece (la venta de productos sigue igual).
 */
export default function SalePackResults({
  query,
  inventoryId,
  disabled,
  qtyInCartByVariant,
  onAddPack,
}: {
  query: string;
  inventoryId: string | null | undefined;
  disabled?: boolean;
  qtyInCartByVariant: (variantId: string) => number;
  onAddPack: (pack: PackView) => void;
}) {
  const trimmed = query.trim();
  const [debounced, setDebounced] = useState(trimmed);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(trimmed), 400);
    return () => clearTimeout(timer);
  }, [trimmed]);

  const packs = useQuery({
    queryKey: ["sale-packs", debounced],
    queryFn: ({ signal }) => listPacks({ q: debounced || undefined, active: true, limit: PACKS_LIMIT }, signal),
    enabled: !!inventoryId,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    retry: false,
  });

  const rows = packs.data?.data ?? [];
  if (!inventoryId || packs.isError || rows.length === 0) return null;
  const more = (packs.data?.meta.total ?? rows.length) - rows.length;

  return (
    <section aria-label="Packs" className={cn("space-y-1.5", packs.isFetching && "opacity-60")}>
      <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
        <PackageOpen className="h-3.5 w-3.5" aria-hidden="true" />
        Packs
      </p>
      {rows.map((pack) => {
        const available = packAvailableIn(pack, inventoryId);
        const inCart = qtyInCartByVariant(pack.variantId);
        const oos = available !== null && available <= 0;
        return (
          <button
            key={pack.id}
            type="button"
            disabled={disabled}
            onClick={() => onAddPack(pack)}
            aria-label={`Agregar el pack ${pack.name}`}
            title={oos ? "Sin stock de algún componente · venta bajo pedido" : undefined}
            className={cn(
              "w-full flex items-start gap-3 rounded-lg border px-3 py-2 text-left transition-colors disabled:opacity-50",
              oos
                ? "bg-muted border-dashed border-amber-300 hover:border-amber-500"
                : inCart
                  ? "border-primary bg-primary/5 dark:bg-primary/10"
                  : "hover:border-primary/60 hover:bg-primary/5 dark:hover:bg-primary/10",
            )}
          >
            <Thumb imageUrl={pack.imageUrl} name={pack.name} size={32} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium truncate">{pack.name}</span>
                <Badge className="bg-primary/10 text-primary hover:bg-primary/10 dark:bg-primary/15">Pack</Badge>
              </div>
              {pack.sku || pack.productSku ? (
                <div className="text-[11px] text-muted-foreground">{pack.sku ?? pack.productSku}</div>
              ) : null}
              <PackLineContents components={packComponentsSnapshot(pack)} className="mt-0.5 text-[11px] text-muted-foreground" />
            </div>
            <Badge
              variant="outline"
              className={cn("text-[10px] shrink-0", oos && "border-amber-300 text-amber-700 dark:text-amber-300")}
              title="Disponible = el mínimo de sus componentes en este almacén"
            >
              {available === null ? "Stock sin dato" : oos ? "Bajo pedido" : `${available} u.`}
            </Badge>
            <span className="font-semibold text-sm text-primary min-w-[64px] text-right shrink-0">
              {fmt(Number(pack.price) || 0)}
            </span>
            {inCart > 0 && (
              <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-500/15 dark:text-emerald-300 shrink-0">
                ×{inCart}
              </Badge>
            )}
          </button>
        );
      })}
      {more > 0 && (
        <p className="text-[11px] text-muted-foreground">Hay {more} pack(s) más: busca por nombre o SKU.</p>
      )}
    </section>
  );
}
