"use client";

import { useId, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { VariantSearchPicker, searchResultLabel } from "@/components/variant-search/VariantSearchPicker";
import {
  createPromotion,
  updatePromotion,
  type GiftCondition,
  type PromoKind,
  type Promotion,
  type PromotionBody,
} from "@/services/promotionsService";
import type { PurchasableProduct } from "@/services/purchasesService";
import { apiErrorInfo } from "@/lib/catalog/catalogPayloads";
import { ORDER_CHANNELS } from "@/lib/promotions/orderChannels";
import { endsAtFromDate, lastDayFromEndsAt, limaDate, startsAtFromDate } from "@/lib/promotions/promoRules";

interface Store {
  id: string;
  name: string;
}

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
              className={cn("rounded-full border px-3 py-1 text-xs font-medium", on ? "border-primary bg-primary/10 text-primary" : "bg-background text-muted-foreground hover:bg-muted")}
            >
              {option.label}
            </button>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">{value.length === 0 ? hint : `${value.length} elegido(s)`}</p>
    </fieldset>
  );
}

function ProductPicker({ label, products, value, onChange }: { label: string; products: PurchasableProduct[]; value: string; onChange: (id: string) => void }) {
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
      <Input id={id} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Busca por nombre o SKU" autoComplete="off" />
      {matches.length > 0 ? (
        <ul className="max-h-40 overflow-y-auto rounded-md border" aria-label={`Resultados de ${label}`}>
          {matches.map((product) => (
            <li key={product.id}>
              <button type="button" className="w-full px-3 py-2 text-left text-sm hover:bg-muted" onClick={() => { onChange(product.id); setQuery(""); }}>
                {product.name} <span className="font-mono text-xs text-muted-foreground">{product.companySku ?? product.sku}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

const intOrNull = (text: string) => (text.trim() === "" ? null : Number(text));

/**
 * FEAT-24 H9 (H9-D5) — alta y edición de una promoción (mockup `mPromo`): tiendas, canales reales del
 * pedido, vigencia y la regla de Volumen o de Regalo. Vacío en tiendas o canales = todas/todos.
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
  const queryClient = useQueryClient();
  const [name, setName] = useState(promo?.name ?? "");
  const [type, setType] = useState<PromoKind>(promo?.type ?? initialType ?? "VOLUME");
  const [storeIds, setStoreIds] = useState<string[]>(promo?.storeIds ?? []);
  const [channels, setChannels] = useState<string[]>(promo?.channels ?? []);
  const [from, setFrom] = useState(promo?.startsAt ? limaDate(promo.startsAt) : "");
  const [to, setTo] = useState(lastDayFromEndsAt(promo?.endsAt ?? null));
  const [productId, setProductId] = useState(promo?.productId ?? "");
  const [minQty, setMinQty] = useState(promo?.minQty ? String(promo.minQty) : type === "VOLUME" ? "3" : "1");
  const [maxQty, setMaxQty] = useState(promo?.maxQty ? String(promo.maxQty) : "");
  const [packPrice, setPackPrice] = useState(promo?.packPrice !== null && promo?.packPrice !== undefined ? String(promo.packPrice) : "");
  const [condition, setCondition] = useState<GiftCondition>(promo?.giftCondition ?? "AMOUNT");
  const [minAmount, setMinAmount] = useState(promo?.minAmount ? String(promo.minAmount) : "");
  const [trigger, setTrigger] = useState<{ id: string; label: string } | null>(
    promo?.triggerVariantId ? { id: promo.triggerVariantId, label: variantNames.get(promo.triggerVariantId) ?? "Variante" } : null,
  );
  const [gift, setGift] = useState<{ id: string; label: string } | null>(
    promo?.giftVariantId ? { id: promo.giftVariantId, label: variantNames.get(promo.giftVariantId) ?? "Variante" } : null,
  );
  const [giftQty, setGiftQty] = useState(promo?.giftQuantity ? String(promo.giftQuantity) : "1");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const build = (): PromotionBody | string => {
    const cleanName = name.trim();
    if (!cleanName || cleanName.length > 150) return "Escribe el nombre (hasta 150 caracteres).";
    const startsAt = from ? startsAtFromDate(from) : null;
    const endsAt = to ? endsAtFromDate(to) : null;
    if (startsAt && endsAt && Date.parse(endsAt) <= Date.parse(startsAt)) return "La fecha «hasta» tiene que ser igual o posterior a «desde».";
    const base = { name: cleanName, type, channels, storeIds, startsAt, endsAt };
    if (type === "VOLUME") {
      const min = intOrNull(minQty);
      const max = intOrNull(maxQty);
      const price = Number(packPrice.replace(",", "."));
      if (!productId) return "Elige el producto de la promoción.";
      if (min === null || !Number.isInteger(min) || min < 2) return "La cantidad mínima es un entero desde 2.";
      if (max !== null && (!Number.isInteger(max) || max < min)) return "La cantidad máxima tiene que ser mayor o igual a la mínima.";
      if (!Number.isFinite(price) || price <= 0) return "Escribe el precio del pack.";
      return { ...base, productId, minQty: min, ...(max !== null ? { maxQty: max } : {}), packPrice: Math.round(price * 100) / 100 };
    }
    const quantity = intOrNull(giftQty);
    if (!gift) return "Elige el producto que se regala.";
    if (quantity === null || !Number.isInteger(quantity) || quantity < 1 || quantity > 1000) return "Las unidades de regalo van de 1 a 1000.";
    const giftPart = { giftCondition: condition, giftVariantId: gift.id, giftQuantity: quantity };
    if (condition === "AMOUNT") {
      const amount = Number(minAmount.replace(",", "."));
      if (!Number.isFinite(amount) || amount < 0.01) return "Escribe el monto mínimo de la compra.";
      return { ...base, ...giftPart, minAmount: Math.round(amount * 100) / 100 };
    }
    const min = intOrNull(minQty) ?? 1;
    if (!Number.isInteger(min) || min < 1) return "La cantidad mínima es un entero desde 1.";
    if (condition === "PRODUCT") {
      if (!productId) return "Elige el producto que hay que comprar.";
      return { ...base, ...giftPart, productId, minQty: min };
    }
    if (!trigger) return "Elige la variante que hay que comprar.";
    return { ...base, ...giftPart, triggerVariantId: trigger.id, minQty: min };
  };

  const save = async () => {
    const body = build();
    if (typeof body === "string") {
      setError(body);
      return;
    }
    setError("");
    setSaving(true);
    try {
      if (promo) {
        const { type: _type, ...patch } = body;
        void _type;
        await updatePromotion(promo.id, patch);
      } else {
        await createPromotion(body);
      }
      await queryClient.invalidateQueries({ queryKey: ["promotions"] });
      toast.success(promo ? "Promoción actualizada" : "Promoción creada");
      onClose();
    } catch (cause) {
      setError(apiErrorInfo(cause, "No se pudo guardar la promoción.").message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && !saving && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{promo ? "Editar promoción" : "Nueva promoción"}</DialogTitle>
          <DialogDescription>Regla de precio que se aplica sola al registrar la venta.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="promo-name">Nombre</Label>
            <Input id="promo-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={150} />
          </div>
          <fieldset className="space-y-1.5">
            <legend className="text-sm font-medium">Tipo</legend>
            <div className="flex gap-2">
              {([["VOLUME", "Volumen"], ["GIFT", "Regalo"]] as const).map(([value, label]) => (
                <label key={value} className={cn("flex items-center gap-2 rounded-md border px-3 py-2 text-sm", promo && "opacity-70")}>
                  <input type="radio" name="promo-type" value={value} checked={type === value} disabled={!!promo} onChange={() => { setType(value); setMinQty(value === "VOLUME" ? "3" : "1"); }} />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>
          <Chips label="Tiendas" options={stores.map((store) => ({ value: store.id, label: store.name }))} value={storeIds} onChange={setStoreIds} hint="Sin elegir = todas las tiendas." />
          <Chips label="Canales" options={ORDER_CHANNELS.map((channel) => ({ value: channel.value, label: channel.label }))} value={channels} onChange={setChannels} hint="Sin elegir = todos los canales." />
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="promo-from">Desde <span className="text-muted-foreground">(opcional)</span></Label>
              <Input id="promo-from" type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="promo-to">Hasta, incluido <span className="text-muted-foreground">(opcional)</span></Label>
              <Input id="promo-to" type="date" value={to} onChange={(event) => setTo(event.target.value)} />
            </div>
          </div>

          {type === "VOLUME" ? (
            <div className="space-y-3 rounded-md border p-3">
              <ProductPicker label="Producto" products={products} value={productId} onChange={setProductId} />
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label htmlFor="promo-min">Cantidad mínima</Label>
                  <Input id="promo-min" type="number" min={2} value={minQty} onChange={(event) => setMinQty(event.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="promo-max">Cantidad máxima <span className="text-muted-foreground">(opcional)</span></Label>
                  <Input id="promo-max" type="number" min={2} value={maxQty} onChange={(event) => setMaxQty(event.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="promo-pack-price">Precio del pack</Label>
                  <Input id="promo-pack-price" inputMode="decimal" value={packPrice} onChange={(event) => setPackPrice(event.target.value)} placeholder="S/" />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">Ej.: lleva 3 y paga S/ 90 por las 3. El precio se reparte entre las unidades en la venta.</p>
            </div>
          ) : (
            <div className="space-y-3 rounded-md border p-3">
              <div className="space-y-1.5">
                <Label htmlFor="promo-condition">Condición</Label>
                <select id="promo-condition" className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={condition} onChange={(event) => setCondition(event.target.value as GiftCondition)}>
                  <option value="AMOUNT">Compra desde un monto</option>
                  <option value="PRODUCT">Compra de un producto</option>
                  <option value="VARIANT">Compra de una variante</option>
                </select>
              </div>
              {condition === "AMOUNT" ? (
                <div className="space-y-1.5">
                  <Label htmlFor="promo-min-amount">Monto mínimo (sin envío ni regalos)</Label>
                  <Input id="promo-min-amount" inputMode="decimal" value={minAmount} onChange={(event) => setMinAmount(event.target.value)} placeholder="S/" />
                </div>
              ) : (
                <>
                  {condition === "PRODUCT" ? (
                    <ProductPicker label="Producto que hay que comprar" products={products} value={productId} onChange={setProductId} />
                  ) : (
                    <div className="space-y-1">
                      {trigger ? <p className="text-sm">Variante: <b>{trigger.label}</b></p> : null}
                      <VariantSearchPicker label="Variante que hay que comprar" filter={() => true} onSelect={(result) => setTrigger({ id: result.variant_id, label: searchResultLabel(result) })} />
                    </div>
                  )}
                  <div className="space-y-1.5">
                    <Label htmlFor="promo-gift-min">Unidades mínimas compradas</Label>
                    <Input id="promo-gift-min" type="number" min={1} value={minQty} onChange={(event) => setMinQty(event.target.value)} />
                  </div>
                </>
              )}
              <div className="space-y-1">
                {gift ? <p className="text-sm">Regalo: <b>{gift.label}</b></p> : null}
                <VariantSearchPicker label="Producto que se regala" onSelect={(result) => setGift({ id: result.variant_id, label: searchResultLabel(result) })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="promo-gift-qty">Unidades de regalo</Label>
                <Input id="promo-gift-qty" type="number" min={1} max={1000} value={giftQty} onChange={(event) => setGiftQty(event.target.value)} />
              </div>
              <p className="text-xs text-muted-foreground">El regalo es una línea a S/ 0 que reserva y descuenta su stock. Sin IMEI ni serie.</p>
            </div>
          )}
          {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button type="button" onClick={() => void save()} disabled={saving}>{saving ? "Guardando…" : "Guardar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
