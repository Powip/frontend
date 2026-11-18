"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useCompanyBrands } from "@/hooks/useCompanyBrands";
import { useMyWarehouses } from "@/hooks/useMyWarehouses";
import { flattenCategoryTree } from "@/lib/catalog/categoryTree";
import { addDraftLines, COUNT_SCOPE_LABEL, opsErrorMessage, type DraftLine } from "@/lib/warehouseOps";
import { listCatalogCategories } from "@/services/catalogCategoriesService";
import { createCount, listLocations, type CountScope, type CreateCountBody, type StockCount } from "@/services/warehouseOpsService";
import { ErrorBox, SELECT_CLASS, useCompanyWarehouses } from "../OpsBits";
import VariantLinePicker from "../VariantLinePicker";

// FEAT-24 H5-C (H5-D5) — nueva toma de inventario (mockup mNuevoConteo). No
// bloquea la venta: se guarda una foto del stock al iniciar y lo vendido durante
// el conteo no da diferencias falsas. Alcance: todo el almacén, una categoría,
// una marca, una ubicación o productos elegidos. Ciego: quien cuenta no ve el
// stock del sistema hasta cerrar.

const SCOPES: CountScope[] = ["total", "categoria", "marca", "ubicacion", "seleccion"];

interface Props {
  companyId: string;
  onClose: () => void;
  onSaved: (count: StockCount) => void;
}

export default function CountFormDialog({ companyId, onClose, onSaved }: Props) {
  const scope = useMyWarehouses();
  const { warehouses, query: warehousesQuery } = useCompanyWarehouses();
  const { brands, isLoading: brandsLoading } = useCompanyBrands();
  const [inventoryId, setInventoryId] = useState("");
  const [countScope, setCountScope] = useState<CountScope>("total");
  const [categoryId, setCategoryId] = useState("");
  const [brandId, setBrandId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [blind, setBlind] = useState(true);
  const [notes, setNotes] = useState("");
  const [touched, setTouched] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const options = useMemo(() => scope.operable(warehouses.filter((warehouse) => warehouse.status)), [scope, warehouses]);
  const categoriesQuery = useQuery({
    queryKey: ["catalog-categories", companyId, "active"],
    queryFn: ({ signal }) => listCatalogCategories({ activeOnly: true, signal }),
    enabled: !!companyId && countScope === "categoria",
    staleTime: 60_000,
  });
  const categories = useMemo(() => flattenCategoryTree(categoriesQuery.data ?? [], { activeOnly: true }), [categoriesQuery.data]);
  const locationsQuery = useQuery({
    queryKey: ["warehouse-locations", companyId, inventoryId],
    queryFn: ({ signal }) => listLocations(inventoryId, signal),
    enabled: !!inventoryId && countScope === "ubicacion",
  });
  const locations = (locationsQuery.data ?? []).filter((location) => location.active);

  const problem = !inventoryId
    ? "Elige el almacén."
    : countScope === "categoria" && !categoryId
      ? "Elige la categoría."
      : countScope === "marca" && !brandId
        ? "Elige la marca."
        : countScope === "ubicacion" && !locationId
          ? "Elige la ubicación."
          : countScope === "seleccion" && lines.length === 0
            ? "Agrega al menos un producto."
            : null;

  const save = useMutation({
    mutationFn: () => {
      const body: CreateCountBody = {
        inventoryId,
        scope: countScope,
        blind,
        ...(countScope === "categoria" ? { categoryId } : {}),
        ...(countScope === "marca" ? { brandId } : {}),
        ...(countScope === "ubicacion" ? { locationId } : {}),
        ...(countScope === "seleccion" ? { variantIds: lines.map((line) => line.variantId) } : {}),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      };
      return createCount(body);
    },
    onSuccess: (count) => {
      toast.success(`${count.number} iniciado`, { description: "Ya se puede contar desde aquí o escaneando con el celular (Modo almacén)." });
      onSaved(count);
    },
    onError: (error) => setServerError(opsErrorMessage(error, "No se pudo iniciar el conteo. Inténtalo de nuevo.")),
  });
  const busy = save.isPending;

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Nueva toma de inventario</DialogTitle>
          <DialogDescription>No bloquea la venta: se guarda una foto del stock al iniciar.</DialogDescription>
        </DialogHeader>

        {warehousesQuery.isError ? <ErrorBox>{opsErrorMessage(warehousesQuery.error, "No se pudieron cargar los almacenes.")}</ErrorBox> : null}

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="ct-warehouse">Almacén</Label>
            <select
              id="ct-warehouse"
              className={SELECT_CLASS}
              value={inventoryId}
              disabled={busy}
              onChange={(event) => {
                setServerError(null);
                setInventoryId(event.target.value);
                setLocationId("");
              }}
            >
              <option value="">{warehousesQuery.isLoading || scope.isLoading ? "Cargando…" : "Elige el almacén"}</option>
              {options.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="ct-scope">Qué contar</Label>
            <select
              id="ct-scope"
              className={SELECT_CLASS}
              value={countScope}
              disabled={busy}
              onChange={(event) => {
                setServerError(null);
                setCountScope(event.target.value as CountScope);
              }}
            >
              {SCOPES.map((value) => (
                <option key={value} value={value}>
                  {COUNT_SCOPE_LABEL[value]}
                </option>
              ))}
            </select>
          </div>

          {countScope === "categoria" ? (
            <div className="space-y-1 md:col-span-2">
              <Label htmlFor="ct-category">Categoría</Label>
              <select id="ct-category" className={SELECT_CLASS} value={categoryId} disabled={busy} onChange={(event) => setCategoryId(event.target.value)}>
                <option value="">{categoriesQuery.isLoading ? "Cargando…" : "Elige la categoría (incluye sus subcategorías)"}</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.path}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          {countScope === "marca" ? (
            <div className="space-y-1 md:col-span-2">
              <Label htmlFor="ct-brand">Marca</Label>
              <select id="ct-brand" className={SELECT_CLASS} value={brandId} disabled={busy} onChange={(event) => setBrandId(event.target.value)}>
                <option value="">{brandsLoading ? "Cargando…" : "Elige la marca"}</option>
                {brands.map((brand) => (
                  <option key={brand.id} value={brand.id}>
                    {brand.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          {countScope === "ubicacion" ? (
            <div className="space-y-1 md:col-span-2">
              <Label htmlFor="ct-location">Ubicación</Label>
              <select id="ct-location" className={SELECT_CLASS} value={locationId} disabled={busy || !inventoryId} onChange={(event) => setLocationId(event.target.value)}>
                <option value="">{!inventoryId ? "Primero elige el almacén" : locationsQuery.isLoading ? "Cargando…" : "Elige la ubicación"}</option>
                {locations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.code}
                    {location.description ? ` · ${location.description}` : ""}
                  </option>
                ))}
              </select>
              {inventoryId && !locationsQuery.isLoading && locations.length === 0 ? (
                <p className="text-xs text-muted-foreground">Este almacén no tiene ubicaciones: créalas en Configuración › Tiendas y almacenes.</p>
              ) : null}
            </div>
          ) : null}
        </div>

        {countScope === "seleccion" ? (
          <>
            <VariantLinePicker
              companyId={companyId}
              idPrefix="ct"
              disabled={busy}
              onAdd={(incoming) => {
                const next = addDraftLines(lines, incoming);
                setLines(next.lines);
                return next.added;
              }}
            />
            {lines.length > 0 ? (
              <ul className="max-h-48 divide-y overflow-y-auto rounded-md border">
                {lines.map((line) => (
                  <li key={line.variantId} className="flex items-center gap-2 px-3 py-1.5 text-sm">
                    <span className="min-w-0 flex-1 truncate">{line.label}</span>
                    <span className="font-mono text-xs text-muted-foreground">{line.sku}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Quitar ${line.label}`}
                      disabled={busy}
                      onClick={() => setLines(lines.filter((candidate) => candidate.variantId !== line.variantId))}
                    >
                      <X className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </li>
                ))}
              </ul>
            ) : null}
          </>
        ) : null}

        <div className="flex items-start gap-3 rounded-md border p-3">
          <Switch id="ct-blind" checked={blind} disabled={busy} onCheckedChange={setBlind} />
          <Label htmlFor="ct-blind" className="flex-col items-start gap-1 font-normal">
            <span className="font-medium">Conteo ciego</span>
            <span className="text-xs text-muted-foreground">Quien cuenta no ve el stock del sistema ni las diferencias hasta cerrar el conteo.</span>
          </Label>
        </div>

        <div className="space-y-1">
          <Label htmlFor="ct-notes">Nota (opcional)</Label>
          <Textarea id="ct-notes" rows={2} maxLength={2000} value={notes} disabled={busy} onChange={(event) => setNotes(event.target.value)} />
        </div>

        {touched && problem ? <ErrorBox>{problem}</ErrorBox> : null}
        <ErrorBox>{serverError}</ErrorBox>

        <DialogFooter>
          <Button type="button" variant="outline" disabled={busy} onClick={onClose}>
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={busy}
            onClick={() => {
              setTouched(true);
              if (problem) return;
              save.mutate();
            }}
          >
            {busy ? "Iniciando…" : "Iniciar conteo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
