"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Printer, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { useBusinessInventories } from "@/hooks/useBusinessInventories";
import { useCompanyBrands } from "@/hooks/useCompanyBrands";
import { useLabelFormats } from "@/hooks/useLabelFormats";
import { flattenCategoryTree } from "@/lib/catalog/categoryTree";
import { loadImageAsDataUrl } from "@/lib/labels/logo";
import {
  applyQuantities,
  buildAddedRequest,
  buildLabelsRequest,
  mergeLabelLines,
  printBlocker,
  type AddedLabelItem,
  type LabelsCatalogFilter,
  type LabelsQuantityMode,
  type LabelsSource,
} from "@/lib/labels/request";
import { LABEL_OUTPUT_NAMES, labelCount, MAX_LABELS_PER_PRINT } from "@/lib/labels/types";
import { listCatalogCategories } from "@/services/catalogCategoriesService";
import { fetchLabelLines, labelsErrorMessage } from "@/services/labelsService";
import { LabelItemSearch } from "./LabelItemSearch";
import { LabelPreview } from "./LabelPreview";

interface PrintLabelsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  source: LabelsSource;
}

/**
 * FEAT-24 H7 — «Imprimir etiquetas»: desde la ficha (las variantes del producto), desde el listado (los
 * productos elegidos), desde Etiquetas (el catálogo, por categoría propia o marca) o desde una compra
 * recibida (H3: lo que entró en la recepción). La cantidad por variante es 1, lo disponible en el almacén
 * elegido o lo recibido, y se puede cambiar línea por línea. El PDF se arma en el navegador.
 *
 * Correcciones 11-20 (B2): lo de arriba sigue siendo lo que se carga por defecto (imprimir todo). Además, un
 * buscador agrega productos o variantes, cada línea se puede quitar (y volver a poner) y el almacén hace de
 * filtro: con «1 de cada una», solo lo que tiene stock ahí; con «según stock», su disponible.
 */
export function PrintLabelsDialog({ open, onOpenChange, source }: PrintLabelsDialogProps) {
  const { auth } = useAuth();
  const companyId = auth?.company?.id ?? "";
  const formats = useLabelFormats();
  const warehouses = useBusinessInventories();
  const { brands } = useCompanyBrands();
  // FEAT-24 H4: categorías propias de la empresa (misma caché que el catálogo, useCatalogCategories).
  const categories = useQuery({
    queryKey: ["catalog-categories", companyId],
    queryFn: ({ signal }) => listCatalogCategories({ signal }),
    enabled: open && source.kind === "catalog" && Boolean(companyId),
    retry: false,
    staleTime: 60_000,
  });
  const categoryOptions = useMemo(() => flattenCategoryTree(categories.data ?? [], { activeOnly: true }), [categories.data]);
  const fromPurchase = source.kind === "purchase_order";
  const stores = auth?.company?.stores ?? [];

  const [formatId, setFormatId] = useState("");
  const [mode, setMode] = useState<LabelsQuantityMode>("fixed");
  const [inventoryId, setInventoryId] = useState("");
  const [filter, setFilter] = useState<LabelsCatalogFilter>({});
  const [storeId, setStoreId] = useState(stores[0]?.id ?? "");
  const [edits, setEdits] = useState<{ key: string; values: Record<string, number> }>({ key: "", values: {} });
  const [added, setAdded] = useState<AddedLabelItem[]>([]);
  const [removed, setRemoved] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  const format =
    formats.data?.find((f) => f.id === formatId) ?? formats.data?.find((f) => f.isDefault) ?? formats.data?.[0];
  const request = useMemo(
    () => buildLabelsRequest(source, mode, { inventoryId, filter }),
    [source, mode, inventoryId, filter],
  );
  const requestKey = JSON.stringify(request);
  const lines = useQuery({
    queryKey: ["label-lines", companyId, requestKey],
    queryFn: ({ signal }) => fetchLabelLines(request!, signal),
    enabled: open && Boolean(request) && Boolean(companyId),
    retry: false,
  });
  // Lo agregado con el buscador: «según stock» trae su disponible en el almacén; si no, 1 de cada una.
  const addedRequest = useMemo(
    () => buildAddedRequest(added, fromPurchase ? "fixed" : mode, fromPurchase ? "" : inventoryId),
    [added, fromPurchase, mode, inventoryId],
  );
  const addedLines = useQuery({
    queryKey: ["label-lines", companyId, JSON.stringify(addedRequest)],
    queryFn: ({ signal }) => fetchLabelLines(addedRequest!, signal),
    enabled: open && Boolean(addedRequest) && Boolean(companyId),
    retry: false,
  });
  const warehouseFilter = !fromPurchase && mode === "fixed" && inventoryId !== "";
  const listed = useMemo(
    () => mergeLabelLines({ base: lines.data ?? [], added, addedLines: addedLines.data ?? [], warehouseFilter }),
    [lines.data, added, addedLines.data, warehouseFilter],
  );
  const hiddenCount = useMemo(() => listed.filter((line) => removed.includes(line.variantId)).length, [listed, removed]);
  // Las cantidades editadas valen para estas líneas; si cambia el pedido, se vuelve a la automática.
  const overrides = useMemo(() => (edits.key === requestKey ? edits.values : {}), [edits, requestKey]);
  const finalLines = useMemo(
    () => applyQuantities(listed.filter((line) => !removed.includes(line.variantId)), overrides),
    [listed, removed, overrides],
  );
  const loadingAdded = Boolean(addedRequest) && addedLines.isFetching;
  const total = finalLines.reduce((sum, line) => sum + labelCount(line.quantity), 0);
  const blocker = lines.data ? printBlocker(finalLines) : null;
  const storeName = stores.find((store) => store.id === storeId)?.name ?? null;

  const setQuantity = (variantId: string, raw: string) => {
    const value = raw === "" ? 0 : Number(raw);
    setEdits({ key: requestKey, values: { ...overrides, [variantId]: Number.isFinite(value) ? value : 0 } });
  };

  const known = [...(lines.data ?? []), ...(addedLines.data ?? [])];
  const addProduct = (product: { id: string; name: string }) => {
    setAdded((current) => (current.some((item) => item.productId === product.id && item.variantId === null) ? current : [...current, { productId: product.id, variantId: null }]));
    // Volver a agregarlo devuelve las variantes que se habían quitado.
    setRemoved((current) => current.filter((variantId) => !known.some((line) => line.variantId === variantId && line.productId === product.id)));
    return `Se agregó ${product.name} con sus variantes.`;
  };
  const addVariant = (match: { variantId: string; productId: string; sku: string; companySku: string | null; productName: string }) => {
    const label = `${match.productName} · ${match.companySku || match.sku}`;
    if (finalLines.some((line) => line.variantId === match.variantId)) return `${label} ya está en la lista.`;
    setAdded((current) => (current.some((item) => item.variantId === match.variantId) ? current : [...current, { productId: match.productId, variantId: match.variantId }]));
    setRemoved((current) => current.filter((variantId) => variantId !== match.variantId));
    return `Se agregó ${label}.`;
  };

  const download = async () => {
    if (!format || blocker) return;
    setGenerating(true);
    setError(null);
    try {
      const logoDataUrl = format.fields.includes("logo") ? await loadImageAsDataUrl(auth?.company?.logoUrl) : null;
      const { downloadLabelsPdf } = await import("@/lib/labels/pdf");
      const count = downloadLabelsPdf({
        format,
        lines: finalLines,
        storeName,
        companyName: auth?.company?.name ?? null,
        logoDataUrl,
      });
      toast.success(`PDF con ${count} etiquetas listo`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo generar el PDF.");
    } finally {
      setGenerating(false);
    }
  };

  const title =
    source.kind === "products"
      ? source.title ?? `${source.productIds.length} producto${source.productIds.length === 1 ? "" : "s"}`
      : source.kind === "purchase_order"
        ? source.title ?? "Compra recibida"
        : "Catálogo";

  return (
    <Dialog open={open} onOpenChange={(next) => !generating && onOpenChange(next)}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Imprimir etiquetas · {title}</DialogTitle>
          <DialogDescription>
            Cada etiqueta lleva el código de la variante. Máximo {MAX_LABELS_PER_PRINT} etiquetas por PDF.
          </DialogDescription>
        </DialogHeader>

        {formats.isError ? (
          <p role="alert">{labelsErrorMessage(formats.error, "No se pudieron cargar los formatos.")}</p>
        ) : !format ? (
          <p role="status">Cargando formatos...</p>
        ) : (
          <div className="grid gap-6 md:grid-cols-[1fr_auto]">
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="labels-format">Formato</Label>
                  <select
                    id="labels-format"
                    className="w-full rounded-md border p-2 text-sm"
                    value={format.id}
                    onChange={(event) => setFormatId(event.target.value)}
                  >
                    {formats.data?.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name} · {f.widthMm}×{f.heightMm} mm{f.isDefault ? " (predeterminado)" : ""}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground">{LABEL_OUTPUT_NAMES[format.output]}</p>
                </div>
                {format.fields.includes("store") && stores.length > 0 ? (
                  <div className="space-y-1">
                    <Label htmlFor="labels-store">Tienda</Label>
                    <select
                      id="labels-store"
                      className="w-full rounded-md border p-2 text-sm"
                      value={storeId}
                      onChange={(event) => setStoreId(event.target.value)}
                    >
                      {stores.map((store) => (
                        <option key={store.id} value={store.id}>
                          {store.name}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}
              </div>

              {source.kind === "catalog" ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor="labels-category">Categoría</Label>
                    <select
                      id="labels-category"
                      className="w-full rounded-md border p-2 text-sm"
                      value={filter.categoryId ?? ""}
                      onChange={(event) => setFilter((f) => ({ ...f, categoryId: event.target.value || undefined }))}
                    >
                      <option value="">Todas las categorías</option>
                      {categoryOptions.map((category) => (
                        <option key={category.id} value={category.id} title={category.path}>
                          {`${"\u00a0\u00a0\u00a0".repeat(category.level - 1)}${category.name}`}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="labels-brand">Marca</Label>
                    <select
                      id="labels-brand"
                      className="w-full rounded-md border p-2 text-sm"
                      value={filter.brandId ?? ""}
                      onChange={(event) => setFilter((f) => ({ ...f, brandId: event.target.value || undefined }))}
                    >
                      <option value="">Todas las marcas</option>
                      {brands.map((brand) => (
                        <option key={brand.id} value={brand.id}>
                          {brand.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ) : null}

              {fromPurchase ? (
                <p className="text-sm text-muted-foreground">
                  Una etiqueta por unidad recibida. Puedes cambiar la cantidad de cada variante en la lista.
                </p>
              ) : (
                <fieldset className="space-y-2">
                  <legend className="text-sm font-medium">Cantidad por variante</legend>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="radio" name="labels-mode" checked={mode === "fixed"} onChange={() => setMode("fixed")} />1 de cada
                    una
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="radio" name="labels-mode" checked={mode === "stock"} onChange={() => setMode("stock")} />
                    Según el stock disponible del almacén
                  </label>
                  <p className="text-xs text-muted-foreground">Luego puedes cambiar la cantidad de cada variante en la lista.</p>
                </fieldset>
              )}

              {fromPurchase ? null : (
                <div className="space-y-1">
                  <Label htmlFor="labels-warehouse">Almacén</Label>
                  <select
                    id="labels-warehouse"
                    className="w-full rounded-md border p-2 text-sm"
                    value={inventoryId}
                    onChange={(event) => setInventoryId(event.target.value)}
                  >
                    <option value="">Todos los almacenes</option>
                    {warehouses.inventories.map((warehouse) => (
                      <option key={warehouse.id} value={warehouse.id}>
                        {warehouse.name}
                        {warehouse.storeName ? ` · ${warehouse.storeName}` : ""}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground">
                    {!inventoryId
                      ? "Elige uno para imprimir solo lo que hay en ese almacén."
                      : mode === "fixed"
                        ? "Solo lo que tiene stock en este almacén."
                        : "La cantidad es el disponible en este almacén."}
                  </p>
                </div>
              )}

              <LabelItemSearch companyId={companyId} disabled={!companyId} onAddProduct={addProduct} onAddVariant={addVariant} />

              {!request ? (
                <p className="text-sm text-muted-foreground">Elige el almacén para traer su stock.</p>
              ) : lines.isError ? (
                <p role="alert" className="text-sm text-destructive">
                  {labelsErrorMessage(lines.error, "No se pudieron cargar las variantes.")}
                </p>
              ) : lines.isPending ? (
                <p role="status">Cargando variantes...</p>
              ) : finalLines.length === 0 && !loadingAdded ? (
                <p className="text-sm text-muted-foreground">
                  {hiddenCount > 0
                    ? "Quitaste todas las líneas."
                    : warehouseFilter
                      ? "No hay stock de estos productos en este almacén."
                      : "No hay variantes activas para imprimir."}
                </p>
              ) : (
                <div className="max-h-72 overflow-auto rounded-md border">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-background">
                      <tr className="text-left">
                        <th className="p-2">Variante</th>
                        <th className="p-2">Código</th>
                        <th className="p-2 text-right">Etiquetas</th>
                        <th className="w-10 p-2">
                          <span className="sr-only">Quitar</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {finalLines.map((line) => (
                        <tr key={line.variantId} className="border-t">
                          <td className="p-2">
                            <div>{line.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {[line.variant, line.sku].filter(Boolean).join(" · ")}
                            </div>
                          </td>
                          <td className="p-2 font-mono text-xs">
                            {line.code}
                            <div className="text-muted-foreground">{line.codeType === "EAN13" ? "EAN-13" : "CODE128"}</div>
                          </td>
                          <td className="p-2 text-right">
                            <Input
                              type="number"
                              min={0}
                              max={MAX_LABELS_PER_PRINT}
                              className="ml-auto w-24 text-right"
                              aria-label={`Etiquetas de ${line.sku}`}
                              value={String(labelCount(line.quantity))}
                              onChange={(event) => setQuantity(line.variantId, event.target.value)}
                            />
                          </td>
                          <td className="p-2 text-right">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              aria-label={`Quitar ${line.sku}`}
                              onClick={() => setRemoved((current) => [...current, line.variantId])}
                            >
                              <Trash2 className="h-4 w-4" aria-hidden="true" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {addedLines.isError ? (
                <p role="alert" className="text-sm text-destructive">
                  {labelsErrorMessage(addedLines.error, "No se pudo agregar a la lista.")}
                </p>
              ) : null}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <p className="text-sm" aria-live="polite">
                  {finalLines.length} variantes · <b>{total} etiquetas</b>
                </p>
                {hiddenCount > 0 ? (
                  <Button type="button" variant="link" size="sm" className="h-auto p-0" onClick={() => setRemoved([])}>
                    {hiddenCount === 1 ? "Volver a poner la quitada" : `Volver a poner las ${hiddenCount} quitadas`}
                  </Button>
                ) : null}
              </div>
              {blocker && lines.data?.length ? (
                <p role="alert" className="text-sm text-destructive">
                  {blocker}
                </p>
              ) : null}
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Vista previa</p>
              <LabelPreview
                format={format}
                line={finalLines[0]}
                storeName={storeName}
                companyName={auth?.company?.name || "LOGO"}
                pxPerMm={2.8}
              />
            </div>
          </div>
        )}

        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={generating}>
            Cerrar
          </Button>
          <Button type="button" onClick={() => void download()} disabled={!format || !lines.data || loadingAdded || Boolean(blocker) || generating}>
            {generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Printer className="mr-2 h-4 w-4" />}
            Descargar PDF · {total} etiquetas
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
