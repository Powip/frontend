"use client";

import {
  ArrowLeft,
  Check,
  ChevronDown,
  Loader2,
  PackageSearch,
  Plus,
  Search,
  X,
} from "lucide-react";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { LiveErrorBanner, LiveProductImage } from "./LiveShared";
import { getLiveCatalog, liveError, liveMoney } from "./liveService";
import type { LiveProduct } from "./types";

type SaveInput = { livePrice: number; maxPerCustomer: number | null; enabled: boolean };
type CatalogSnapshot = {
  storeId: string;
  products: LiveProduct[];
  loading: boolean;
  error: string;
};
type PickerState = {
  storeId: string;
  search: string;
  openKey: string | null;
  selected: { variantId: string; price: string; max: string } | null;
  notice: string;
  error: string;
};
const emptyPicker = (storeId: string): PickerState => ({
  storeId,
  search: "",
  openKey: null,
  selected: null,
  notice: "",
  error: "",
});
const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase();

export default function LiveCatalogDialog({
  storeId,
  storeName,
  configuredVariantIds,
  busy = false,
  onClose,
  onSave,
}: {
  storeId: string;
  storeName?: string;
  configuredVariantIds?: readonly string[];
  busy?: boolean;
  onClose: () => void;
  onSave: (product: LiveProduct, input: SaveInput) => Promise<boolean>;
}) {
  const id = useId();
  const [snapshot, setSnapshot] = useState<CatalogSnapshot | null>(null);
  const [picker, setPicker] = useState(() => emptyPicker(storeId));
  const [saving, setSaving] = useState(false);
  const request = useRef<AbortController | null>(null);
  const saveLock = useRef<symbol | null>(null);
  const generation = useRef(0);
  const searchInput = useRef<HTMLInputElement>(null);
  const priceInput = useRef<HTMLInputElement>(null);
  const editorWasOpen = useRef(false);
  const load = useCallback(async () => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setSnapshot({ storeId, products: [], loading: true, error: "" });
    try {
      const result = await getLiveCatalog(storeId, "", controller.signal);
      if (!controller.signal.aborted)
        setSnapshot({ storeId, products: result.products, loading: false, error: "" });
    } catch (cause) {
      if (!controller.signal.aborted)
        setSnapshot({ storeId, products: [], loading: false, error: liveError(cause) });
    }
  }, [storeId]);
  useEffect(() => {
    generation.current += 1;
    saveLock.current = null;
    setSaving(false);
    setPicker(emptyPicker(storeId));
    void load();
    return () => {
      generation.current += 1;
      request.current?.abort();
    };
  }, [load, storeId]);

  const current = snapshot?.storeId === storeId ? snapshot : null;
  const state = picker.storeId === storeId ? picker : emptyPicker(storeId);
  const locked = busy || saving;
  const configured = useMemo(() => new Set(configuredVariantIds), [configuredVariantIds]);
  const groups = useMemo(() => {
    const grouped = new Map<string, LiveProduct[]>();
    for (const product of snapshot?.storeId === storeId ? snapshot.products : []) {
      const key = product.productId
        ? `product:${product.productId}`
        : `variant:${product.variantId}`;
      const group = grouped.get(key);
      if (group) group.push(product);
      else grouped.set(key, [product]);
    }
    const tokens = normalize(state.search).trim().split(/\s+/).filter(Boolean);
    return [...grouped.entries()].flatMap(([key, products]) => {
      const matches = products.filter((product) => {
        const text = normalize(`${product.name} ${product.sku} ${product.variantLabel ?? ""}`);
        return tokens.every((token) => text.includes(token));
      });
      return matches.length
        ? [
            {
              key,
              products,
              matches,
              name: products[0].name,
              stock: products.reduce(
                (total, product) => total + Math.max(0, product.availableStock),
                0,
              ),
              minPrice: Math.min(...products.map((product) => product.regularPrice)),
              maxPrice: Math.max(...products.map((product) => product.regularPrice)),
            },
          ]
        : [];
    });
  }, [snapshot, storeId, state.search]);
  const variantCount = groups.reduce((total, group) => total + group.matches.length, 0);
  const selected = current?.products.find(
    (product) => product.variantId === state.selected?.variantId,
  );
  const selectionKey = selected ? `${storeId}:${selected.variantId}` : null;
  useEffect(() => {
    if (selectionKey) priceInput.current?.focus();
    else if (editorWasOpen.current) searchInput.current?.focus();
    editorWasOpen.current = selectionKey !== null;
  }, [selectionKey]);
  const draft = selected ? state.selected : null;
  const priceValid =
    !!draft &&
    /^\d{1,10}(\.\d{1,2})?$/.test(draft.price) &&
    Number(draft.price) > 0 &&
    Number(draft.price) <= 9999999999.99;
  const maxValid =
    !!draft &&
    (draft.max === "" ||
      (/^\d{1,5}$/.test(draft.max) && Number(draft.max) >= 1 && Number(draft.max) <= 10000));
  const editing = !!selected && (configured.has(selected.variantId) || selected.enabled);
  const blocked = () => busy || saveLock.current !== null;

  function choose(product: LiveProduct) {
    if (blocked()) return;
    setPicker((previous) => ({
      ...previous,
      selected: {
        variantId: product.variantId,
        price: String(product.livePrice > 0 ? product.livePrice : product.regularPrice || ""),
        max: product.maxPerCustomer?.toString() ?? "",
      },
      notice: "",
      error: "",
    }));
  }
  async function save() {
    if (blocked() || !selected || !draft || !priceValid || !maxValid) return;
    const lock = Symbol();
    const scope = generation.current;
    saveLock.current = lock;
    setSaving(true);
    setPicker((previous) => ({ ...previous, error: "", notice: "" }));
    const input: SaveInput = {
      livePrice: Number(draft.price),
      maxPerCustomer: draft.max === "" ? null : Number(draft.max),
      enabled: true,
    };
    try {
      const saved = await onSave(selected, input);
      if (generation.current !== scope) return;
      if (saved) {
        setSnapshot((previous) =>
          previous?.storeId === storeId
            ? {
                ...previous,
                products: previous.products.map((product) =>
                  product.variantId === selected.variantId ? { ...product, ...input } : product,
                ),
              }
            : previous,
        );
        setPicker((previous) => ({
          ...previous,
          selected: null,
          error: "",
          notice: `${selected.name}${selected.variantLabel ? ` · ${selected.variantLabel}` : ""}: ${editing ? "cambios guardados" : "agregado al Live"}. Puedes agregar otra variante.`,
        }));
      } else
        setPicker((previous) => ({
          ...previous,
          error: "No se pudo guardar. Conservamos tus cambios para que vuelvas a intentarlo.",
        }));
    } catch (cause) {
      if (generation.current === scope)
        setPicker((previous) => ({ ...previous, error: liveError(cause) }));
    } finally {
      if (saveLock.current === lock) {
        saveLock.current = null;
        if (generation.current === scope) setSaving(false);
      }
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !blocked()) onClose();
      }}
    >
      <DialogContent
        className="flex max-h-[92dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl"
        showCloseButton={false}
        onEscapeKeyDown={(event) => {
          if (blocked()) event.preventDefault();
        }}
        onInteractOutside={(event) => {
          if (blocked()) event.preventDefault();
        }}
      >
        <DialogHeader className="border-b px-5 py-5 pr-14 sm:px-6 sm:pr-14">
          <DialogTitle className="text-xl font-bold">Agregar productos al Live</DialogTitle>
          <DialogDescription>
            {storeName ? <span className="font-medium text-foreground">{storeName} · </span> : null}
            Elige una variante y configura su precio para el catálogo.
          </DialogDescription>
        </DialogHeader>
        <button
          type="button"
          aria-label="Cerrar selector de productos"
          disabled={locked}
          className="absolute right-4 top-5 rounded-md p-1 text-muted-foreground hover:bg-muted disabled:opacity-40"
          onClick={() => {
            if (!blocked()) onClose();
          }}
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
        <div className="grid min-h-0 flex-1 md:grid-cols-[minmax(0,1fr)_20rem]">
          <section
            aria-label="Productos disponibles"
            className={cn(
              "flex min-h-0 min-w-0 flex-col gap-4 p-5 sm:p-6",
              selected && "hidden md:flex",
            )}
          >
            <div className="space-y-2">
              <div className="relative">
                <Search
                  className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
                <Input
                  ref={searchInput}
                  aria-label="Buscar producto para live"
                  disabled={locked}
                  className="h-11 rounded-xl pl-10 pr-10 text-sm focus-visible:ring-4 focus-visible:ring-violet-500/10"
                  placeholder="Buscar por modelo, color, talla o SKU"
                  value={state.search}
                  onChange={(event) =>
                    setPicker((previous) => ({ ...previous, search: event.target.value }))
                  }
                />
                {state.search ? (
                  <button
                    type="button"
                    aria-label="Limpiar búsqueda"
                    disabled={locked}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full bg-muted p-1 text-muted-foreground hover:bg-muted-foreground/20 disabled:opacity-40"
                    onClick={() => setPicker((previous) => ({ ...previous, search: "" }))}
                  >
                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                ) : null}
              </div>
              <p className="text-xs text-muted-foreground" aria-live="polite">
                {current?.loading || !current
                  ? "Cargando catálogo…"
                  : `${groups.length} modelo${groups.length === 1 ? "" : "s"} · ${variantCount} variante${variantCount === 1 ? "" : "s"}`}
              </p>
            </div>
            {state.notice ? (
              <p
                role="status"
                className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200"
              >
                {state.notice}
              </p>
            ) : null}
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
              {current?.error ? (
                <LiveErrorBanner
                  message={current.error}
                  onRetry={locked ? undefined : () => void load()}
                />
              ) : !current || current.loading ? (
                <div
                  role="status"
                  className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground"
                >
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  Cargando productos…
                </div>
              ) : groups.length ? (
                groups.map((group) => {
                  const expanded = state.openKey === group.key;
                  const regionId = `${id}-${encodeURIComponent(group.key)}`;
                  const inLive = group.products.filter(
                    (product) => configured.has(product.variantId) || product.enabled,
                  ).length;
                  const single = group.products.length === 1;
                  return (
                    <article
                      key={group.key}
                      className={cn(
                        "overflow-hidden rounded-2xl border bg-card transition-colors",
                        expanded && "border-violet-500 shadow-sm shadow-violet-600/10",
                      )}
                    >
                      <button
                        type="button"
                        disabled={locked}
                        aria-expanded={single ? undefined : expanded}
                        aria-controls={single ? undefined : regionId}
                        aria-label={
                          single
                            ? `Configurar ${group.name}, ${group.products[0].variantLabel || group.products[0].sku}, SKU ${group.products[0].sku}`
                            : `Ver variantes de ${group.name} (${group.products[0].sku})`
                        }
                        className="flex w-full items-center gap-3 p-3 text-left hover:bg-muted/40 disabled:opacity-60"
                        onClick={() => {
                          if (blocked()) return;
                          if (single) choose(group.products[0]);
                          else
                            setPicker((previous) => ({
                              ...previous,
                              openKey: expanded ? null : group.key,
                            }));
                        }}
                      >
                        <LiveProductImage
                          product={
                            group.products.find((product) => product.imageUrl) || group.products[0]
                          }
                          className="h-11 w-11"
                        />
                        <div className="min-w-0 flex-1 space-y-1">
                          <p className="break-words text-sm font-semibold">{group.name}</p>
                          <p className="break-all text-[10px] text-muted-foreground">
                            {single
                              ? `${group.products[0].variantLabel || "Variante única"} · ${group.products[0].sku}`
                              : group.matches.length < group.products.length
                                ? `${group.matches.length} de ${group.products.length} variantes`
                                : `${group.products.length} variantes`}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            {group.stock > 0 ? `${group.stock} u. disponibles` : "Sin stock"}
                          </p>
                          {inLive ? (
                            <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
                              {inLive} en Live
                            </span>
                          ) : null}
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-xs font-bold text-violet-700 dark:text-violet-300">
                            {liveMoney(group.minPrice)}
                            {group.maxPrice !== group.minPrice ? (
                              <>
                                <span className="block text-[10px] font-normal text-muted-foreground">
                                  hasta
                                </span>
                                {liveMoney(group.maxPrice)}
                              </>
                            ) : null}
                          </p>
                          <span className="text-[10px] text-muted-foreground">PVP</span>
                        </div>
                        {single ? (
                          <Plus
                            className="h-4 w-4 shrink-0 text-muted-foreground"
                            aria-hidden="true"
                          />
                        ) : (
                          <ChevronDown
                            className={cn(
                              "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                              expanded && "rotate-180 text-violet-600",
                            )}
                            aria-hidden="true"
                          />
                        )}
                      </button>
                      {!single && expanded ? (
                        <div
                          id={regionId}
                          className="grid gap-2 border-t border-dashed bg-muted/20 p-3 lg:grid-cols-2"
                        >
                          {group.matches.map((product) => (
                            <button
                              type="button"
                              key={product.variantId}
                              disabled={locked}
                              aria-label={`Configurar ${product.name}, ${product.variantLabel || product.sku}, SKU ${product.sku}`}
                              aria-pressed={selected?.variantId === product.variantId}
                              onClick={() => choose(product)}
                              className={cn(
                                "flex w-full items-center gap-2 rounded-xl border bg-background p-2.5 text-left hover:border-violet-400 disabled:opacity-60",
                                selected?.variantId === product.variantId &&
                                  "border-violet-500 bg-violet-50 dark:bg-violet-500/10",
                              )}
                            >
                              <div className="min-w-0 flex-1">
                                <p className="break-words text-xs font-medium">
                                  {product.variantLabel || "Variante única"}
                                </p>
                                <p className="mt-0.5 break-all text-[10px] text-muted-foreground">
                                  {product.sku}
                                </p>
                                <div className="mt-1.5 flex flex-wrap gap-1.5 text-[10px] font-medium">
                                  <span
                                    className={cn(
                                      "rounded-full border px-2 py-0.5",
                                      product.availableStock <= 0
                                        ? "border-amber-300 bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-200"
                                        : "text-muted-foreground",
                                    )}
                                  >
                                    {product.availableStock > 0
                                      ? `${product.availableStock} u. disponibles`
                                      : "Sin stock"}
                                  </span>
                                  {configured.has(product.variantId) || product.enabled ? (
                                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
                                      En Live
                                    </span>
                                  ) : null}
                                </div>
                              </div>
                              <span className="shrink-0 text-xs font-semibold text-violet-700 dark:text-violet-300">
                                {liveMoney(product.regularPrice)}
                              </span>
                              {selected?.variantId === product.variantId ? (
                                <Check
                                  className="h-4 w-4 shrink-0 text-violet-600"
                                  aria-hidden="true"
                                />
                              ) : (
                                <Plus
                                  className="h-4 w-4 shrink-0 text-muted-foreground"
                                  aria-hidden="true"
                                />
                              )}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </article>
                  );
                })
              ) : (
                <div className="rounded-2xl border border-dashed bg-muted/20 px-5 py-10 text-center">
                  <PackageSearch
                    className="mx-auto mb-3 h-8 w-8 text-violet-500"
                    aria-hidden="true"
                  />
                  <p className="text-sm font-semibold">
                    {state.search.trim()
                      ? "No se encontraron variantes."
                      : "No hay productos disponibles para Live."}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {state.search.trim()
                      ? "Prueba con otro modelo, color, talla o SKU."
                      : "Revisa los productos de cantidad y el almacén activo de esta tienda."}
                  </p>
                </div>
              )}
            </div>
          </section>
          <section
            aria-label="Configuración de la variante"
            className={cn(
              "min-h-0 overflow-y-auto border-t bg-muted/20 p-5 sm:p-6 md:border-l md:border-t-0",
              !selected && "hidden md:block",
            )}
          >
            {selected && draft ? (
              <>
                <button
                  type="button"
                  disabled={locked}
                  className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-violet-700 disabled:opacity-40 dark:text-violet-300"
                  onClick={() =>
                    setPicker((previous) => ({ ...previous, selected: null, error: "" }))
                  }
                >
                  <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                  Volver a productos
                </button>
                <div className="mb-5 flex items-start gap-3">
                  <LiveProductImage product={selected} className="h-14 w-14" />
                  <div className="min-w-0">
                    <h2 className="break-words text-base font-bold">{selected.name}</h2>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {selected.variantLabel || "Variante única"}
                    </p>
                    <p className="mt-1 break-all text-[11px] text-muted-foreground">
                      SKU {selected.sku}
                    </p>
                  </div>
                </div>
                <dl className="mb-5 grid grid-cols-2 gap-3 rounded-xl border bg-background p-3 text-xs">
                  <div>
                    <dt className="text-muted-foreground">PVP de referencia</dt>
                    <dd className="mt-1 font-semibold">{liveMoney(selected.regularPrice)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Stock disponible</dt>
                    <dd className="mt-1 font-semibold">
                      {selected.availableStock > 0
                        ? `${selected.availableStock} unidades`
                        : "Sin stock"}
                    </dd>
                  </div>
                </dl>
                {selected.availableStock <= 0 ? (
                  <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
                    Puedes configurar esta variante. Para venderla necesita stock disponible.
                  </p>
                ) : null}
                {state.error ? (
                  <div className="mb-4">
                    <LiveErrorBanner message={state.error} />
                  </div>
                ) : null}
                <form
                  className="space-y-5"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void save();
                  }}
                >
                  <label htmlFor={`${id}-price`} className="grid gap-2 text-sm font-medium">
                    Precio live (S/)
                    <Input
                      ref={priceInput}
                      id={`${id}-price`}
                      type="number"
                      inputMode="decimal"
                      min="0.01"
                      max="9999999999.99"
                      step="0.01"
                      required
                      disabled={locked}
                      value={draft.price}
                      aria-invalid={!priceValid}
                      aria-describedby={`${id}-price-hint`}
                      className="h-11 bg-background text-base"
                      onChange={(event) =>
                        setPicker((previous) => ({
                          ...previous,
                          selected: previous.selected
                            ? { ...previous.selected, price: event.target.value }
                            : null,
                        }))
                      }
                    />
                    <span
                      id={`${id}-price-hint`}
                      className={cn(
                        "text-xs font-normal",
                        priceValid ? "text-muted-foreground" : "text-red-600",
                      )}
                    >
                      {priceValid
                        ? "Este precio se aplica sólo al catálogo del Live."
                        : "Usa un precio mayor que 0, con hasta 2 decimales y máximo S/ 9,999,999,999.99."}
                    </span>
                  </label>
                  <label htmlFor={`${id}-max`} className="grid gap-2 text-sm font-medium">
                    Máximo por cliente (opcional)
                    <Input
                      id={`${id}-max`}
                      type="number"
                      inputMode="numeric"
                      min="1"
                      max="10000"
                      step="1"
                      disabled={locked}
                      placeholder="Sin límite"
                      value={draft.max}
                      aria-invalid={!maxValid}
                      aria-describedby={`${id}-max-hint`}
                      className="h-11 bg-background"
                      onChange={(event) =>
                        setPicker((previous) => ({
                          ...previous,
                          selected: previous.selected
                            ? { ...previous.selected, max: event.target.value }
                            : null,
                        }))
                      }
                    />
                    <span
                      id={`${id}-max-hint`}
                      className={cn(
                        "text-xs font-normal",
                        maxValid ? "text-muted-foreground" : "text-red-600",
                      )}
                    >
                      {maxValid
                        ? "Cuenta compras y apartados de esta variante en el mismo Live."
                        : "Usa un entero entre 1 y 10,000 o deja el campo vacío."}
                    </span>
                  </label>
                  <Button
                    type="submit"
                    className="h-11 w-full bg-violet-600 text-white hover:bg-violet-700"
                    disabled={locked || !priceValid || !maxValid}
                  >
                    {locked ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <Plus className="h-4 w-4" aria-hidden="true" />
                    )}
                    {locked ? "Guardando…" : editing ? "Guardar cambios" : "Agregar al Live"}
                  </Button>
                  <p className="text-center text-xs text-muted-foreground">
                    Después de guardar puedes agregar otra variante.
                  </p>
                </form>
              </>
            ) : (
              <div className="flex h-full min-h-52 flex-col items-center justify-center px-3 py-10 text-center">
                <div className="mb-4 rounded-2xl bg-violet-100 p-4 text-violet-600 dark:bg-violet-500/15">
                  <PackageSearch className="h-7 w-7" aria-hidden="true" />
                </div>
                <h2 className="text-sm font-semibold">Elige una variante</h2>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                  Abre un producto de la lista para configurar su precio Live y el límite por
                  cliente.
                </p>
              </div>
            )}
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
