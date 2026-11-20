"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { AlertTriangle, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { canSeeProductCosts } from "@/config/permissions.config";
import { VariantSearchPicker, searchResultLabel } from "@/components/variant-search/VariantSearchPicker";
import { getVariantCosts } from "@/services/purchasesService";
import {
  createPack,
  getPackMarginRules,
  getVariantSalePrices,
  replacePackComponents,
  updatePackBasics,
  type PackLowMarginConflict,
  type PackView,
} from "@/services/packsService";
import { apiErrorInfo } from "@/lib/catalog/catalogPayloads";
import { marginAlert, needsMarginConfirmation, packMargin, percent, soles, variantLabel } from "@/lib/packs/packMath";

interface ComponentRow {
  variantId: string;
  label: string;
  sku: string | null;
  quantity: number;
}

const MASK = "••••";

function lowMarginConflict(error: unknown): PackLowMarginConflict | null {
  if (!axios.isAxiosError(error) || error.response?.status !== 409) return null;
  const data = error.response.data as Partial<PackLowMarginConflict> | undefined;
  return data?.code === "PACK_LOW_MARGIN" ? (data as PackLowMarginConflict) : null;
}

/**
 * FEAT-24 H9 (H9-D1/D3) — alta y edición de un pack (mockup `mPack`): nombre, SKU, precio con IGV y
 * componentes (variante + cantidad). El margen se ve en vivo solo con permiso de costos; si queda bajo el
 * mínimo o el precio no cubre el costo, guardar exige confirmarlo. Al editar, nombre y precio van por el
 * catálogo y después se reemplazan los componentes (ese PUT vuelve a medir el margen con el precio nuevo).
 */
export function PackFormDialog({ pack, onClose, onSaved }: { pack: PackView | null; onClose: () => void; onSaved?: (pack: PackView) => void }) {
  const { auth } = useAuth();
  const companyId = auth?.company?.id ?? "";
  const seeCosts = canSeeProductCosts(auth?.user);
  const queryClient = useQueryClient();
  const [name, setName] = useState(pack?.name ?? "");
  const [sku, setSku] = useState("");
  const [priceText, setPriceText] = useState(pack ? String(pack.price) : "");
  const [rows, setRows] = useState<ComponentRow[]>(
    () =>
      pack?.components.map((component) => ({
        variantId: component.variantId,
        label: variantLabel(component.productName, component.attributeValues),
        sku: component.sku,
        quantity: component.quantity,
      })) ?? [],
  );
  const [confirmLow, setConfirmLow] = useState(false);
  const [serverConflict, setServerConflict] = useState<PackLowMarginConflict | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  // Lo ya guardado en un intento anterior (si el PUT de componentes pidió confirmación, no se repite).
  const [savedBasics, setSavedBasics] = useState({ name: pack?.name ?? "", price: pack?.price ?? 0 });

  const variantIds = useMemo(() => rows.map((row) => row.variantId).sort(), [rows]);
  const rules = useQuery({ queryKey: ["pack-margin-rules", companyId], queryFn: ({ signal }) => getPackMarginRules(signal), enabled: seeCosts && !!companyId, retry: false, staleTime: 60_000 });
  const costs = useQuery({
    queryKey: ["pack-component-costs", companyId, variantIds],
    queryFn: async () => new Map((await getVariantCosts(variantIds)).map((row) => [row.variantId, row.averageCost])),
    enabled: seeCosts && variantIds.length > 0,
    retry: false,
  });
  const prices = useQuery({
    queryKey: ["pack-component-prices", companyId, variantIds],
    queryFn: () => getVariantSalePrices(variantIds, companyId),
    enabled: variantIds.length > 0 && !!companyId,
    retry: false,
  });

  const price = Number(priceText.replace(",", "."));
  const priceValid = Number.isFinite(price) && price > 0;
  const listSum = rows.reduce((sum, row) => sum + (prices.data?.get(row.variantId) ?? 0) * row.quantity, 0);
  const live = seeCosts && rules.data && costs.data && priceValid
    ? packMargin({ price, components: rows, costs: costs.data, rules: rules.data })
    : null;
  const alert = serverConflict ? serverConflict.message : live ? marginAlert(live) : "";
  const mustConfirm = Boolean(serverConflict) || needsMarginConfirmation(live?.status);

  const setQuantity = (variantId: string, quantity: number) =>
    setRows((current) => current.map((row) => (row.variantId === variantId ? { ...row, quantity } : row)));

  const validate = (): string => {
    if (name.trim().length < 3) return "Escribe el nombre del pack (al menos 3 caracteres).";
    if (!priceValid) return "Escribe el precio del pack.";
    if (rows.length === 0) return "Agrega al menos un componente.";
    if (rows.some((row) => !Number.isInteger(row.quantity) || row.quantity < 1 || row.quantity > 1000)) return "Cada cantidad va de 1 a 1000.";
    if (rows.reduce((sum, row) => sum + row.quantity, 0) < 2) return "Un pack necesita al menos 2 unidades en total.";
    if (mustConfirm && !confirmLow) return "Confirma que quieres guardar el pack con este margen.";
    return "";
  };

  const save = async () => {
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }
    setError("");
    setSaving(true);
    const components = rows.map((row) => ({ variantId: row.variantId, quantity: row.quantity }));
    const confirm = mustConfirm && confirmLow ? true : undefined;
    try {
      let saved: PackView;
      if (pack) {
        const patch: { name?: string; price?: number } = {};
        if (name.trim() !== savedBasics.name) patch.name = name.trim();
        if (Math.round(price * 100) !== Math.round(savedBasics.price * 100)) patch.price = Math.round(price * 100) / 100;
        await updatePackBasics(pack, patch);
        setSavedBasics({ name: name.trim(), price });
        saved = await replacePackComponents(pack.id, { components, confirmLowMargin: confirm });
      } else {
        saved = await createPack({
          name: name.trim(),
          price: Math.round(price * 100) / 100,
          components,
          ...(sku.trim() ? { companySku: sku.trim() } : {}),
          ...(confirm ? { confirmLowMargin: true } : {}),
        });
      }
      void queryClient.invalidateQueries({ queryKey: ["packs"] });
      void queryClient.invalidateQueries({ queryKey: ["pack"] });
      toast.success(pack ? "Pack actualizado" : "Pack creado");
      onSaved?.(saved);
      onClose();
    } catch (cause) {
      const conflict = lowMarginConflict(cause);
      if (conflict) {
        setServerConflict(conflict);
        setConfirmLow(false);
        setError("Confirma el margen para guardar el pack.");
      } else {
        setError(apiErrorInfo(cause, "No se pudo guardar el pack.").message);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && !saving && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{pack ? "Editar pack" : "Nuevo pack"}</DialogTitle>
          <DialogDescription>Producto con SKU propio que descuenta sus componentes.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="pack-name">Nombre</Label>
              <Input id="pack-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Ej. Kit verano" maxLength={200} />
            </div>
            {pack ? (
              <div className="space-y-1.5">
                <Label>SKU</Label>
                <p className="font-mono text-sm">{pack.sku || pack.productSku || "—"}</p>
                <p className="text-xs text-muted-foreground">Los pedidos de Shopify entran como este pack si el producto allá tiene este mismo SKU.</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label htmlFor="pack-sku">SKU <span className="text-muted-foreground">(opcional)</span></Label>
                <Input id="pack-sku" value={sku} onChange={(event) => setSku(event.target.value)} placeholder="Se genera solo si lo dejas vacío" className="font-mono" maxLength={100} aria-describedby="pack-sku-hint" />
                {/* Correcciones 11-20 (A1): un pedido de Shopify se reconoce como pack solo por el SKU (o un vínculo ya hecho). */}
                <p id="pack-sku-hint" className="text-xs text-muted-foreground">
                  Si vendes este pack en Shopify, pon el mismo SKU que tiene allá: así sus pedidos descuentan los componentes.
                </p>
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="pack-price">Precio (con IGV)</Label>
              <Input id="pack-price" inputMode="decimal" value={priceText} onChange={(event) => { setPriceText(event.target.value); setServerConflict(null); setConfirmLow(false); }} placeholder="S/" />
            </div>
          </div>

          <section className="space-y-2" aria-label="Componentes">
            <p className="text-sm font-medium">Componentes (variantes)</p>
            {rows.length === 0 ? <p className="text-sm text-muted-foreground">Todavía no agregaste componentes.</p> : null}
            <ul className="space-y-2">
              {rows.map((row) => (
                <li key={row.variantId} className="flex items-center gap-2 rounded-md border p-2" data-testid={`pack-component-${row.variantId}`}>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">{row.label}</p>
                    {row.sku ? <p className="font-mono text-xs text-muted-foreground">{row.sku}</p> : null}
                  </div>
                  <Input
                    type="number"
                    min={1}
                    max={1000}
                    className="w-20 text-right"
                    aria-label={`Cantidad de ${row.label}`}
                    value={row.quantity}
                    onChange={(event) => { setQuantity(row.variantId, Math.trunc(Number(event.target.value) || 0)); setServerConflict(null); }}
                  />
                  <Button type="button" variant="ghost" size="icon" aria-label={`Quitar ${row.label}`} onClick={() => { setRows((current) => current.filter((item) => item.variantId !== row.variantId)); setServerConflict(null); }}>
                    <X className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
            <VariantSearchPicker
              label="Agregar componente"
              excludeIds={rows.map((row) => row.variantId)}
              onSelect={(result) => {
                setRows((current) => [...current, { variantId: result.variant_id, label: searchResultLabel(result), sku: result.company_sku || result.sku, quantity: 1 }]);
                setServerConflict(null);
              }}
            />
            <p className="text-xs text-muted-foreground">Sin IMEI ni serie y sin otros packs. El stock del pack es el del componente con menos unidades.</p>
          </section>

          <div className="space-y-1 rounded-md border bg-muted/40 p-3 text-sm" aria-label="Resumen del margen">
            <div className="flex justify-between"><span>Suma de precios de los componentes</span><span className="tabular-nums">{rows.length ? soles(listSum) : "—"}</span></div>
            <div className="flex justify-between"><span>Costo de los componentes</span><span className="tabular-nums">{seeCosts ? (live ? soles(live.cost) : "—") : MASK}</span></div>
            <div className="flex justify-between font-semibold">
              <span>Margen del pack{live && rules.data?.igvAffected ? " (sobre el precio sin IGV)" : ""}</span>
              <span className={live && needsMarginConfirmation(live.status) ? "text-destructive" : "text-emerald-700 dark:text-emerald-400"} data-testid="pack-margin">
                {seeCosts ? (live ? (live.status === "sin_costo" ? "Sin costo" : percent(live.margin)) : "—") : MASK}
              </span>
            </div>
            {seeCosts && live?.status === "sin_costo" ? <p className="text-xs text-muted-foreground">Algún componente todavía no tiene costo: el margen no se puede medir.</p> : null}
            {seeCosts && rules.data ? <p className="text-xs text-muted-foreground">Margen mínimo: {percent(rules.data.minMargin)}</p> : null}
          </div>

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
