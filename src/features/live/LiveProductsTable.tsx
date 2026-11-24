"use client";

import { ChevronDown, ChevronRight, Settings2 } from "lucide-react";
import { Fragment, useState } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { type LiveProductGroup, groupLiveProducts } from "./liveGroups";
import { liveMoney } from "./liveService";
import { LiveProductImage } from "./LiveShared";
import type { LiveProduct } from "./types";

/** FEAT-33: Productos del live agrupados por producto, con las variantes desplegables. */
export default function LiveProductsTable({
  products,
  hideSoldOut,
  disabled,
  onEdit,
  onPublish,
}: {
  products: LiveProduct[];
  hideSoldOut: boolean;
  disabled: boolean;
  onEdit: (group: LiveProductGroup) => void;
  onPublish: (variantIds: string[], enabled: boolean) => void;
}) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const groups = groupLiveProducts(products);
  return (
    <div className="space-y-4">
      <p className="rounded-xl bg-violet-50 px-4 py-3 text-sm text-violet-900">
        Las variantes sin stock{" "}
        {hideSoldOut ? "se ocultan solas del catálogo del live" : "se muestran como «agotado»"}. El
        stock viene del almacén de la tienda en Inventario.
      </p>
      <div className="overflow-x-auto rounded-2xl border">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="w-10 px-3 py-3" aria-label="Variantes" />
              <th className="px-3 py-3 font-semibold">Producto</th>
              <th className="px-3 py-3 font-semibold">Tienda / Live</th>
              <th className="px-3 py-3 font-semibold">Disponible</th>
              <th className="px-3 py-3 font-semibold">Máx. por cliente</th>
              <th className="px-3 py-3 font-semibold">Publicado</th>
              <th className="px-3 py-3 font-semibold">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((group) => {
              const expanded = !!open[group.key];
              const published = group.variants.some((item) => item.enabled);
              const livePrices = group.variants.map((item) => item.livePrice);
              const maxes = [...new Set(group.variants.map((item) => item.maxPerCustomer ?? null))];
              const ids = group.variants.map((item) => item.variantId);
              return (
                <Fragment key={group.key}>
                  <tr className="border-t align-middle">
                    <td className="px-3 py-3">
                      <button
                        type="button"
                        aria-expanded={expanded}
                        aria-label={`Ver variantes de ${group.name}`}
                        onClick={() => setOpen((value) => ({ ...value, [group.key]: !expanded }))}
                        className="grid h-8 w-8 place-items-center rounded-lg hover:bg-muted"
                      >
                        {expanded ? (
                          <ChevronDown className="h-4 w-4" aria-hidden="true" />
                        ) : (
                          <ChevronRight className="h-4 w-4" aria-hidden="true" />
                        )}
                      </button>
                    </td>
                    <th scope="row" className="px-3 py-3 text-left font-normal">
                      <div className="flex items-center gap-3">
                        <LiveProductImage product={group.variants[0]} className="h-11 w-11" />
                        <div className="min-w-0">
                          <p className="font-semibold">{group.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {group.variants.length}{" "}
                            {group.variants.length === 1 ? "variante" : "variantes"}
                            {group.totalStock ? "" : " · sin stock"}
                          </p>
                        </div>
                      </div>
                    </th>
                    <td className="px-3 py-3 tabular-nums">
                      <span className="block text-xs text-muted-foreground line-through">
                        {liveMoney(group.regularPrice)}
                      </span>
                      <b className="text-rose-600">
                        {Math.min(...livePrices) === Math.max(...livePrices)
                          ? liveMoney(livePrices[0])
                          : `desde ${liveMoney(Math.min(...livePrices))}`}
                      </b>
                    </td>
                    <td
                      className={`px-3 py-3 font-semibold tabular-nums ${group.totalStock ? "" : "text-red-600"}`}
                    >
                      {group.totalStock}
                    </td>
                    <td className="px-3 py-3">
                      {maxes.length > 1
                        ? "Varía"
                        : maxes[0]
                          ? `${maxes[0]} unid.`
                          : "Sin límite"}
                    </td>
                    <td className="px-3 py-3">
                      <Switch
                        aria-label={`Publicar ${group.name}`}
                        checked={published}
                        disabled={disabled || (!published && group.totalStock <= 0)}
                        onCheckedChange={() => onPublish(ids, !published)}
                      />
                    </td>
                    <td className="px-3 py-3">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        aria-label={`Editar ${group.name}`}
                        disabled={disabled}
                        onClick={() => onEdit(group)}
                      >
                        <Settings2 className="h-4 w-4" aria-hidden="true" />
                        Editar
                      </Button>
                    </td>
                  </tr>
                  {expanded
                    ? group.variants.map((item) => {
                        const stock = Math.max(0, item.availableStock);
                        return (
                          <tr key={item.variantId} className="border-t bg-muted/20">
                            <td />
                            <td className="px-3 py-2">
                              <span className="block text-xs text-muted-foreground">{item.sku}</span>
                              {item.variantLabel || item.sku}
                            </td>
                            <td className="px-3 py-2 tabular-nums">{liveMoney(item.livePrice)}</td>
                            <td
                              className={`px-3 py-2 tabular-nums ${stock ? "" : "text-red-600"}`}
                            >
                              {stock}
                            </td>
                            <td />
                            <td className="px-3 py-2">
                              <Switch
                                aria-label={`Publicar ${item.name} ${item.variantLabel || item.sku}`}
                                checked={item.enabled}
                                disabled={disabled || (!item.enabled && stock <= 0)}
                                onCheckedChange={(enabled) => onPublish([item.variantId], enabled)}
                              />
                            </td>
                            <td className="px-3 py-2">
                              {!item.enabled ? (
                                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                                  Retirada
                                </span>
                              ) : stock ? (
                                <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                                  Visible
                                </span>
                              ) : (
                                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                                  {hideSoldOut ? "Oculta · sin stock" : "Agotado"}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    : null}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
