"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { isAxiosError } from "axios";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { soles } from "@/lib/packs/packMath";
import { apiErrorInfo } from "@/lib/catalog/catalogPayloads";
import { ORDER_CHANNELS, POWIP_PRICE_CHANNELS, channelLabel } from "@/lib/promotions/orderChannels";
import {
  CAMPAIGN_NAME_CHIPS,
  CAMPAIGN_NAME_MAX,
  DISCOUNT_OPTIONS,
  campaignPrice,
  discountLabel,
  discountProblem,
  isoFromLimaLocal,
  limaLocalFromIso,
  parseMoneyInput,
  type Discount,
  type DiscountKind,
} from "@/lib/promotions/campaign";
import {
  createPromotion,
  deletePromotion,
  getCampaignPrices,
  updatePromotion,
  type CampaignBody,
  type CampaignPriceProduct,
  type Promotion,
} from "@/services/promotionsService";

const IGV = 1.18;
const MAX_ROWS = 60;
/** Canales de una campaña: los de POWIP (sin Live) y los del pedido. */
export const CAMPAIGN_CHANNELS = [...POWIP_PRICE_CHANNELS, ...ORDER_CHANNELS].map((channel) => ({ value: channel.value as string, label: channel.label as string }));

export interface CampaignProductOption {
  id: string;
  name: string;
  sku?: string | null;
  companySku?: string | null;
}

type OwnMode = "gen" | DiscountKind;
interface OwnDraft {
  mode: OwnMode;
  value: string;
}

const manualKey = (productId: string, channel: string) => `${productId}|${channel}`;
const fold = (value: unknown) => String(value ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLocaleLowerCase("es");
const range = (values: number[]) => {
  if (!values.length) return "—";
  const min = Math.min(...values);
  const max = Math.max(...values);
  return min === max ? soles(min) : `${soles(min)}–${soles(max)}`;
};

/**
 * FEAT-32 M3 (spec §7.12) — ventana «Nueva promoción / Editar promoción» del precio de campaña: nombre (con
 * atajos), descuento general, desde y hasta con hora (Lima), tiendas, canales (sin POWIP Live), «Se puede
 * combinar» y la tabla producto × canal con el precio que queda (editable a mano: morado y «↺ Volver al
 * calculado»), «antes S/ X · −N%» y los avisos. El servidor vuelve a validar: el cruce (409) sale en ámbar.
 */
export function CampaignFormDialog({
  promo,
  stores,
  products,
  initialProductIds = [],
  onClose,
}: {
  promo: Promotion | null;
  stores: Array<{ id: string; name: string }>;
  products: CampaignProductOption[];
  initialProductIds?: string[];
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(promo?.name ?? "");
  const [discountType, setDiscountType] = useState<DiscountKind>(promo?.discountType ?? "PERCENT");
  const [discountText, setDiscountText] = useState(promo?.discountValue != null ? String(promo.discountValue) : "");
  const [from, setFrom] = useState(limaLocalFromIso(promo?.startsAt ?? null));
  const [to, setTo] = useState(limaLocalFromIso(promo?.endsAt ?? null));
  const [storeIds, setStoreIds] = useState<string[]>(promo?.storeIds ?? []);
  const [channels, setChannels] = useState<string[]>(promo?.channels ?? []);
  const [combinable, setCombinable] = useState(promo?.combinable ?? false);
  const [allProducts, setAllProducts] = useState(promo?.allProducts ?? false);
  const [own, setOwn] = useState<Record<string, OwnDraft>>(() => {
    const initial: Record<string, OwnDraft> = {};
    for (const product of promo?.products ?? [])
      initial[product.productId] = product.discountType ? { mode: product.discountType, value: String(product.discountValue ?? "") } : { mode: "gen", value: "" };
    if (!promo) for (const id of initialProductIds) initial[id] = { mode: "gen", value: "" };
    return initial;
  });
  const [manual, setManual] = useState<Record<string, string>>(() =>
    Object.fromEntries((promo?.manualPrices ?? []).map((row) => [manualKey(row.productId, row.channel), String(row.price)])),
  );
  const [query, setQuery] = useState("");
  const [previewStore, setPreviewStore] = useState(promo?.storeIds[0] ?? stores[0]?.id ?? "");
  const [tried, setTried] = useState(false);
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [crossing, setCrossing] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const general: Discount = { type: discountType, value: parseMoneyInput(discountText) };
  const generalText = discountLabel(general);
  const included = (productId: string) => allProducts || productId in own;
  const productName = (id: string) => products.find((product) => product.id === id)?.name ?? "Un producto";

  const visible = useMemo(() => {
    const q = fold(query.trim());
    const matches = products.filter((product) => !q || [product.name, product.sku, product.companySku].some((value) => fold(value).includes(q)));
    const sorted = allProducts ? matches : [...matches.filter((p) => p.id in own), ...matches.filter((p) => !(p.id in own))];
    return { rows: sorted.slice(0, MAX_ROWS), total: matches.length };
  }, [products, query, own, allProducts]);

  const priceIds = useMemo(() => visible.rows.filter((product) => included(product.id)).map((product) => product.id).sort(), [visible.rows, own, allProducts]); // eslint-disable-line react-hooks/exhaustive-deps
  const sortedChannels = useMemo(() => [...channels].sort(), [channels]);
  const prices = useQuery({
    queryKey: ["campaign-prices", previewStore, sortedChannels.join(","), priceIds.join(",")],
    queryFn: ({ signal }) => getCampaignPrices({ storeId: previewStore || undefined, channels: sortedChannels, productIds: priceIds }, signal),
    enabled: sortedChannels.length > 0 && priceIds.length > 0,
    retry: false,
    placeholderData: (previous) => previous,
    staleTime: 30_000,
  });
  const priceBy = useMemo(() => new Map((prices.data?.products ?? []).map((product) => [product.productId, product])), [prices.data]);

  // Con «Todos los productos» no hay descuento propio (spec §5.6: promo_products queda vacía); sí precios a mano.
  const ownDiscount = (productId: string): Discount | null => {
    if (allProducts) return null;
    const draft = own[productId];
    return draft && draft.mode !== "gen" ? { type: draft.mode, value: parseMoneyInput(draft.value) } : null;
  };

  /** Precio que queda en un canal, por variante, sin y con el precio a mano. */
  const cell = (product: CampaignPriceProduct, channel: string) => {
    const bases = product.variants.map((variant) => variant.channels[channel] ?? variant.storePrice);
    const manualText = manual[manualKey(product.productId, channel)];
    const manualValue = manualText !== undefined ? parseMoneyInput(manualText) : null;
    const mine = ownDiscount(product.productId);
    const usable = !discountProblem(mine ?? general);
    const computed = usable ? bases.map((base) => campaignPrice({ base, general, own: mine })) : [];
    const finals = manualValue !== null && Number.isFinite(manualValue) ? bases.map(() => manualValue) : computed;
    const costs = product.variants.map((variant) => variant.averageCost);
    const lowCost = finals.some((price, index) => costs[index] !== null && price / IGV < (costs[index] as number));
    return { bases, computed, finals, manualText, manualValue, lowCost, inactive: product.inactiveChannels.includes(channel) };
  };

  const errors = useMemo(() => {
    const list: Record<string, string> = {};
    if (!name.trim()) list.name = "Escribe el nombre de la promoción.";
    else if (name.trim().length > CAMPAIGN_NAME_MAX) list.name = `Hasta ${CAMPAIGN_NAME_MAX} caracteres.`;
    const discount = discountProblem(general);
    if (discount) list.discount = discount;
    const starts = isoFromLimaLocal(from);
    const ends = isoFromLimaLocal(to);
    if (!starts || !ends) list.dates = "Elige la fecha y hora de inicio y de fin.";
    else if (Date.parse(ends) <= Date.parse(starts)) list.dates = "El fin tiene que ser después del inicio.";
    if (!channels.length) list.channels = "Elige al menos un canal.";
    if (!allProducts && !Object.keys(own).length) list.products = "Elige al menos un producto o «Todos los productos».";
    const rows: string[] = [];
    for (const [productId, draft] of allProducts ? [] : Object.entries(own)) {
      if (draft.mode === "gen") continue;
      const problem = discountProblem({ type: draft.mode, value: parseMoneyInput(draft.value) });
      if (problem) rows.push(`${productName(productId)}: ${problem}`);
    }
    for (const [key, text] of Object.entries(manual)) {
      const [productId, channel] = key.split("|");
      if (!channels.includes(channel) || !included(productId)) continue;
      const value = parseMoneyInput(text);
      if (value === null || !Number.isFinite(value) || value <= 0) rows.push(`${productName(productId)} en ${channelLabel(channel)}: el precio tiene que ser mayor a 0.`);
    }
    if (!list.discount)
      for (const product of prices.data?.products ?? []) {
        if (!included(product.productId)) continue;
        for (const channel of channels) {
          const value = cell(product, channel);
          if (value.manualValue === null && value.computed.some((price) => price <= 0)) rows.push(`${product.name} en ${channelLabel(channel)}: queda en S/ 0 o menos.`);
        }
      }
    if (rows.length) list.rows = `Revisa: ${rows.slice(0, 3).join(" · ")}${rows.length > 3 ? ` (y ${rows.length - 3} más)` : ""}`;
    return list;
  }, [name, discountText, discountType, from, to, channels, allProducts, own, manual, prices.data]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleChannel = (value: string) => setChannels((current) => (current.includes(value) ? current.filter((c) => c !== value) : [...current, value]));
  const toggleStore = (value: string) => setStoreIds((current) => (current.includes(value) ? current.filter((s) => s !== value) : [...current, value]));
  const toggleProduct = (id: string) =>
    setOwn((current) => {
      if (id in current) {
        const { [id]: _removed, ...rest } = current;
        void _removed;
        return rest;
      }
      return { ...current, [id]: { mode: "gen", value: "" } };
    });

  const body = (): CampaignBody => ({
    name: name.trim(),
    type: "CAMPAIGN",
    channels,
    storeIds,
    startsAt: isoFromLimaLocal(from) as string,
    endsAt: isoFromLimaLocal(to) as string,
    discountType,
    discountValue: parseMoneyInput(discountText) as number,
    allProducts,
    products: allProducts
      ? []
      : Object.entries(own).map(([productId, draft]) =>
          draft.mode === "gen" ? { productId } : { productId, discountType: draft.mode, discountValue: parseMoneyInput(draft.value) as number },
        ),
    manualPrices: Object.entries(manual)
      .map(([key, text]) => {
        const [productId, channel] = key.split("|");
        return { productId, channel, price: parseMoneyInput(text) as number };
      })
      .filter((row) => channels.includes(row.channel) && included(row.productId)),
    combinable,
  });

  const save = async () => {
    setTried(true);
    setServerError(null);
    setCrossing(null);
    if (Object.keys(errors).length) return;
    setSaving(true);
    try {
      if (promo) {
        const { type: _type, ...patch } = body();
        void _type;
        await updatePromotion(promo.id, patch);
      } else await createPromotion(body());
      await queryClient.invalidateQueries({ queryKey: ["promotions"] });
      toast.success(promo ? `✓ Promoción «${name.trim()}» guardada` : `✓ Promoción «${name.trim()}» creada`);
      onClose();
    } catch (error) {
      const message = apiErrorInfo(error, "No se pudo guardar la promoción.").message;
      if (isAxiosError(error) && error.response?.status === 409) setCrossing(message);
      else setServerError(message);
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
  const discountField = DISCOUNT_OPTIONS.find((option) => option.value === discountType)?.field ?? "Valor";

  return (
    <>
      <Dialog open onOpenChange={(next) => { if (!next && !saving) onClose(); }}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-6xl">
          <DialogHeader>
            <DialogTitle>{promo ? "Editar promoción" : "Nueva promoción"}</DialogTitle>
            <DialogDescription>Precio de campaña con sus propias fechas, canales y productos.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="campaign-name">Nombre</Label>
              <Input id="campaign-name" value={name} maxLength={CAMPAIGN_NAME_MAX} placeholder="Ej.: Cyber Wow" onChange={(event) => setName(event.target.value)} className={cn(tried && errors.name && "border-red-500")} />
              {err("name")}
              <div className="flex flex-wrap gap-1.5">
                {CAMPAIGN_NAME_CHIPS.map((chip) => (
                  <button key={chip} type="button" className="rounded-full border px-2.5 py-0.5 text-xs hover:bg-muted" onClick={() => setName(chip)}>{chip}</button>
                ))}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-4">
              <div className="space-y-1.5">
                <Label htmlFor="campaign-discount-type">Tipo de descuento</Label>
                <select id="campaign-discount-type" className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={discountType} onChange={(event) => setDiscountType(event.target.value as DiscountKind)}>
                  {DISCOUNT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="campaign-discount-value">{discountField}</Label>
                <Input id="campaign-discount-value" inputMode="decimal" placeholder="0" value={discountText} onChange={(event) => setDiscountText(event.target.value)} className={cn("text-right", tried && errors.discount && "border-red-500")} />
                {err("discount")}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="campaign-from">Desde</Label>
                <Input id="campaign-from" type="datetime-local" value={from} onChange={(event) => setFrom(event.target.value)} className={cn(tried && errors.dates && "border-red-500")} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="campaign-to">Hasta</Label>
                <Input id="campaign-to" type="datetime-local" value={to} onChange={(event) => setTo(event.target.value)} className={cn(tried && errors.dates && "border-red-500")} />
              </div>
            </div>
            {err("dates")}
            <p className="text-xs text-muted-foreground">Hora de Lima. La promoción empieza y termina sola.</p>

            {stores.length > 1 ? (
              <div className="space-y-1.5" role="group" aria-label="Tiendas">
                <Label>Tiendas</Label>
                <div className="flex flex-wrap gap-1.5">
                  {stores.map((store) => (
                    <button key={store.id} type="button" aria-pressed={storeIds.includes(store.id)} onClick={() => toggleStore(store.id)} className={cn("rounded-full border px-3 py-1 text-sm", storeIds.includes(store.id) ? "border-[#027778] bg-[#e7f3f3] text-[#015d5e]" : "hover:bg-muted")}>
                      {store.name}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">Sin elegir = todas las tiendas.</p>
              </div>
            ) : null}

            <div className="space-y-1.5" role="group" aria-label="Canales">
              <Label>Canales</Label>
              <div className="grid gap-1.5 sm:grid-cols-3 lg:grid-cols-4">
                {CAMPAIGN_CHANNELS.map((channel) => (
                  <label key={channel.value} className="flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm">
                    <input type="checkbox" className="accent-[#027778]" checked={channels.includes(channel.value)} onChange={() => toggleChannel(channel.value)} />
                    {channel.label}
                  </label>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">POWIP Live no entra: ya tiene su precio live.</p>
              {err("channels")}
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="accent-[#027778]" checked={combinable} onChange={(event) => setCombinable(event.target.checked)} />
              Se puede combinar con otras promociones
            </label>

            <div className="space-y-2">
              <Label>Productos y precio con la promoción ({allProducts ? products.length : Object.keys(own).length})</Label>
              <div className="flex flex-wrap gap-4 text-sm">
                <label className="flex items-center gap-2"><input type="radio" name="campaign-scope" checked={!allProducts} onChange={() => setAllProducts(false)} /> Elegir productos</label>
                <label className="flex items-center gap-2"><input type="radio" name="campaign-scope" checked={allProducts} onChange={() => setAllProducts(true)} /> Todos los productos ({products.length}, incluye los que crees después)</label>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Input aria-label="Buscar producto" placeholder="Buscar por nombre o SKU" value={query} onChange={(event) => setQuery(event.target.value)} className="min-w-[200px] flex-1" />
                {!allProducts ? (
                  <>
                    <Button type="button" size="sm" variant="outline" onClick={() => setOwn((current) => ({ ...Object.fromEntries(visible.rows.map((p) => [p.id, { mode: "gen" as OwnMode, value: "" }])), ...current }))}>✓ Marcar todos los que ves</Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => setOwn({})}>Quitar todos</Button>
                  </>
                ) : null}
                {stores.length > 1 ? (
                  <label className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground">Ver precios de</span>
                    <select aria-label="Ver precios de" className="h-9 rounded-md border bg-background px-2 text-sm" value={previewStore} onChange={(event) => setPreviewStore(event.target.value)}>
                      {stores.map((store) => <option key={store.id} value={store.id}>{store.name}</option>)}
                    </select>
                  </label>
                ) : null}
              </div>
              <div className="max-h-[420px] overflow-auto rounded-md border">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 z-10 bg-muted text-left text-xs text-muted-foreground">
                    <tr>
                      <th className="w-9 px-2 py-2" />
                      <th className="px-2 py-2">Producto</th>
                      <th className="px-2 py-2">Descuento</th>
                      {channels.map((channel) => <th key={channel} className="px-2 py-2">{channelLabel(channel)}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {visible.rows.map((product) => {
                      const on = included(product.id);
                      const data = priceBy.get(product.id);
                      const sku = product.companySku || product.sku || data?.sku || "";
                      const storePrices = data?.variants.map((variant) => variant.storePrice) ?? [];
                      const costs = (data?.variants.map((variant) => variant.averageCost).filter((cost) => cost !== null) ?? []) as number[];
                      const checkbox = (
                        <td className="px-2 py-2 align-top">
                          <input type="checkbox" aria-label={`Incluir ${product.name}`} checked={on} disabled={allProducts} onChange={() => toggleProduct(product.id)} />
                        </td>
                      );
                      const info = (
                        <td className="min-w-[220px] px-2 py-2 align-top">
                          <b className="font-medium">{product.name}</b>
                          <small className="block text-xs text-muted-foreground">
                            {[sku, storePrices.length ? `tienda ${range(storePrices)}` : "", costs.length ? `costo ${range(costs)}` : ""].filter(Boolean).join(" · ")}
                          </small>
                        </td>
                      );
                      if (!on)
                        return (
                          <tr key={product.id} className="border-t opacity-55" data-testid={`campaign-row-${product.id}`}>
                            {checkbox}
                            {info}
                            <td colSpan={1 + channels.length} className="px-2 py-2 text-xs text-muted-foreground">No entra en la promoción</td>
                          </tr>
                        );
                      const draft = own[product.id] ?? { mode: "gen" as OwnMode, value: "" };
                      return (
                        <tr key={product.id} className="border-t" data-testid={`campaign-row-${product.id}`}>
                          {checkbox}
                          {info}
                          <td className="min-w-[180px] px-2 py-2 align-top">
                            {allProducts ? (
                              <span className="text-xs text-muted-foreground">General ({generalText})</span>
                            ) : (
                            <>
                            <select
                              aria-label={`Descuento de ${product.name}`}
                              className="h-8 w-full rounded-md border bg-background px-2 text-xs"
                              value={draft.mode}
                              onChange={(event) => setOwn((current) => ({ ...current, [product.id]: { mode: event.target.value as OwnMode, value: current[product.id]?.value ?? "" } }))}
                            >
                              <option value="gen">General ({generalText})</option>
                              <option value="PERCENT">% propio</option>
                              <option value="AMOUNT">S/ de descuento propio</option>
                              <option value="FINAL">Precio final propio</option>
                            </select>
                            {draft.mode !== "gen" ? (
                              <Input
                                aria-label={`Valor del descuento de ${product.name}`}
                                inputMode="decimal"
                                placeholder={draft.mode === "PERCENT" ? "%" : "S/"}
                                className="mt-1.5 h-8 text-right text-xs"
                                value={draft.value}
                                onChange={(event) => setOwn((current) => ({ ...current, [product.id]: { mode: draft.mode, value: event.target.value } }))}
                              />
                            ) : null}
                            </>
                            )}
                          </td>
                          {channels.map((channel) => {
                            if (!data)
                              return <td key={channel} className="px-2 py-2 align-top text-xs text-muted-foreground">{prices.isFetching ? "Cargando…" : "—"}</td>;
                            const value = cell(data, channel);
                            const shown = value.finals.length ? Math.min(...value.finals) : null;
                            const base = Math.min(...value.bases);
                            const pct = shown !== null && base > 0 && shown > 0 ? Math.round((1 - shown / base) * 100) : null;
                            const isManual = value.manualText !== undefined;
                            const key = manualKey(product.id, channel);
                            const warning = value.inactive
                              ? <small className="block text-[11px] text-muted-foreground">No activado: no se verá</small>
                              : value.manualValue === null && value.computed.some((price) => price <= 0)
                                ? <small className="block text-[11px] text-red-600">Queda en S/ 0 o menos</small>
                                : value.lowCost
                                  ? <small className="block text-[11px] text-amber-700 dark:text-amber-300">Bajo el costo</small>
                                  : null;
                            return (
                              <td key={channel} className="min-w-[130px] px-2 py-2 align-top" data-testid={`campaign-cell-${product.id}-${channel}`}>
                                <Input
                                  aria-label={`Precio con promoción de ${product.name} en ${channelLabel(channel)}`}
                                  inputMode="decimal"
                                  placeholder="—"
                                  className={cn("h-8 text-right text-xs", isManual && "border-[#4C2FB5] bg-[#efecfb] dark:bg-violet-950/40")}
                                  value={isManual ? value.manualText : shown !== null ? shown.toFixed(2) : ""}
                                  onChange={(event) => setManual((current) => ({ ...current, [key]: event.target.value }))}
                                />
                                <small className="block text-[11px] text-muted-foreground">antes {range(value.bases)}{pct !== null && pct > 0 ? ` · −${pct}%` : ""}</small>
                                {isManual ? (
                                  <button
                                    type="button"
                                    className="text-[11px] font-semibold text-[#4C2FB5] hover:underline dark:text-violet-300"
                                    onClick={() => setManual((current) => {
                                      const { [key]: _removed, ...rest } = current;
                                      void _removed;
                                      return rest;
                                    })}
                                  >
                                    ↺ Volver al calculado
                                  </button>
                                ) : null}
                                {warning}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                    {visible.rows.length === 0 ? (
                      <tr><td colSpan={3 + channels.length} className="px-2 py-6 text-center text-xs text-muted-foreground">Sin resultados.</td></tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
              {visible.total > visible.rows.length ? <p className="text-xs text-muted-foreground">Mostrando {visible.rows.length} de {visible.total}. Busca para ver otros.</p> : null}
              {prices.data?.fallback ? <p className="text-xs text-amber-700 dark:text-amber-300">No se pudieron leer las listas de precios: se muestran los precios base.</p> : null}
              {prices.isError ? <p className="text-xs text-red-600">No se pudieron cargar los precios de los canales.</p> : null}
              <p className="text-xs text-muted-foreground">Cada producto usa el descuento general o uno propio. El precio de cada canal se puede editar a mano: queda en morado y se puede volver al calculado.</p>
              {err("products")}
              {tried && errors.rows ? <p className="text-xs text-red-600">{errors.rows}</p> : null}
            </div>

            {crossing ? (
              <div role="alert" className="rounded-xl bg-[#fff4dc] px-4 py-3 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">{crossing}</div>
            ) : null}
            {serverError ? <p role="alert" className="text-sm text-red-600">{serverError}</p> : null}
          </div>

          <DialogFooter className="gap-2 sm:justify-between">
            {promo ? <Button variant="outline" className="border-red-300 text-red-700 hover:bg-red-50" disabled={saving} onClick={() => setConfirmDelete(true)}>Eliminar</Button> : <span />}
            <div className="flex gap-2">
              <Button variant="outline" disabled={saving} onClick={onClose}>Cancelar</Button>
              <Button disabled={saving} onClick={() => void save()}>{saving ? "Guardando…" : promo ? "Guardar cambios" : "Crear promoción"}</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {promo ? (
        <DeletePromotionDialog promo={confirmDelete ? promo : null} busy={saving} onCancel={() => setConfirmDelete(false)} onConfirm={() => void remove()} />
      ) : null}
    </>
  );
}

/** Confirmación al eliminar (spec §7.12): si está activa, avisa que los precios vuelven al normal. */
export function DeletePromotionDialog({
  promo,
  busy,
  onCancel,
  onConfirm,
}: {
  promo: Promotion | null;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog open={!!promo} onOpenChange={(next) => { if (!next && !busy) onCancel(); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Eliminar «{promo?.name}»</AlertDialogTitle>
          <AlertDialogDescription>
            {promo?.status === "ACTIVE"
              ? "La promoción está activa: los precios vuelven al normal en todos sus canales al eliminarla. Esta acción no se puede deshacer."
              : "Esta acción no se puede deshacer."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            className="bg-red-600 text-white hover:bg-red-700"
            disabled={busy}
            onClick={(event) => {
              event.preventDefault();
              onConfirm();
            }}
          >
            Eliminar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
