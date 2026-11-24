"use client";

import { useId, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { canSeeProductCosts } from "@/config/permissions.config";
import { VariantSearchPicker, searchResultLabel, type VariantSearchResult } from "@/components/variant-search/VariantSearchPicker";
import {
  createPromotion,
  deletePromotion,
  resolvePrices,
  updatePromotion,
  type GiftCondition,
  type Promotion,
  type PromotionBody,
} from "@/services/promotionsService";
import { getVariantCosts, listProductVariants, type PurchasableProduct } from "@/services/purchasesService";
import { fetchVariantsByIds } from "@/services/variantCodesService";
import { getStockByVariants } from "@/services/inventoryItems.service";
import { apiErrorInfo } from "@/lib/catalog/catalogPayloads";
import { LIVE_NOT_YET, POWIP_LIVE_CHANNEL, VOLUME_GIFT_CHANNELS, channelLabel, normalizeOrderChannel } from "@/lib/promotions/orderChannels";
import { isoFromLimaLocal, limaLocalFromIso, parseMoneyInput } from "@/lib/promotions/campaign";
import { soles, variantLabel } from "@/lib/packs/packMath";
import { DeletePromotionDialog } from "./CampaignFormDialog";

interface Store {
  id: string;
  name: string;
}

/** SKU elegido: código y nombre para la pantalla. */
interface SkuInfo {
  sku: string;
  label: string;
}

const IGV = 1.18;
const NAME_MAX = 150;
const MAX_SKUS = 500;
const STORES_HINT = "Sin elegir = todas las tiendas.";
const CHANNELS_HINT = "Sin elegir = todos los canales. Son los canales de la tienda (Configuración › Tiendas): la misma lista para promociones, packs y precios.";
const GIFT_CONDITIONS: Array<{ value: GiftCondition; label: string }> = [
  { value: "AMOUNT", label: "Por monto de compra" },
  { value: "PRODUCT", label: "Al comprar un producto" },
  { value: "VARIANT", label: "Al comprar una variante" },
];

const skuOf = (result: VariantSearchResult): SkuInfo => ({ sku: result.company_sku || result.sku, label: searchResultLabel(result) });
/** Volumen: cualquier SKU menos un pack (el pack ya tiene su propio precio). */
const notPack = (result: VariantSearchResult) => (result.product_type ?? "") !== "pack";
const intOrNull = (text: string) => (text.trim() === "" ? null : Number(text));
const rangeText = (low: number, high: number) => (Math.abs(high - low) < 0.005 ? soles(low) : `${soles(low)}–${soles(high)}`);
const dedupe = (values: string[]) => [...new Set(values)];

function Chips({ label, options, value, onChange, hint }: { label: string; options: Array<{ value: string; label: string }>; value: string[]; onChange: (next: string[]) => void; hint: string }) {
  return (
    <fieldset className="space-y-1.5">
      <legend className="text-sm font-medium">{label}</legend>
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => {
          const on = value.includes(option.value);
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(on ? value.filter((item) => item !== option.value) : [...value, option.value])}
              className={cn("rounded-full border px-3 py-1 text-xs font-medium", on ? "border-[#027778] bg-[#e7f3f3] text-[#015d5e] dark:bg-teal-950/40 dark:text-teal-200" : "bg-background text-muted-foreground hover:bg-muted")}
            >
              {option.label}
            </button>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">{hint}</p>
    </fieldset>
  );
}

function ProductPicker({ label, products, value, onChange, disabled }: { label: string; products: PurchasableProduct[]; value: string; onChange: (product: PurchasableProduct) => void; disabled?: boolean }) {
  const id = useId();
  const [query, setQuery] = useState("");
  const selected = products.find((product) => product.id === value);
  const matches = useMemo(() => {
    const text = query.trim().toLowerCase();
    if (text.length < 2) return [];
    return products.filter((product) => product.status && (product.name.toLowerCase().includes(text) || (product.companySku ?? product.sku).toLowerCase().includes(text))).slice(0, 20);
  }, [products, query]);
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-medium">{label}</label>
      {selected ? <p className="text-sm">Elegido: <b>{selected.name}</b></p> : null}
      <Input id={id} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Busca por nombre o SKU" autoComplete="off" disabled={disabled} />
      {matches.length > 0 ? (
        <ul className="max-h-40 overflow-y-auto rounded-md border" aria-label={`Resultados de ${label}`}>
          {matches.map((product) => (
            <li key={product.id}>
              <button type="button" className="w-full px-3 py-2 text-left text-sm hover:bg-muted" onClick={() => { onChange(product); setQuery(""); }}>
                {product.name} <span className="font-mono text-xs text-muted-foreground">{product.companySku ?? product.sku}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/**
 * FEAT-24 H9 (H9-D5) y FEAT-32 M4 (spec §7.14, §5.8, §6.16, §6.17) — ventana de Volumen y de Regalo. Comunes:
 * nombre, tiendas y canales (vacío = todas/todos; la misma lista de canales que la campaña, más POWIP Live),
 * desde y hasta con hora de Lima (opcionales: vacío = sin límite) y «Se puede combinar». Volumen: los SKUs que
 * cuentan (buscador o todas las variantes de un producto), cantidades, precio por las N unidades y el resumen con
 * el ahorro. Regalo: la condición (monto primero), el SKU que se regala y su stock.
 */
export function PromotionFormDialog({
  promo,
  stores,
  products,
  variantNames,
  initialType,
  onClose,
}: {
  promo: Promotion | null;
  stores: Store[];
  products: PurchasableProduct[];
  variantNames: Map<string, string>;
  /** FEAT-32 M3: la clase elegida en «＋ Nueva promoción». */
  initialType?: "VOLUME" | "GIFT";
  onClose: () => void;
}) {
  const { auth } = useAuth();
  const companyId = auth?.company?.id ?? "";
  const seeCosts = canSeeProductCosts(auth?.user);
  const queryClient = useQueryClient();
  const type: "VOLUME" | "GIFT" = promo ? (promo.type === "GIFT" ? "GIFT" : "VOLUME") : (initialType ?? "VOLUME");
  const [name, setName] = useState(promo?.name ?? "");
  const [storeIds, setStoreIds] = useState<string[]>(promo?.storeIds ?? []);
  // Un SHOPIFY viejo se muestra como WEB, igual que el backend.
  const [channels, setChannels] = useState<string[]>(() => dedupe((promo?.channels ?? []).map((channel) => normalizeOrderChannel(channel) ?? channel)));
  const [from, setFrom] = useState(limaLocalFromIso(promo?.startsAt ?? null));
  const [to, setTo] = useState(limaLocalFromIso(promo?.endsAt ?? null));
  const [combinable, setCombinable] = useState(promo?.combinable ?? false);
  const [skuIds, setSkuIds] = useState<string[]>(promo?.variantIds ?? []);
  const [known, setKnown] = useState<Record<string, SkuInfo>>({});
  const [pickingProduct, setPickingProduct] = useState(false);
  const [adding, setAdding] = useState(false);
  const [addNote, setAddNote] = useState<string | null>(null);
  const [minQty, setMinQty] = useState(promo?.minQty ? String(promo.minQty) : type === "VOLUME" ? "3" : "1");
  const [maxQty, setMaxQty] = useState(promo?.maxQty ? String(promo.maxQty) : "");
  const [packPrice, setPackPrice] = useState(promo?.packPrice != null ? String(promo.packPrice) : "");
  const [condition, setCondition] = useState<GiftCondition>(promo?.giftCondition ?? "AMOUNT");
  const [minAmount, setMinAmount] = useState(promo?.minAmount ? String(promo.minAmount) : "");
  const [productId, setProductId] = useState(promo?.productId ?? "");
  const [triggerId, setTriggerId] = useState<string | null>(promo?.triggerVariantId ?? null);
  const [giftId, setGiftId] = useState<string | null>(promo?.giftVariantId ?? null);
  const [giftQty, setGiftQty] = useState(promo?.giftQuantity ? String(promo.giftQuantity) : "1");
  const [tried, setTried] = useState(false);
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Nombre y código de los SKUs que ya estaban guardados (al editar).
  const savedIds = useMemo(
    () => dedupe([...(promo?.variantIds ?? []), promo?.giftVariantId, promo?.triggerVariantId].filter((id): id is string => !!id)),
    [promo],
  );
  const saved = useQuery({
    queryKey: ["promotion-form-variants", companyId, savedIds.join(",")],
    queryFn: () => fetchVariantsByIds(savedIds, companyId),
    enabled: savedIds.length > 0 && !!companyId,
    retry: false,
    staleTime: 60_000,
  });
  const savedInfo = useMemo(
    () => new Map((saved.data ?? []).map((variant) => [variant.id, { sku: variant.companySku || variant.sku, label: variantLabel(variant.productName, variant.attributeValues) }])),
    [saved.data],
  );
  const info = (id: string): SkuInfo | null => known[id] ?? savedInfo.get(id) ?? (variantNames.has(id) ? { sku: "", label: variantNames.get(id) as string } : null);

  // Volumen: precio de cada SKU (lista de la tienda elegida o, si no hay una sola, la lista por defecto) y su costo.
  const priceStore = storeIds.length === 1 ? storeIds[0] : stores.length === 1 ? stores[0].id : undefined;
  const sortedSkus = useMemo(() => [...skuIds].sort(), [skuIds]);
  const prices = useQuery({
    queryKey: ["volume-prices", priceStore ?? "", sortedSkus.join(",")],
    queryFn: async ({ signal }) => new Map((await resolvePrices({ storeId: priceStore, variantIds: sortedSkus }, signal)).map((row) => [row.variantId, row.price])),
    enabled: type === "VOLUME" && sortedSkus.length > 0,
    retry: false,
    staleTime: 30_000,
  });
  const costs = useQuery({
    queryKey: ["volume-costs", sortedSkus.join(",")],
    queryFn: async () => new Map((await getVariantCosts(sortedSkus)).map((row) => [row.variantId, row.averageCost])),
    enabled: type === "VOLUME" && seeCosts && sortedSkus.length > 0,
    retry: false,
    staleTime: 60_000,
  });
  // Regalo: disponible del SKU (suma de los almacenes activos).
  const giftStock = useQuery({
    queryKey: ["gift-stock", giftId],
    queryFn: async () => {
      const rows = await getStockByVariants([giftId as string]);
      const row = rows.find((item) => item.variant_id === giftId);
      return row ? Number(row.available) : 0;
    },
    enabled: type === "GIFT" && !!giftId,
    retry: false,
    staleTime: 30_000,
  });

  const errors = useMemo(() => {
    const list: Record<string, string> = {};
    if (!name.trim()) list.name = "Ponle un nombre.";
    else if (name.trim().length > NAME_MAX) list.name = `Hasta ${NAME_MAX} caracteres.`;
    const starts = from ? isoFromLimaLocal(from) : null;
    const ends = to ? isoFromLimaLocal(to) : null;
    if ((from && !starts) || (to && !ends)) list.dates = "Completa la fecha y la hora.";
    else if (starts && ends && Date.parse(ends) <= Date.parse(starts)) list.dates = "La fecha de fin debe ser después del inicio.";
    if (type === "VOLUME") {
      const min = intOrNull(minQty);
      const max = intOrNull(maxQty);
      const price = parseMoneyInput(packPrice);
      if (!skuIds.length) list.skus = "Elige al menos un SKU.";
      else if (skuIds.length > MAX_SKUS) list.skus = `Hasta ${MAX_SKUS} SKUs.`;
      if (min === null || !Number.isInteger(min) || min < 2) list.min = "Mínimo 2 unidades.";
      if (max !== null && (!Number.isInteger(max) || (min !== null && max < min))) list.max = "No puede ser menor que la mínima.";
      if (price === null || !Number.isFinite(price) || price <= 0) list.price = "Escribe el precio.";
      return list;
    }
    if (condition === "AMOUNT") {
      const amount = parseMoneyInput(minAmount);
      if (amount === null || !Number.isFinite(amount) || amount < 0.01) list.minAmount = "Escribe el monto mínimo de compra.";
    } else {
      const min = intOrNull(minQty);
      if (min === null || !Number.isInteger(min) || min < 1) list.triggerQty = "La cantidad mínima es un entero desde 1.";
      if (condition === "PRODUCT" && !productId) list.trigger = "Elige el producto que hay que comprar.";
      if (condition === "VARIANT" && !triggerId) list.trigger = "Elige la variante que hay que comprar.";
    }
    if (!giftId) list.gift = "Elige el SKU que se regala.";
    const quantity = intOrNull(giftQty);
    if (quantity === null || !Number.isInteger(quantity) || quantity < 1 || quantity > 1000) list.giftQty = "Las unidades de regalo van de 1 a 1000.";
    return list;
  }, [name, from, to, type, minQty, maxQty, packPrice, skuIds, condition, minAmount, productId, triggerId, giftId, giftQty]);

  // Resumen del volumen: precio normal (N × precio de los SKUs, rango si difieren), con volumen y ahorro.
  const summary = useMemo(() => {
    const min = intOrNull(minQty);
    const price = parseMoneyInput(packPrice);
    const validMin = min !== null && Number.isInteger(min) && min >= 2 ? min : null;
    const validPrice = price !== null && Number.isFinite(price) && price > 0 ? price : null;
    const unitPrices = skuIds.map((id) => prices.data?.get(id)).filter((value): value is number => typeof value === "number" && Number.isFinite(value));
    const low = unitPrices.length && validMin ? validMin * Math.min(...unitPrices) : null;
    const high = unitPrices.length && validMin ? validMin * Math.max(...unitPrices) : null;
    const unit = validMin && validPrice ? validPrice / validMin : null;
    const skuCosts = skuIds.map((id) => costs.data?.get(id)).filter((value): value is number => typeof value === "number" && Number.isFinite(value));
    const belowCost = unit !== null ? skuCosts.filter((cost) => unit / IGV < cost).length : 0;
    return {
      normal: low !== null && high !== null ? rangeText(low, high) : "—",
      withVolume: validPrice !== null ? soles(validPrice) : "—",
      unit: unit !== null ? `${soles(unit)} c/u` : "",
      savings: low !== null && high !== null && validPrice !== null ? rangeText(Math.max(low - validPrice, 0), Math.max(high - validPrice, 0)) : "—",
      noSavings: high !== null && validPrice !== null && high - validPrice <= 0,
      belowCost,
      unitValue: unit,
    };
  }, [minQty, packPrice, skuIds, prices.data, costs.data]);

  const addSku = (id: string, data: SkuInfo) => {
    setKnown((current) => ({ ...current, [id]: data }));
    setSkuIds((current) => (current.includes(id) ? current : [...current, id]));
  };
  const removeSku = (id: string) => setSkuIds((current) => current.filter((item) => item !== id));
  const addProductVariants = async (product: PurchasableProduct) => {
    setAdding(true);
    setAddNote(null);
    try {
      const variants = (await listProductVariants(product.id)).filter((variant) => variant.isActive && !variant.mergedInto);
      if (!variants.length) {
        setAddNote(`${product.name} no tiene variantes activas.`);
        return;
      }
      const fresh = variants.filter((variant) => !skuIds.includes(variant.id));
      setKnown((current) => ({
        ...current,
        ...Object.fromEntries(variants.map((variant) => [variant.id, { sku: variant.companySku || variant.sku, label: variantLabel(product.name, variant.attributeValues) }])),
      }));
      setSkuIds((current) => dedupe([...current, ...variants.map((variant) => variant.id)]));
      setAddNote(fresh.length ? `Se agregaron ${fresh.length} SKU${fresh.length === 1 ? "" : "s"} de ${product.name}.` : `Las variantes de ${product.name} ya estaban elegidas.`);
      setPickingProduct(false);
    } catch (error) {
      setAddNote(apiErrorInfo(error, "No se pudieron leer las variantes del producto.").message);
    } finally {
      setAdding(false);
    }
  };

  const body = (): PromotionBody => {
    const base = { name: name.trim(), type, channels, storeIds, startsAt: from ? isoFromLimaLocal(from) : null, endsAt: to ? isoFromLimaLocal(to) : null, combinable };
    if (type === "VOLUME")
      return { ...base, variantIds: skuIds, minQty: Number(minQty), maxQty: intOrNull(maxQty), packPrice: parseMoneyInput(packPrice) as number };
    const giftPart = { giftCondition: condition, giftVariantId: giftId as string, giftQuantity: Number(giftQty) };
    if (condition === "AMOUNT") return { ...base, ...giftPart, minAmount: parseMoneyInput(minAmount) as number };
    if (condition === "PRODUCT") return { ...base, ...giftPart, productId, minQty: Number(minQty) };
    return { ...base, ...giftPart, triggerVariantId: triggerId as string, minQty: Number(minQty) };
  };

  const save = async () => {
    setTried(true);
    setServerError(null);
    if (Object.keys(errors).length) return;
    setSaving(true);
    try {
      if (promo) {
        const { type: _type, ...patch } = body();
        void _type;
        await updatePromotion(promo.id, patch);
      } else {
        await createPromotion(body());
      }
      await queryClient.invalidateQueries({ queryKey: ["promotions"] });
      toast.success(promo ? `✓ Promoción «${name.trim()}» guardada` : `✓ Promoción «${name.trim()}» creada`);
      onClose();
    } catch (error) {
      setServerError(apiErrorInfo(error, "No se pudo guardar la promoción.").message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!promo) return;
    setSaving(true);
    try {
      await deletePromotion(promo.id);
      await queryClient.invalidateQueries({ queryKey: ["promotions"] });
      toast.success(`Promoción «${promo.name}» eliminada`);
      onClose();
    } catch (error) {
      toast.error(apiErrorInfo(error, "No se pudo eliminar la promoción.").message);
      setSaving(false);
    }
  };

  const err = (key: string) => (tried && errors[key] ? <p className="text-xs text-red-600">{errors[key]}</p> : null);
  const bad = (key: string) => cn(tried && errors[key] && "border-red-500");
  // Canales de la lista y, si la promo traía otro código, también ese (para poder quitarlo).
  const channelOptions = [
    ...VOLUME_GIFT_CHANNELS,
    ...channels.filter((code) => !VOLUME_GIFT_CHANNELS.some((channel) => channel.value === code)).map((code) => ({ value: code, label: channelLabel(code) })),
  ];
  const validMin = intOrNull(minQty);
  const priceLabel = `Precio por las ${validMin !== null && Number.isInteger(validMin) && validMin >= 2 ? validMin : "N"} unidades`;
  const priceStoreName = stores.find((store) => store.id === priceStore)?.name;
  const giftInfo = giftId ? info(giftId) : null;
  const triggerInfo = triggerId ? info(triggerId) : null;

  return (
    <>
      <Dialog open onOpenChange={(open) => { if (!open && !saving) onClose(); }}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{promo ? "Editar promoción" : "Nueva promoción"} · {type === "VOLUME" ? "Volumen" : "Regalo"}</DialogTitle>
            <DialogDescription>Se aplica sola al registrar la venta.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="promo-name">Nombre</Label>
              <Input id="promo-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={NAME_MAX} className={bad("name")} />
              {err("name")}
            </div>
            <Chips label="Tiendas" options={stores.map((store) => ({ value: store.id, label: store.name }))} value={storeIds} onChange={setStoreIds} hint={STORES_HINT} />
            <Chips label="Canales" options={channelOptions} value={channels} onChange={setChannels} hint={CHANNELS_HINT} />
            {/* FEAT-32 M7 (decisión de Octa): las promociones en Live quedan para después. */}
            {channels.includes(POWIP_LIVE_CHANNEL.value) ? (
              <p role="note" className="-mt-2 rounded-md bg-[#fff4dc] px-3 py-2 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
                {LIVE_NOT_YET}
              </p>
            ) : null}
            <div className="space-y-1.5">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="promo-from">Desde <span className="text-muted-foreground">(opcional)</span></Label>
                  <Input id="promo-from" type="datetime-local" value={from} onChange={(event) => setFrom(event.target.value)} className={bad("dates")} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="promo-to">Hasta <span className="text-muted-foreground">(opcional)</span></Label>
                  <Input id="promo-to" type="datetime-local" value={to} onChange={(event) => setTo(event.target.value)} className={bad("dates")} />
                </div>
              </div>
              {err("dates")}
              <p className="text-xs text-muted-foreground">Hora de Lima. Vacío = sin límite.</p>
            </div>

            {type === "VOLUME" ? (
              <div className="space-y-3 rounded-md border p-3">
                <div className="space-y-2">
                  <p className="text-sm font-medium">SKUs que cuentan para el volumen</p>
                  <VariantSearchPicker label="Buscar SKU" filter={notPack} excludeIds={skuIds} onSelect={(result) => addSku(result.variant_id, skuOf(result))} />
                  {pickingProduct ? (
                    <div className="space-y-1.5 rounded-md bg-muted/40 p-2">
                      <ProductPicker label="Producto" products={products} value="" disabled={adding} onChange={(product) => void addProductVariants(product)} />
                      {adding ? <p role="status" className="text-xs text-muted-foreground">Agregando variantes…</p> : null}
                      <Button type="button" size="sm" variant="ghost" onClick={() => setPickingProduct(false)} disabled={adding}>Cancelar</Button>
                    </div>
                  ) : (
                    <Button type="button" size="sm" variant="outline" onClick={() => { setPickingProduct(true); setAddNote(null); }}>Agregar las variantes de un producto…</Button>
                  )}
                  {addNote ? <p role="status" className="text-xs text-muted-foreground">{addNote}</p> : null}
                  {skuIds.length ? (
                    <ul className="max-h-48 divide-y overflow-y-auto rounded-md border" aria-label="SKUs elegidos">
                      {skuIds.map((id) => {
                        const data = info(id);
                        return (
                          <li key={id} className="flex items-center gap-2 px-3 py-1.5 text-sm">
                            <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{data?.sku || "SKU"}</span>
                            <span className="min-w-0 flex-1 truncate">{data?.label ?? (saved.isPending ? "Cargando…" : "Variante")}</span>
                            <Button type="button" size="icon" variant="ghost" className="h-7 w-7" aria-label={`Quitar ${data?.sku || data?.label || "SKU"}`} onClick={() => removeSku(id)}>
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p className="text-xs text-muted-foreground">Ningún SKU elegido.</p>
                  )}
                  {err("skus")}
                  <p className="text-xs text-muted-foreground">Se cuentan las unidades de estos SKUs en el pedido (pueden mezclarse tallas y colores).</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="promo-min">Cantidad mínima</Label>
                    <Input id="promo-min" type="number" min={2} value={minQty} onChange={(event) => setMinQty(event.target.value)} className={bad("min")} />
                    {err("min")}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="promo-max">Cantidad máxima <span className="text-muted-foreground">(opcional)</span></Label>
                    <Input id="promo-max" type="number" min={2} value={maxQty} onChange={(event) => setMaxQty(event.target.value)} className={bad("max")} />
                    {err("max")}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="promo-pack-price">{priceLabel}</Label>
                    <Input id="promo-pack-price" inputMode="decimal" value={packPrice} onChange={(event) => setPackPrice(event.target.value)} placeholder="S/" className={cn("text-right", bad("price"))} />
                    {err("price")}
                  </div>
                </div>
                <div className="grid gap-2 rounded-md bg-muted/50 p-3 text-sm sm:grid-cols-3" data-testid="volume-summary">
                  <div>
                    <small className="block text-xs text-muted-foreground">Precio normal</small>
                    <b className="tabular-nums">{prices.isFetching && !prices.data ? "…" : summary.normal}</b>
                  </div>
                  <div>
                    <small className="block text-xs text-muted-foreground">Precio con volumen</small>
                    <b className="tabular-nums">{summary.withVolume}</b>
                    {summary.unit ? <small className="block text-xs text-muted-foreground">{summary.unit}</small> : null}
                  </div>
                  <div>
                    <small className="block text-xs text-muted-foreground">Ahorro del cliente</small>
                    <b className="tabular-nums text-[#027778] dark:text-teal-300">{summary.savings}</b>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Precio normal: la cantidad mínima por el precio de {priceStoreName ? `la tienda ${priceStoreName}` : "la lista por defecto"}. El precio con volumen se reparte entre las unidades en la venta.
                </p>
                {prices.isError ? <p className="text-xs text-red-600">No se pudieron leer los precios de los SKUs.</p> : null}
                {summary.noSavings ? (
                  <p role="status" className="rounded-md bg-[#fff4dc] px-3 py-2 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">Con este precio el cliente no ahorra: el volumen no se aplicará.</p>
                ) : null}
                {summary.belowCost > 0 && summary.unitValue !== null ? (
                  <p role="status" className="rounded-md bg-[#fff4dc] px-3 py-2 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
                    Bajo el costo: {soles(summary.unitValue)} por unidad ({soles(summary.unitValue / IGV)} sin IGV) queda bajo el costo de {summary.belowCost === 1 ? "1 SKU" : `${summary.belowCost} SKUs`}. Se puede guardar igual.
                  </p>
                ) : null}
              </div>
            ) : (
              <div className="space-y-3 rounded-md border p-3">
                <div className="space-y-1.5">
                  <Label htmlFor="promo-condition">Condición</Label>
                  <select id="promo-condition" className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={condition} onChange={(event) => setCondition(event.target.value as GiftCondition)}>
                    {GIFT_CONDITIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </div>
                {condition === "AMOUNT" ? (
                  <div className="space-y-1.5">
                    <Label htmlFor="promo-min-amount">Compras desde (S/)</Label>
                    <Input id="promo-min-amount" inputMode="decimal" value={minAmount} onChange={(event) => setMinAmount(event.target.value)} placeholder="S/" className={cn("text-right", bad("minAmount"))} />
                    {err("minAmount")}
                    <p className="text-xs text-muted-foreground">Subtotal del pedido con IGV, después de otros descuentos y sin envío.</p>
                  </div>
                ) : (
                  <>
                    {condition === "PRODUCT" ? (
                      <ProductPicker label="Producto que hay que comprar" products={products} value={productId} onChange={(product) => setProductId(product.id)} />
                    ) : (
                      <div className="space-y-1">
                        {triggerInfo ? <p className="text-sm">Variante: <b>{triggerInfo.label}</b>{triggerInfo.sku ? <span className="ml-1 font-mono text-xs text-muted-foreground">{triggerInfo.sku}</span> : null}</p> : null}
                        <VariantSearchPicker
                          label="Variante que hay que comprar"
                          filter={() => true}
                          onSelect={(result) => {
                            setKnown((current) => ({ ...current, [result.variant_id]: skuOf(result) }));
                            setTriggerId(result.variant_id);
                          }}
                        />
                      </div>
                    )}
                    {err("trigger")}
                    <div className="space-y-1.5">
                      <Label htmlFor="promo-gift-min">Unidades mínimas compradas</Label>
                      <Input id="promo-gift-min" type="number" min={1} value={minQty} onChange={(event) => setMinQty(event.target.value)} className={bad("triggerQty")} />
                      {err("triggerQty")}
                    </div>
                  </>
                )}
                <div className="space-y-1.5">
                  {giftInfo || giftId ? (
                    <p className="text-sm">
                      Regalo: <b>{giftInfo?.label ?? "Cargando…"}</b>
                      {giftInfo?.sku ? <span className="ml-1 font-mono text-xs text-muted-foreground">{giftInfo.sku}</span> : null}
                    </p>
                  ) : null}
                  <VariantSearchPicker
                    label="SKU que se regala"
                    placeholder="Elige el SKU…"
                    onSelect={(result) => {
                      setKnown((current) => ({ ...current, [result.variant_id]: skuOf(result) }));
                      setGiftId(result.variant_id);
                    }}
                  />
                  {err("gift")}
                  {giftId ? (
                    giftStock.isPending ? (
                      <p role="status" className="text-xs text-muted-foreground">Leyendo el stock del regalo…</p>
                    ) : giftStock.isError ? (
                      <p className="text-xs text-muted-foreground">No se pudo leer el stock del regalo.</p>
                    ) : (giftStock.data ?? 0) > 0 ? (
                      <p className="rounded-md bg-[#e7f3f3] px-3 py-2 text-xs text-[#015d5e] dark:bg-teal-950/40 dark:text-teal-200">
                        El regalo tiene <b>{giftStock.data}</b> en stock. En la venta entra como línea a S/ 0 con su SKU, se reserva y se descuenta.
                      </p>
                    ) : (
                      <p role="status" className="rounded-md bg-[#fff4dc] px-3 py-2 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
                        El regalo tiene 0 en stock: no se ofrecerá hasta que haya
                      </p>
                    )
                  ) : null}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="promo-gift-qty">Unidades de regalo</Label>
                  <Input id="promo-gift-qty" type="number" min={1} max={1000} value={giftQty} onChange={(event) => setGiftQty(event.target.value)} className={bad("giftQty")} />
                  {err("giftQty")}
                </div>
                <p className="text-xs text-muted-foreground">El regalo es una línea a S/ 0 que reserva y descuenta su stock. Sin IMEI ni serie.</p>
              </div>
            )}

            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="accent-[#027778]" checked={combinable} onChange={(event) => setCombinable(event.target.checked)} />
              Se puede combinar con otras promociones
            </label>
            {serverError ? <p role="alert" className="text-sm text-red-600">{serverError}</p> : null}
          </div>
          <DialogFooter className="gap-2 sm:justify-between">
            {promo ? <Button type="button" variant="outline" className="border-red-300 text-red-700 hover:bg-red-50" disabled={saving} onClick={() => setConfirmDelete(true)}>Eliminar</Button> : <span />}
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
              <Button type="button" onClick={() => void save()} disabled={saving}>{saving ? "Guardando…" : "Guardar"}</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {promo ? <DeletePromotionDialog promo={confirmDelete ? promo : null} busy={saving} onCancel={() => setConfirmDelete(false)} onConfirm={() => void remove()} /> : null}
    </>
  );
}
