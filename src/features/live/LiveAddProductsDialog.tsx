"use client";

import { ChevronDown, ChevronUp, Loader2, Plus, Settings2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  type LiveProductGroup,
  groupLiveProducts,
  variantMatrix,
} from "./liveGroups";
import {
  getLiveCatalog,
  isLiveWarehouseRequired,
  liveAdminError,
  liveError,
  liveMoney,
  updateLiveProducts,
} from "./liveService";
import {
  LiveEmpty,
  LiveErrorBanner,
  LiveFieldError,
  LiveProductImage,
} from "./LiveShared";
import type { LiveProduct } from "./types";

const PRICE = /^\d+(?:\.\d{1,2})?$/;
const plural = (count: number, one: string, many: string) =>
  `${count} ${count === 1 ? one : many}`;

function groupSummary(group: LiveProductGroup) {
  const matrix = variantMatrix(group.variants);
  const parts: string[] = [];
  if (matrix.rowLabel)
    parts.push(
      /color/i.test(matrix.rowLabel)
        ? plural(matrix.rows.length, "color", "colores")
        : plural(matrix.rows.length, "opción", "opciones"),
    );
  parts.push(
    matrix.colLabel && /talla|size/i.test(matrix.colLabel)
      ? plural(matrix.cols.length, "talla", "tallas")
      : plural(group.variants.length, "variante", "variantes"),
  );
  return `${parts.join(" · ")} · ${liveMoney(group.regularPrice)} · ${group.totalStock} disp.`;
}

/**
 * FEAT-33 B2/A10: «Agregar al live» como en Registrar venta. Una tarjeta por producto, matriz
 * Color × Talla con el stock del almacén de la tienda y un solo precio live y máximo por producto.
 */
export default function LiveAddProductsDialog({
  storeId,
  onClose,
  onAdded,
  onEdit,
}: {
  storeId: string;
  onClose: () => void;
  onAdded: () => void;
  /** Abre la edición de un producto que ya está entero en el live (clave de grupo). */
  onEdit: (groupKey: string) => void;
}) {
  const [products, setProducts] = useState<LiveProduct[] | null>(null);
  const [inventoryName, setInventoryName] = useState("");
  const [error, setError] = useState<{
    message: string;
    warehouse: boolean;
  } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [search, setSearch] = useState("");
  const [openKey, setOpenKey] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setProducts(null);
    setError(null);
    getLiveCatalog(storeId, "", controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        setProducts(result.products);
        setInventoryName(result.inventory?.name ?? "");
      })
      .catch((cause) => {
        if (controller.signal.aborted) return;
        setError({
          message: liveError(cause),
          warehouse: isLiveWarehouseRequired(cause),
        });
      });
    return () => controller.abort();
  }, [storeId, attempt]);

  const groups = useMemo(() => groupLiveProducts(products ?? []), [products]);
  const query = search.trim().toLocaleLowerCase();
  const matches = (group: LiveProductGroup) =>
    !query ||
    group.name.toLocaleLowerCase().includes(query) ||
    group.variants.some((item) => item.sku.toLocaleLowerCase().includes(query));
  const available = groups.filter((group) =>
    group.variants.some((item) => !item.enabled),
  );
  const inLive = groups.filter((group) =>
    group.variants.every((item) => item.enabled),
  );
  const shown = available.filter(matches);
  const shownInLive = inLive.filter(matches);

  return (
    <Dialog
      open
      onOpenChange={(value) => {
        if (!value) onClose();
      }}
    >
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Agregar al live</DialogTitle>
          <DialogDescription>
            Elige un producto de tu catálogo y luego sus colores y tallas, como
            en Registrar venta.
          </DialogDescription>
        </DialogHeader>
        {error ? (
          error.warehouse ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <p>{error.message}</p>
              <Button asChild size="sm" variant="outline" className="mt-3">
                <a href="/inventario">Ir a Inventario</a>
              </Button>
            </div>
          ) : (
            <LiveErrorBanner
              message={error.message}
              onRetry={() => setAttempt((n) => n + 1)}
            />
          )
        ) : !products ? (
          <p className="flex items-center justify-center gap-2 p-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Cargando catálogo…
          </p>
        ) : (
          <div className="space-y-4">
            {inventoryName ? (
              <p className="rounded-xl bg-teal-50 px-3 py-2 text-xs text-teal-900">
                El stock es del almacén <b>{inventoryName}</b> de esta tienda.
              </p>
            ) : null}
            <Input
              aria-label="Buscar producto"
              placeholder="Buscar por nombre o SKU"
              autoComplete="off"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <div className="grid gap-3">
              {shown.length ? (
                shown.map((group) => (
                  <AddProductCard
                    key={group.key}
                    group={group}
                    storeId={storeId}
                    inventoryName={inventoryName}
                    open={openKey === group.key}
                    onToggle={() =>
                      setOpenKey((key) =>
                        key === group.key ? null : group.key,
                      )
                    }
                    onAdded={onAdded}
                  />
                ))
              ) : (
                <LiveEmpty>
                  {query
                    ? "No hay más productos con ese nombre o SKU."
                    : "No hay más productos para agregar."}
                </LiveEmpty>
              )}
            </div>
            {shownInLive.length ? (
              <section aria-labelledby="live-add-in-live" className="space-y-2">
                <h3
                  id="live-add-in-live"
                  className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                >
                  Ya están en el live
                </h3>
                <div className="divide-y rounded-xl border px-3">
                  {shownInLive.map((group) => (
                    <div
                      key={group.key}
                      className="flex items-center gap-3 py-3"
                    >
                      <LiveProductImage
                        product={group.variants[0]}
                        className="h-11 w-11"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">
                          {group.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {plural(
                            group.variants.length,
                            "variante",
                            "variantes",
                          )}{" "}
                          · live {liveMoney(group.variants[0].livePrice)} ·{" "}
                          {group.totalStock} disp.
                        </p>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        aria-label={`Editar ${group.name}`}
                        onClick={() => onEdit(group.key)}
                      >
                        <Settings2 className="h-4 w-4" aria-hidden="true" />
                        Editar
                      </Button>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function AddProductCard({
  group,
  storeId,
  inventoryName,
  open,
  onToggle,
  onAdded,
}: {
  group: LiveProductGroup;
  storeId: string;
  inventoryName: string;
  open: boolean;
  onToggle: () => void;
  onAdded: () => void;
}) {
  const matrix = useMemo(() => variantMatrix(group.variants), [group.variants]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [price, setPrice] = useState(String(group.regularPrice || ""));
  const [max, setMax] = useState("");
  const [errors, setErrors] = useState<{
    price?: string;
    max?: string;
    server?: string;
  }>({});
  const [saving, setSaving] = useState(false);
  const selectable = group.variants.filter(
    (item) => !item.enabled && item.availableStock > 0,
  );
  const panelId = `live-add-${group.key}`;
  const priceId = `${panelId}-price`;
  const maxId = `${panelId}-max`;
  const toggle = (variantId: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(variantId)) next.delete(variantId);
      else next.add(variantId);
      return next;
    });
  async function add() {
    const found: typeof errors = {};
    if (!PRICE.test(price.trim()) || Number(price) <= 0)
      found.price = "Escribe un precio live mayor a 0.";
    if (
      max.trim() &&
      (!/^\d+$/.test(max.trim()) || Number(max) < 1 || Number(max) > 10000)
    )
      found.max = "Entre 1 y 10000, o vacío para sin límite.";
    setErrors(found);
    if (Object.keys(found).length || !selected.size) return;
    setSaving(true);
    try {
      const variantIds = group.variants
        .map((item) => item.variantId)
        .filter((variantId) => selected.has(variantId));
      await updateLiveProducts(storeId, {
        variantIds,
        livePrice: Number(price),
        maxPerCustomer: max.trim() ? Number(max) : null,
        enabled: true,
      });
      toast.success(
        `✓ ${group.name} en el live (${plural(variantIds.length, "variante", "variantes")})`,
      );
      setSelected(new Set());
      onAdded();
    } catch (cause) {
      setErrors({ server: liveAdminError(cause) });
    } finally {
      setSaving(false);
    }
  }
  return (
    <div
      className={`overflow-hidden rounded-2xl border ${open ? "border-teal-300 ring-1 ring-teal-200" : ""}`}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={onToggle}
        className="flex w-full items-center gap-3 bg-background px-4 py-3 text-left hover:bg-muted/40"
      >
        <LiveProductImage product={group.variants[0]} className="h-12 w-12" />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold">{group.name}</span>
          <span className="block text-xs text-muted-foreground">
            {groupSummary(group)}
          </span>
        </span>
        {open ? (
          <ChevronUp
            className="h-4 w-4 text-muted-foreground"
            aria-hidden="true"
          />
        ) : (
          <ChevronDown
            className="h-4 w-4 text-muted-foreground"
            aria-hidden="true"
          />
        )}
      </button>
      {open ? (
        <div
          id={panelId}
          className="space-y-3 border-t bg-muted/20 px-4 pb-4 pt-3"
        >
          {group.totalStock <= 0 ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              Este producto no tiene stock en el almacén
              {inventoryName ? ` ${inventoryName}` : " de la tienda"}. El live
              lee el stock de Inventario.
              <div className="mt-2">
                <Button asChild size="sm" variant="outline">
                  <a href="/inventario">Revisar en Inventario</a>
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">
                  Toca para elegir las variantes que van al live. El número es
                  el stock disponible.
                </p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setSelected(
                        new Set(selectable.map((item) => item.variantId)),
                      )
                    }
                  >
                    Todas con stock
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setSelected(new Set())}
                  >
                    Ninguna
                  </Button>
                </div>
              </div>
              <div className="overflow-x-auto rounded-xl border bg-background">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="px-3 py-2 text-left font-semibold">
                        {[matrix.rowLabel, matrix.colLabel]
                          .filter(Boolean)
                          .join(" \\ ") || "Variante"}
                      </th>
                      {matrix.cols.map((col) => (
                        <th
                          key={col}
                          className="px-3 py-2 text-center font-semibold"
                        >
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {matrix.rows.map((row) => (
                      <tr key={row} className="border-t">
                        <td className="px-3 py-2 font-semibold">
                          {row || "—"}
                        </td>
                        {matrix.cols.map((col) => {
                          const item = matrix.cell(row, col);
                          if (!item)
                            return (
                              <td
                                key={col}
                                className="px-3 py-2 text-center text-muted-foreground"
                              >
                                —
                              </td>
                            );
                          const name = [
                            row,
                            matrix.colLabel
                              ? `${matrix.colLabel.toLowerCase()} ${col}`
                              : col,
                          ]
                            .filter(Boolean)
                            .join(" ");
                          const on = selected.has(item.variantId);
                          const stock = Math.max(0, item.availableStock);
                          return (
                            <td key={col} className="px-2 py-2 text-center">
                              <button
                                type="button"
                                aria-pressed={on}
                                aria-label={
                                  item.enabled
                                    ? `${name}, ya está en el live`
                                    : `${name}, ${stock} disponibles`
                                }
                                disabled={item.enabled || stock <= 0}
                                onClick={() => toggle(item.variantId)}
                                className={`min-w-14 rounded-lg border-2 px-2 py-1.5 font-semibold tabular-nums disabled:cursor-not-allowed disabled:opacity-45 ${
                                  on
                                    ? "border-teal-600 bg-teal-50 text-teal-800"
                                    : "border-border bg-background"
                                } ${!item.enabled && stock <= 0 ? "line-through" : ""}`}
                              >
                                {item.enabled
                                  ? "En live"
                                  : `${on ? "✓ " : ""}${stock}`}
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid content-start gap-1.5 text-sm font-medium">
                  <label htmlFor={priceId}>Precio live</label>
                  <Input
                    id={priceId}
                    inputMode="decimal"
                    value={price}
                    aria-invalid={errors.price ? true : undefined}
                    aria-describedby={
                      errors.price ? `${priceId}-error` : `${priceId}-help`
                    }
                    onChange={(event) => setPrice(event.target.value)}
                  />
                  <LiveFieldError
                    id={`${priceId}-error`}
                    message={errors.price}
                  />
                  <span
                    id={`${priceId}-help`}
                    className="text-xs font-normal text-muted-foreground"
                  >
                    Tienda: {liveMoney(group.regularPrice)}
                  </span>
                </div>
                <div className="grid content-start gap-1.5 text-sm font-medium">
                  <label htmlFor={maxId}>Máx. por cliente</label>
                  <Input
                    id={maxId}
                    inputMode="numeric"
                    placeholder="Sin límite"
                    value={max}
                    aria-invalid={errors.max ? true : undefined}
                    aria-describedby={errors.max ? `${maxId}-error` : undefined}
                    onChange={(event) => setMax(event.target.value)}
                  />
                  <LiveFieldError id={`${maxId}-error`} message={errors.max} />
                </div>
              </div>
              {errors.server ? (
                <LiveErrorBanner message={errors.server} />
              ) : null}
              <div className="flex justify-end">
                <Button
                  type="button"
                  disabled={!selected.size || saving}
                  onClick={() => void add()}
                >
                  {saving ? (
                    <Loader2
                      className="h-4 w-4 animate-spin"
                      aria-hidden="true"
                    />
                  ) : (
                    <Plus className="h-4 w-4" aria-hidden="true" />
                  )}
                  Agregar al live (
                  {plural(selected.size, "variante", "variantes")})
                </Button>
              </div>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
