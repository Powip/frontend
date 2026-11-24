"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  applyRule,
  belowCost,
  parseRuleValue,
  priceRange,
  rulePricesProblem,
  type PriceRule,
  type RuleMode,
  type RuleUnit,
} from "@/lib/catalog/productChannels";

export interface PriceDialogVariant {
  storePrice: number;
  /** Precio propio en la lista del canal: la regla no lo cambia. */
  own: boolean;
  averageCost?: number | null;
}

const OPTIONS: Array<{ mode: RuleMode; title: string; hint: (store: string) => string }> = [
  { mode: "same", title: "Igual al precio de tienda", hint: (store) => store },
  { mode: "more", title: "Más caro", hint: () => "Para cubrir comisión o envío del canal" },
  { mode: "less", title: "Más barato", hint: () => "Para competir en ese canal" },
  { mode: "fixed", title: "Precio fijo", hint: () => "No cambia aunque cambie el precio de tienda" },
];

/**
 * FEAT-32 M2 (spec §7.8) — ventana «Activar en [canal]» / «Precio en [canal]»: igual, más caro o más barato (en %
 * o S/) o precio fijo; muestra el precio que queda, avisa si queda bajo el costo (sin IGV) y valida como el servidor.
 */
export default function ChannelPriceDialog({
  open,
  activating,
  channelName,
  productName,
  initialRule,
  variants,
  igvIncluded,
  saving,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  activating: boolean;
  channelName: string;
  productName: string;
  initialRule: PriceRule;
  variants: PriceDialogVariant[];
  igvIncluded: boolean;
  saving: boolean;
  onCancel: () => void;
  onConfirm: (rule: PriceRule) => void;
}) {
  const [mode, setMode] = useState<RuleMode>(initialRule.mode);
  const [unit, setUnit] = useState<RuleUnit>(initialRule.unit ?? "percent");
  const [valueText, setValueText] = useState(initialRule.value ? String(initialRule.value) : "");

  const value = parseRuleValue(valueText);
  const rule: PriceRule =
    mode === "same" ? { mode, unit: null, value: null } : mode === "fixed" ? { mode, unit: null, value } : { mode, unit, value };
  const affected = variants.filter((variant) => !variant.own);
  const storePrices = variants.map((variant) => variant.storePrice);
  const error = rulePricesProblem(rule, affected.map((variant) => variant.storePrice));
  const resulting = affected.map((variant) => applyRule(variant.storePrice, rule));
  const lowCost = !error
    ? affected
        .map((variant) => ({ cost: variant.averageCost ?? null, price: applyRule(variant.storePrice, rule) }))
        .filter((row) => belowCost(row.price, row.cost, igvIncluded))
    : [];
  const ownCount = variants.length - affected.length;

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next && !saving) onCancel(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{activating ? `Activar en ${channelName}` : `Precio en ${channelName}`}</DialogTitle>
          <DialogDescription>{productName} · precio de tienda {priceRange(storePrices)}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2.5">
          {variants.length > 1 ? (
            <p className="text-xs text-muted-foreground">
              Se aplica a las {variants.length} variantes. Una variante con precio propio en Listas de precios no cambia
              {ownCount ? ` (${ownCount} con precio propio)` : ""}.
            </p>
          ) : null}
          <div role="radiogroup" aria-label="Cómo se calcula el precio del canal" className="space-y-2">
            {OPTIONS.map((option) => {
              const checked = mode === option.mode;
              return (
                <label
                  key={option.mode}
                  className={cn(
                    "flex cursor-pointer gap-2.5 rounded-lg border p-2.5 text-sm",
                    checked ? "border-[#027778] bg-[#e7f3f3] dark:bg-teal-950/40" : "hover:bg-muted/50",
                  )}
                >
                  <input type="radio" name="channel-rule" className="mt-1 accent-[#027778]" checked={checked} onChange={() => setMode(option.mode)} />
                  <span className="flex-1">
                    <b className="block">{option.title}</b>
                    <small className="text-muted-foreground">{option.hint(priceRange(storePrices))}</small>
                    {checked && (option.mode === "more" || option.mode === "less") ? (
                      <span className="mt-2 flex gap-2">
                        <Input aria-label="Valor" inputMode="decimal" placeholder="0" className="h-8 w-28 text-right" value={valueText} onChange={(event) => setValueText(event.target.value)} />
                        <select aria-label="Tipo" className="h-8 rounded-md border bg-background px-2 text-sm" value={unit} onChange={(event) => setUnit(event.target.value as RuleUnit)}>
                          <option value="percent">%</option>
                          <option value="amount">S/</option>
                        </select>
                      </span>
                    ) : null}
                    {checked && option.mode === "fixed" ? (
                      <span className="mt-2 flex items-center gap-2">
                        <span>S/</span>
                        <Input aria-label="Precio fijo" inputMode="decimal" placeholder="0.00" className="h-8 w-28 text-right" value={valueText} onChange={(event) => setValueText(event.target.value)} />
                      </span>
                    ) : null}
                  </span>
                </label>
              );
            })}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-2.5">
            <div>
              <small className="block text-xs text-muted-foreground">Precio en {channelName}</small>
              <span className="text-xl font-bold tabular-nums" data-testid="channel-price-preview">
                {error || !affected.length ? (affected.length ? "—" : priceRange(storePrices)) : priceRange(resulting)}
              </span>
            </div>
            {lowCost.length ? (
              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                Por debajo del costo ({priceRange(lowCost.map((row) => row.cost as number))} sin IGV)
              </span>
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground">Las promociones se aplican sobre este precio.</p>
        </div>
        <DialogFooter className="items-center gap-2 sm:justify-between">
          <span role={error && value !== null ? "alert" : undefined} className="text-sm text-red-600">{mode !== "same" && (value !== null || valueText) ? error : ""}</span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onCancel} disabled={saving}>Cancelar</Button>
            <Button onClick={() => onConfirm(rule)} disabled={!!error || saving}>{saving ? "Guardando…" : activating ? "Activar canal" : "Guardar precio"}</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
