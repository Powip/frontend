"use client";

import { useId, useMemo, useState } from "react";
import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { AlertTriangle, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { canSeeProductCosts } from "@/config/permissions.config";
import { useMyWarehouses } from "@/hooks/useMyWarehouses";
import { getVariantCosts } from "@/services/purchasesService";
import { getStockByVariants } from "@/services/inventoryItems.service";
import { getProductChannels, saveProductChannel } from "@/services/productChannelsService";
import { convertBundle } from "@/services/bundlePromos.service";
import {
  createPack,
  getPackMarginRules,
  listPackComponentProducts,
  listPackProductVariants,
  packTypeOf,
  updatePack,
  type PackComponentProduct,
  type PackLowMarginConflict,
  type PackProductVariant,
  type PackType,
  type PackView,
  type UpdatePackBody,
} from "@/services/packsService";
import { apiErrorInfo } from "@/lib/catalog/catalogPayloads";
import { RULE_CHANNELS, SAME_RULE, channelName, type PriceRule, type RuleChannel } from "@/lib/catalog/productChannels";
import { channelLabel } from "@/lib/promotions/orderChannels";
import { formatVariantLabel } from "@/lib/variantAttributes";
import {
  marginAlert,
  needsMarginConfirmation,
  packMargin,
  packStockPreview,
  packWarnings,
  percent,
  soles,
  variantLabel,
  type PackStockRow,
} from "@/lib/packs/packMath";

/** Un componente en la ventana: FIXED usa `variantId`; CHOOSE, `allowedIds`. */
interface ComponentRow {
  key: string;
  productId: string | null;
  productName: string;
  /** Bundle anterior sin producto (solo el nombre): se busca con este texto. */
  hintName?: string;
  variantId: string | null;
  allowedIds: string[];
  quantity: number;
  /** Variantes guardadas que ya no están vivas (para mostrarlas igual en la lista). */
  saved: Record<string, { label: string; sku: string | null }>;
}

/** Datos para abrir la ventana ya llena (Convertir bundle). */
export interface PackFormSeed {
  name?: string;
  price?: number;
  packType?: PackType;
  components: Array<{ productId: string | null; productName: string; variantId?: string | null; quantity?: number }>;
}

/** Bundle anterior que se convierte: al guardar el pack se llama a `convert`. */
export interface PackFormBundle {
  id: string;
  name: string;
  channels: string[];
}

const MASK = "••••";
const MAX_QTY = 1000;
export const PACK_SAVED_MESSAGE = "✓ Pack guardado. Ya aparece en Productos (tipo Pack) y se vende en tus canales.";
export const PACK_SAVED_CHOOSE_MESSAGE =
  "✓ Pack guardado. Ya aparece en Productos (tipo Pack). Un pack a elegir todavía no se vende: pronto podrás venderlo desde Registrar venta.";
const TYPE_HINT: Record<PackType, string> = {
  FIXED: "Ej.: polo negro M + short beige M. Siempre salen esos SKUs.",
  CHOOSE: "Ej.: 2 jeans Jimena, el cliente elige talla y color entre las variantes permitidas. El pedido guarda los SKUs elegidos.",
};

let rowSeq = 0;
const newKey = () => `row-${++rowSeq}`;

function lowMarginConflict(error: unknown): PackLowMarginConflict | null {
  if (!axios.isAxiosError(error) || error.response?.status !== 409) return null;
  const data = error.response.data as Partial<PackLowMarginConflict> | undefined;
  return data?.code === "PACK_LOW_MARGIN" ? (data as PackLowMarginConflict) : null;
}

const attributesText = (attributes: Record<string, string> | null | undefined) => formatVariantLabel(attributes ?? {}) || "Única";

function rowsFromPack(pack: PackView): ComponentRow[] {
  if (packTypeOf(pack) === "CHOOSE") {
    return [...(pack.choiceComponents ?? [])]
      .sort((a, b) => a.slot - b.slot)
      .map((component) => ({
        key: newKey(),
        productId: component.productId,
        productName: component.productName,
        variantId: component.variants.length === 1 ? component.variants[0].variantId : null,
        allowedIds: component.variants.map((variant) => variant.variantId),
        quantity: component.quantity,
        saved: Object.fromEntries(component.variants.map((variant) => [variant.variantId, { label: attributesText(variant.attributeValues), sku: variant.sku }])),
      }));
  }
  return pack.components.map((component) => ({
    key: newKey(),
    productId: component.productId,
    productName: component.productName,
    variantId: component.variantId,
    allowedIds: [component.variantId],
    quantity: component.quantity,
    saved: { [component.variantId]: { label: attributesText(component.attributeValues), sku: component.sku } },
  }));
}

function rowsFromSeed(seed: PackFormSeed): ComponentRow[] {
  return seed.components.map((component) => ({
    key: newKey(),
    productId: component.productId,
    productName: component.productId ? component.productName : "",
    hintName: component.productId ? undefined : component.productName,
    variantId: component.variantId ?? null,
    allowedIds: component.variantId ? [component.variantId] : [],
    quantity: component.quantity ?? 1,
    saved: {},
  }));
}

/** Variantes que se pueden elegir: las vivas y activas, más las guardadas que ya no lo están. */
function rowOptions(row: ComponentRow, variants: PackProductVariant[] | undefined) {
  const live = (variants ?? []).filter((variant) => variant.active);
  const extra = Object.entries(row.saved)
    .filter(([id]) => !live.some((variant) => variant.id === id))
    .map(([id, info]) => ({ id, sku: info.sku, attributeValues: {} as Record<string, string>, price: null, active: false, label: `${info.label} (inactiva)` }));
  return [...live.map((variant) => ({ ...variant, label: attributesText(variant.attributeValues) })), ...extra];
}

/** Variantes elegidas del componente según el tipo de pack. */
const chosenIds = (row: ComponentRow, type: PackType): string[] =>
  type === "FIXED" ? (row.variantId ? [row.variantId] : []) : row.allowedIds;

function ProductSearch({ label, products, initialQuery, onPick }: { label: string; products: PackComponentProduct[]; initialQuery?: string; onPick: (product: PackComponentProduct) => void }) {
  const id = useId();
  const [query, setQuery] = useState(initialQuery ?? "");
  const text = query.trim().toLowerCase();
  const matches = text.length < 2 ? [] : products.filter((product) => product.name.toLowerCase().includes(text) || (product.companySku ?? product.sku).toLowerCase().includes(text)).slice(0, 20);
  return (
    <div className="min-w-0 flex-1 space-y-1">
      <label htmlFor={id} className="sr-only">{label}</label>
      <Input id={id} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Elige producto…" autoComplete="off" />
      {text.length >= 2 && matches.length === 0 ? <p className="text-xs text-muted-foreground">Ningún producto coincide (no entran packs ni productos con IMEI o serie).</p> : null}
      {matches.length > 0 ? (
        <ul className="max-h-44 overflow-y-auto rounded-md border" aria-label={`Resultados de ${label}`}>
          {matches.map((product) => (
            <li key={product.id}>
              <button type="button" className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-muted" onClick={() => onPick(product)}>
                <span className="truncate">{product.name}</span>
                <span className="shrink-0 font-mono text-xs text-muted-foreground">{product.companySku || product.sku}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function ComponentEditor({
  row,
  index,
  type,
  products,
  variants,
  stock,
  error,
  onChange,
  onRemove,
}: {
  row: ComponentRow;
  index: number;
  type: PackType;
  products: PackComponentProduct[];
  variants: { data?: PackProductVariant[]; isPending: boolean; isError: boolean };
  stock: Map<string, number> | undefined;
  error?: string;
  onChange: (patch: Partial<ComponentRow>) => void;
  onRemove: () => void;
}) {
  const name = row.productName || row.hintName || `componente ${index + 1}`;
  const options = rowOptions(row, variants.data);
  const stockText = (variantId: string) => (stock ? `${stock.get(variantId) ?? 0} disp.` : "");
  return (
    <li className="space-y-2 rounded-md border p-3" data-testid={`pack-component-${index}`}>
      <div className="flex items-start gap-2">
        {row.productId ? (
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{row.productName}</p>
            <Button type="button" variant="link" size="sm" className="h-auto p-0 text-xs" onClick={() => onChange({ productId: null, productName: "", variantId: null, allowedIds: [], saved: {} })}>
              Cambiar producto
            </Button>
          </div>
        ) : (
          <ProductSearch
            label={`Producto del componente ${index + 1}`}
            products={products}
            initialQuery={row.hintName}
            onPick={(product) => onChange({ productId: product.id, productName: product.name, hintName: undefined, variantId: null, allowedIds: [], saved: {} })}
          />
        )}
        <Input
          type="number"
          min={1}
          max={MAX_QTY}
          className="w-20 text-right"
          aria-label={`Cantidad de ${name}`}
          value={row.quantity}
          onChange={(event) => onChange({ quantity: Math.trunc(Number(event.target.value) || 0) })}
        />
        <Button type="button" variant="ghost" size="icon" aria-label={`Quitar ${name}`} onClick={onRemove}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      {!row.productId && row.hintName ? <p className="text-xs text-amber-700 dark:text-amber-300">Del bundle: «{row.hintName}». Elige el producto.</p> : null}
      {row.productId ? (
        variants.isError ? (
          <p role="alert" className="text-xs text-destructive">No se pudieron leer las variantes de {row.productName}.</p>
        ) : variants.isPending ? (
          <p role="status" className="text-xs text-muted-foreground">Cargando variantes…</p>
        ) : type === "FIXED" ? (
          <select
            aria-label={`Variante de ${row.productName}`}
            className="w-full rounded-md border bg-background p-2 text-sm"
            value={row.variantId ?? ""}
            onChange={(event) => onChange({ variantId: event.target.value || null })}
          >
            <option value="">Variante (SKU)…</option>
            {options.map((option) => (
              <option key={option.id} value={option.id}>
                {[option.label, option.sku, stockText(option.id)].filter(Boolean).join(" · ")}
              </option>
            ))}
          </select>
        ) : (
          <fieldset className="space-y-1.5">
            <legend className="sr-only">Variantes permitidas de {row.productName}</legend>
            <div className="flex flex-wrap gap-2">
              {options.map((option) => {
                const available = stock?.get(option.id) ?? null;
                const checked = row.allowedIds.includes(option.id);
                return (
                  <label
                    key={option.id}
                    className={cn("flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs", checked && "border-[#027778] bg-[#e7f3f3] dark:bg-teal-950/40", available !== null && available <= 0 && "text-muted-foreground")}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(event) =>
                        onChange({ allowedIds: event.target.checked ? [...row.allowedIds, option.id] : row.allowedIds.filter((id) => id !== option.id) })
                      }
                    />
                    {option.label}
                    {option.sku ? <span className="font-mono text-muted-foreground">{option.sku}</span> : null}
                    {available !== null ? <span className="tabular-nums">{available}</span> : null}
                  </label>
                );
              })}
            </div>
            {options.length === 0 ? <p className="text-xs text-muted-foreground">Este producto no tiene variantes activas.</p> : null}
            <p className="text-xs text-muted-foreground">Variantes permitidas. Las que no tienen stock no se ofrecen al vender.</p>
          </fieldset>
        )
      ) : null}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </li>
  );
}

/**
 * FEAT-24 H9 y FEAT-32 M5 (spec §5.9, §6.14, §7.15, §6.18) — ventana del pack: nombre, SKU (se genera solo), tipo
 * (Fijo: una variante por componente; A elegir: las variantes permitidas), componentes con su cantidad, precio,
 * canales de POWIP por tienda (`product_channel` de M2, se guardan después del pack) y el resumen con el stock
 * disponible (y el componente que limita), la suma de componentes, el margen sin IGV y los avisos de §6.14, que no
 * bloquean. El margen bajo el mínimo (o el precio bajo el costo) exige confirmarlo, como antes (409 `PACK_LOW_MARGIN`).
 * Con `bundle`, es «Convertir bundle»: al crear el pack se desactiva el bundle (`convert`).
 */
export function PackFormDialog({
  pack,
  seed,
  bundle,
  onClose,
  onSaved,
}: {
  pack: PackView | null;
  seed?: PackFormSeed;
  bundle?: PackFormBundle;
  onClose: () => void;
  onSaved?: (pack: PackView) => void;
}) {
  const { auth } = useAuth();
  const companyId = auth?.company?.id ?? "";
  const stores = useMemo(() => auth?.company?.stores ?? [], [auth?.company?.stores]);
  const seeCosts = canSeeProductCosts(auth?.user);
  const myWarehouses = useMyWarehouses();
  const queryClient = useQueryClient();
  const savedType: PackType = pack ? packTypeOf(pack) : (seed?.packType ?? "FIXED");
  const [name, setName] = useState(pack?.name ?? seed?.name ?? "");
  const [sku, setSku] = useState(pack ? (pack.sku || pack.productSku || "") : "");
  const [type, setType] = useState<PackType>(savedType);
  const [priceText, setPriceText] = useState(pack ? String(pack.price) : seed?.price !== undefined ? String(seed.price) : "");
  const [rows, setRows] = useState<ComponentRow[]>(() => (pack ? rowsFromPack(pack) : seed ? rowsFromSeed(seed) : []));
  const [channelChoice, setChannelChoice] = useState<Record<string, boolean>>({});
  const [confirmLow, setConfirmLow] = useState(false);
  const [serverConflict, setServerConflict] = useState<PackLowMarginConflict | null>(null);
  const [tried, setTried] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const products = useQuery({
    queryKey: ["pack-component-products", companyId],
    queryFn: ({ signal }) => listPackComponentProducts(companyId, signal),
    enabled: !!companyId,
    retry: false,
    staleTime: 60_000,
  });
  const productIds = useMemo(() => [...new Set(rows.map((row) => row.productId).filter((id): id is string => !!id))].sort(), [rows]);
  const variantQueries = useQueries({
    queries: productIds.map((productId) => ({
      queryKey: ["pack-product-variants", productId],
      queryFn: ({ signal }: { signal: AbortSignal }) => listPackProductVariants(productId, signal),
      retry: false,
      staleTime: 60_000,
    })),
  });
  const variantsByProduct = new Map(productIds.map((productId, index) => [productId, variantQueries[index]]));
  // Todas las variantes de los productos elegidos: marcar o cambiar una no vuelve a pedir stock ni costos.
  const allVariantIds = useMemo(() => {
    const ids = new Set<string>();
    variantQueries.forEach((query) => query.data?.forEach((variant) => ids.add(variant.id)));
    rows.forEach((row) => Object.keys(row.saved).forEach((id) => ids.add(id)));
    return [...ids].sort();
  }, [variantQueries, rows]);

  const stock = useQuery({
    queryKey: ["pack-form-stock", companyId, allVariantIds],
    queryFn: async () => {
      const result = new Map<string, PackStockRow[]>();
      for (const row of await getStockByVariants(allVariantIds)) {
        result.set(
          row.variant_id,
          (row.inventories ?? []).map((inventory) => ({
            inventoryId: inventory.inventory_id,
            inventoryName: inventory.inventory_name,
            storeId: inventory.store_id,
            available: Math.max(0, Number(inventory.quantity) - Number(inventory.reserved_quantity)),
          })),
        );
      }
      return result;
    },
    enabled: allVariantIds.length > 0,
    retry: false,
    staleTime: 30_000,
  });
  // FEAT-24 H6: como el resto del stock, solo los almacenes que el usuario ve.
  const visibleStock = useMemo(() => {
    if (!stock.data) return undefined;
    return new Map([...stock.data.entries()].map(([variantId, list]) => [variantId, list.filter((row) => myWarehouses.canSee(row.inventoryId))]));
  }, [stock.data, myWarehouses]);
  const stockByVariant = useMemo(
    () => (visibleStock ? new Map([...visibleStock.entries()].map(([variantId, list]) => [variantId, list.reduce((sum, row) => sum + row.available, 0)])) : undefined),
    [visibleStock],
  );
  const rules = useQuery({ queryKey: ["pack-margin-rules", companyId], queryFn: ({ signal }) => getPackMarginRules(signal), enabled: seeCosts && !!companyId, retry: false, staleTime: 60_000 });
  const costs = useQuery({
    queryKey: ["pack-component-costs", companyId, allVariantIds],
    queryFn: async () => new Map((await getVariantCosts(allVariantIds)).map((row) => [row.variantId, row.averageCost])),
    enabled: seeCosts && allVariantIds.length > 0,
    retry: false,
  });

  // Canales de POWIP del pack por tienda: al editar se leen; un pack nuevo nace activo en todos.
  const channelQueries = useQueries({
    queries: stores.map((store) => ({
      queryKey: ["product-channels", pack?.id ?? "", store.id],
      queryFn: ({ signal }: { signal: AbortSignal }) => getProductChannels(pack!.id, store.id, signal),
      enabled: !!pack,
      retry: false,
    })),
  });
  const savedChannel = (storeIndex: number, channel: RuleChannel): { active: boolean; rule: PriceRule } | null => {
    if (!pack) return { active: true, rule: SAME_RULE };
    const view = channelQueries[storeIndex]?.data;
    if (!view) return null;
    const row = view.channels.find((item) => item.channel === channel);
    return row ? { active: row.active, rule: row.rule } : { active: true, rule: SAME_RULE };
  };
  const channelKey = (storeId: string, channel: RuleChannel) => `${storeId}:${channel}`;

  // Precio y costo de cada componente (CHOOSE: el mayor de sus permitidas).
  const variantInfo = (row: ComponentRow) => new Map((variantsByProduct.get(row.productId ?? "")?.data ?? []).map((variant) => [variant.id, variant]));
  const complete = rows.filter((row) => row.productId && chosenIds(row, type).length > 0 && row.quantity > 0);
  const listTotal = complete.length
    ? complete.reduce((sum, row) => {
        const info = variantInfo(row);
        const prices = chosenIds(row, type).map((id) => info.get(id)?.price ?? 0);
        return sum + Math.max(0, ...prices) * row.quantity;
      }, 0)
    : null;
  const componentCosts = new Map<string, number | null>();
  if (costs.data) {
    for (const row of complete) {
      const values = chosenIds(row, type).map((id) => costs.data.get(id) ?? null);
      componentCosts.set(row.key, values.some((value) => value === null) ? null : Math.max(...(values as number[])));
    }
  }
  const price = Number(priceText.replace(",", "."));
  const priceValid = Number.isFinite(price) && price > 0;
  const live = seeCosts && rules.data && costs.data && priceValid && complete.length
    ? packMargin({ price, components: complete.map((row) => ({ variantId: row.key, quantity: row.quantity })), costs: componentCosts, rules: rules.data })
    : null;
  const warnings = priceValid ? packWarnings({ price, componentsTotal: listTotal, netPrice: live?.netPrice, cost: live?.cost }) : [];
  const alert = serverConflict ? serverConflict.message : live ? marginAlert(live) : "";
  const mustConfirm = Boolean(serverConflict) || needsMarginConfirmation(live?.status);
  const preview = visibleStock
    ? packStockPreview(
        complete.map((row) => {
          const ids = chosenIds(row, type);
          const info = variantInfo(row);
          const label = type === "FIXED" ? variantLabel(row.productName, info.get(ids[0])?.attributeValues) : row.productName;
          return { productId: row.productId as string, variantIds: ids, quantity: row.quantity, label };
        }),
        visibleStock,
      )
    : null;

  const changeRows = (change: (current: ComponentRow[]) => ComponentRow[]) => {
    setRows(change);
    setServerConflict(null);
  };
  const patchRow = (key: string, patch: Partial<ComponentRow>) => changeRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  const changeType = (next: PackType) => {
    if (next === type) return;
    // Fijo → A elegir: la variante elegida queda como permitida; A elegir → Fijo: si había una sola, queda elegida.
    changeRows((current) =>
      current.map((row) =>
        next === "CHOOSE"
          ? { ...row, allowedIds: row.variantId ? [row.variantId] : row.allowedIds }
          : { ...row, variantId: row.allowedIds.length === 1 ? row.allowedIds[0] : row.variantId && row.allowedIds.includes(row.variantId) ? row.variantId : null },
      ),
    );
    setType(next);
  };

  const rowErrors: Record<string, string> = {};
  const fixedIds = rows.map((row) => row.variantId).filter(Boolean);
  for (const row of rows) {
    if (!row.productId) rowErrors[row.key] = "Elige el producto.";
    else if (type === "FIXED" && !row.variantId) rowErrors[row.key] = "Elige la variante (SKU): sin SKU el almacén no sabe qué sacar.";
    else if (type === "FIXED" && fixedIds.filter((id) => id === row.variantId).length > 1) rowErrors[row.key] = "Esta variante ya está en el pack: suma la cantidad.";
    else if (type === "CHOOSE" && row.allowedIds.length === 0) rowErrors[row.key] = "Elige al menos una variante permitida.";
    else if (!Number.isInteger(row.quantity) || row.quantity < 1 || row.quantity > MAX_QTY) rowErrors[row.key] = `La cantidad va de 1 a ${MAX_QTY}.`;
  }
  const nameError = name.trim() ? "" : "Ponle un nombre.";
  const priceError = priceValid ? "" : "Escribe el precio del pack.";
  const unitsError = rows.length === 0 ? "Agrega al menos un componente." : rows.reduce((sum, row) => sum + Math.max(0, row.quantity), 0) < 2 ? "Un pack necesita al menos 2 unidades en total." : "";

  const validate = (): string => {
    if (nameError || priceError || unitsError || Object.keys(rowErrors).length) return "Revisa los campos marcados.";
    if (mustConfirm && !confirmLow) return "Confirma que quieres guardar el pack con este margen.";
    return "";
  };

  /** Guarda los canales que cambiaron (con la regla de precio que ya tenían). */
  const saveChannels = async (packId: string): Promise<string | null> => {
    const changes: Array<{ storeId: string; channel: RuleChannel; active: boolean; rule: PriceRule }> = [];
    stores.forEach((store, index) => {
      for (const channel of RULE_CHANNELS) {
        const choice = channelChoice[channelKey(store.id, channel)];
        const current = savedChannel(index, channel);
        if (choice === undefined || !current || choice === current.active) continue;
        changes.push({ storeId: store.id, channel, active: choice, rule: current.rule });
      }
    });
    if (!changes.length) return null;
    const results = await Promise.allSettled(changes.map((change) => saveProductChannel(packId, change)));
    const failed = results.find((result): result is PromiseRejectedResult => result.status === "rejected");
    return failed ? apiErrorInfo(failed.reason, "No se pudieron guardar los canales.").message : null;
  };

  const save = async () => {
    setTried(true);
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }
    setError("");
    setSaving(true);
    const components =
      type === "FIXED"
        ? rows.map((row) => ({ variantId: row.variantId as string, quantity: row.quantity }))
        : rows.map((row) => ({ productId: row.productId as string, allowedVariantIds: row.allowedIds, quantity: row.quantity }));
    const confirm = mustConfirm && confirmLow ? true : undefined;
    const roundedPrice = Math.round(price * 100) / 100;
    let saved: PackView;
    try {
      if (pack) {
        const body: UpdatePackBody = { components };
        if (name.trim() !== pack.name) body.name = name.trim();
        if (Math.round(price * 100) !== Math.round(pack.price * 100)) body.price = roundedPrice;
        if (type !== savedType) body.packType = type;
        if (sku.trim() && sku.trim() !== (pack.sku || pack.productSku || "")) body.companySku = sku.trim();
        if (confirm) body.confirmLowMargin = true;
        saved = await updatePack(pack.id, body);
      } else {
        saved = await createPack({
          name: name.trim(),
          price: roundedPrice,
          packType: type,
          components,
          ...(sku.trim() ? { companySku: sku.trim() } : {}),
          ...(confirm ? { confirmLowMargin: true } : {}),
        });
      }
    } catch (cause) {
      const conflict = lowMarginConflict(cause);
      if (conflict) {
        setServerConflict(conflict);
        setConfirmLow(false);
        setError("Confirma el margen para guardar el pack.");
      } else {
        setError(apiErrorInfo(cause, "No se pudo guardar el pack.").message);
      }
      setSaving(false);
      return;
    }
    // El pack ya quedó guardado: lo que falle después se avisa sin volver a crearlo.
    const channelProblem = await saveChannels(saved.id);
    if (channelProblem) toast.error(`El pack se guardó, pero no se pudieron guardar sus canales: ${channelProblem}`);
    let converted = false;
    if (bundle) {
      try {
        await convertBundle(bundle.id, saved.id);
        converted = true;
      } catch (cause) {
        toast.error(`El pack se guardó, pero el bundle «${bundle.name}» sigue activo: ${apiErrorInfo(cause, "no se pudo desactivar.").message} Desactívalo en Bundles anteriores.`);
      }
    }
    for (const key of ["packs", "pack", "bundle-promos", "product-channels", "product-channel-summary", "catalog-product", "business-product-catalog"]) {
      void queryClient.invalidateQueries({ queryKey: [key] });
    }
    const message = type === "CHOOSE" ? PACK_SAVED_CHOOSE_MESSAGE : PACK_SAVED_MESSAGE;
    toast.success(converted ? `${message} El bundle «${bundle?.name}» quedó desactivado.` : message);
    setSaving(false);
    onSaved?.(saved);
    onClose();
  };

  const stockValue = preview ? preview.total : pack?.available ? pack.available.total : null;
  const limitingLabel = preview ? preview.limiting?.label : pack?.available?.limiting?.label;

  return (
    <Dialog open onOpenChange={(open) => !open && !saving && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{pack ? "Editar pack" : "Nuevo pack"}</DialogTitle>
          <DialogDescription>Un pack es un producto con SKU propio. Sus componentes son variantes (SKU).</DialogDescription>
        </DialogHeader>
        {bundle ? (
          <div role="note" className="space-y-1 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
            <p>Convertir bundle: elige la variante de cada producto. Al guardar, el bundle se desactiva y queda este pack.</p>
            {bundle.channels.length ? <p className="text-xs">El bundle se vendía en: {bundle.channels.map(channelLabel).join(", ")}. Revisa los canales del pack.</p> : null}
          </div>
        ) : null}
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="pack-name">Nombre del pack</Label>
              <Input id="pack-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Ej. Kit verano" maxLength={200} aria-invalid={tried && !!nameError} />
              {tried && nameError ? <p className="text-xs text-destructive">{nameError}</p> : null}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pack-sku">SKU del pack <span className="text-muted-foreground">(opcional)</span></Label>
              <Input id="pack-sku" value={sku} onChange={(event) => setSku(event.target.value)} placeholder="PK-0001" className="font-mono" maxLength={100} aria-describedby="pack-sku-hint pack-sku-shopify" />
              <p id="pack-sku-hint" className="text-xs text-muted-foreground">Se genera solo; único en tu empresa.</p>
              {/* Correcciones 11-20 (A1): un pedido de Shopify se reconoce como pack solo por el SKU (o un vínculo ya hecho). */}
              <p id="pack-sku-shopify" className="text-xs text-muted-foreground">Si lo vendes en Shopify, usa el mismo SKU que tiene allá: así sus pedidos descuentan los componentes.</p>
            </div>
          </div>

          <fieldset className="space-y-1.5">
            <legend className="text-sm font-medium">Tipo de pack</legend>
            <div className="flex flex-wrap gap-1.5">
              {([["FIXED", "Fijo: variantes definidas"], ["CHOOSE", "A elegir: el cliente elige talla y color"]] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={type === value}
                  onClick={() => changeType(value)}
                  className={cn("rounded-full border px-3 py-1 text-sm font-medium", type === value ? "border-[#027778] bg-[#e7f3f3] text-[#015d5e] dark:bg-teal-950/40 dark:text-teal-100" : "bg-background text-muted-foreground hover:bg-muted")}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">{TYPE_HINT[type]}</p>
            {type === "CHOOSE" ? <p className="text-xs text-amber-700 dark:text-amber-300">Un pack a elegir todavía no se vende: pronto podrás venderlo desde Registrar venta.</p> : null}
          </fieldset>

          <section className="space-y-2" aria-label="Componentes">
            <p className="text-sm font-medium">Componentes</p>
            {products.isError ? <p role="alert" className="text-xs text-destructive">No se pudieron cargar los productos. <Button type="button" variant="link" size="sm" className="h-auto p-0" onClick={() => void products.refetch()}>Reintentar</Button></p> : null}
            {rows.length === 0 ? <p className="text-sm text-muted-foreground">Todavía no agregaste componentes.</p> : null}
            <ul className="space-y-2">
              {rows.map((row, index) => {
                const query = row.productId ? variantsByProduct.get(row.productId) : undefined;
                return (
                  <ComponentEditor
                    key={row.key}
                    row={row}
                    index={index}
                    type={type}
                    products={products.data ?? []}
                    variants={{ data: query?.data, isPending: query?.isPending ?? true, isError: query?.isError ?? false }}
                    stock={stockByVariant}
                    error={tried ? rowErrors[row.key] : undefined}
                    onChange={(patch) => patchRow(row.key, patch)}
                    onRemove={() => changeRows((current) => current.filter((item) => item.key !== row.key))}
                  />
                );
              })}
            </ul>
            <Button type="button" variant="link" className="h-auto p-0" onClick={() => changeRows((current) => [...current, { key: newKey(), productId: null, productName: "", variantId: null, allowedIds: [], quantity: 1, saved: {} }])}>
              ＋ Agregar producto
            </Button>
            {tried && unitsError ? <p className="text-xs text-destructive">{unitsError}</p> : null}
            <p className="text-xs text-muted-foreground">Sin IMEI ni serie y sin otros packs.</p>
          </section>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="pack-price">Precio del pack (S/)</Label>
              <Input id="pack-price" inputMode="decimal" value={priceText} onChange={(event) => { setPriceText(event.target.value); setServerConflict(null); setConfirmLow(false); }} placeholder="0.00" aria-invalid={tried && !!priceError} />
              {tried && priceError ? <p className="text-xs text-destructive">{priceError}</p> : <p className="text-xs text-muted-foreground">Con IGV.</p>}
            </div>
          </div>

          {stores.length ? (
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Canales y tiendas</legend>
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                    <tr>
                      <th className="px-3 py-1.5">Tienda</th>
                      {RULE_CHANNELS.map((channel) => <th key={channel} className="px-3 py-1.5">{channelName(channel)}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {stores.map((store, index) => {
                      const query = channelQueries[index];
                      const failed = !!pack && query?.isError;
                      return (
                        <tr key={store.id} className="border-t">
                          <td className="px-3 py-1.5">
                            {store.name}
                            {failed ? <small className="block text-xs text-destructive">No se pudieron leer sus canales.</small> : null}
                          </td>
                          {RULE_CHANNELS.map((channel) => {
                            const current = savedChannel(index, channel);
                            const checked = channelChoice[channelKey(store.id, channel)] ?? current?.active ?? true;
                            return (
                              <td key={channel} className="px-3 py-1.5">
                                <input
                                  type="checkbox"
                                  aria-label={`${channelName(channel)} en ${store.name}`}
                                  checked={checked}
                                  disabled={!current}
                                  onChange={(event) => setChannelChoice((choice) => ({ ...choice, [channelKey(store.id, channel)]: event.target.checked }))}
                                />
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-muted-foreground">
                Son los canales de POWIP de cada tienda (Configuración › Tiendas), los mismos de precios y promociones. Para publicarlo en Shopify o Mercado Libre, después se activa en su ficha › Canales, como cualquier producto.
              </p>
            </fieldset>
          ) : null}

          <div className="grid gap-2 rounded-md border bg-muted/40 p-3 text-sm sm:grid-cols-3" aria-label="Resumen del pack">
            <div>
              <small className="block text-xs text-muted-foreground">Stock disponible</small>
              <b className="tabular-nums" data-testid="pack-stock">{stockValue ?? "—"}</b>
              {limitingLabel && complete.length ? <small className="block text-xs text-muted-foreground">Limita: {limitingLabel}</small> : null}
            </div>
            <div>
              <small className="block text-xs text-muted-foreground">Suma de componentes</small>
              <b className="tabular-nums" data-testid="pack-components-total">{soles(listTotal)}</b>
              {seeCosts ? <small className="block text-xs text-muted-foreground">Costo: {live ? soles(live.cost) : "—"}</small> : null}
            </div>
            <div>
              <small className="block text-xs text-muted-foreground">Margen (sin IGV)</small>
              <b className={cn("tabular-nums", live && needsMarginConfirmation(live.status) ? "text-destructive" : "text-emerald-700 dark:text-emerald-400")} data-testid="pack-margin">
                {seeCosts
                  ? live
                    ? live.status === "sin_costo" || live.cost === null
                      ? "Sin costo"
                      : `${soles(live.netPrice - live.cost)} · ${percent(live.margin)}`
                    : "—"
                  : MASK}
              </b>
              {seeCosts && rules.data ? <small className="block text-xs text-muted-foreground">Mínimo: {percent(rules.data.minMargin)}</small> : null}
            </div>
            {seeCosts && live?.status === "sin_costo" ? <p className="text-xs text-muted-foreground sm:col-span-3">Algún componente todavía no tiene costo: el margen no se puede medir.</p> : null}
          </div>

          {warnings.length ? (
            <div aria-live="polite" className="space-y-1" data-testid="pack-warnings">
              {warnings.map((warning) => (
                <p key={warning} className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-500/10 dark:text-amber-200">{warning}</p>
              ))}
            </div>
          ) : null}

          {alert ? (
            <div role="alert" className="flex gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <div className="space-y-2">
                <p><b>Margen bajo.</b> {alert}</p>
                <label className="flex items-center gap-2 text-foreground">
                  <input type="checkbox" checked={confirmLow} onChange={(event) => setConfirmLow(event.target.checked)} />
                  Guardar igual con este margen
                </label>
              </div>
            </div>
          ) : null}
          {error ? <p className="text-sm text-destructive" role="status">{error}</p> : null}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button type="button" onClick={() => void save()} disabled={saving}>{saving ? "Guardando…" : "Guardar pack"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
