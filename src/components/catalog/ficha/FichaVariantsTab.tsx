"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ImagePlus, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ProductThumb, SkuConflictBadge } from "@/components/catalog/CatalogBadges";
import { uploadImage } from "@/services/uploadService";
import { updateCatalogVariant, type CatalogVariantDetail } from "@/services/catalogProductService";
import { apiErrorInfo, buildVariantPatch, duplicateSkuKeys, isEmptyPatch, skuKey, type VariantCodesForm } from "@/lib/catalog/catalogPayloads";
import { formatVariantLabel } from "@/lib/variantAttributes";
import { codesFromVariant } from "./FichaGeneralTab";

/**
 * FEAT-24 H4 (H4-D11) — pestaña Variantes: SKU editable (el 409 se muestra en la fila), código de barras,
 * foto por variante y aviso de «SKU repetido» (cuarentena). Las unificadas no se editan.
 */
export default function FichaVariantsTab({
  productId,
  productImage,
  variants,
  canEdit,
}: {
  productId: string;
  productImage?: string | null;
  variants: CatalogVariantDetail[];
  canEdit: boolean;
}) {
  const queryClient = useQueryClient();
  const visible = variants.filter((variant) => !variant.mergedInto);
  const [drafts, setDrafts] = useState<Record<string, VariantCodesForm>>(() => Object.fromEntries(visible.map((variant) => [variant.id, codesFromVariant(variant)])));
  const [rowErrors, setRowErrors] = useState<Record<string, string | null>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const draftOf = (variant: CatalogVariantDetail) => drafts[variant.id] ?? codesFromVariant(variant);
  const repeated = duplicateSkuKeys(visible.filter((variant) => variant.isActive !== false).map((variant) => draftOf(variant).companySku));

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["catalog-product-variants", productId] });
    void queryClient.invalidateQueries({ queryKey: ["business-product-catalog"] });
  };

  const save = async (variant: CatalogVariantDetail) => {
    const draft = draftOf(variant);
    if (repeated.has(skuKey(draft.companySku))) {
      setRowErrors((prev) => ({ ...prev, [variant.id]: "Otra variante de este producto tiene el mismo SKU." }));
      return;
    }
    const { patch, errors } = buildVariantPatch(codesFromVariant(variant), draft);
    if (errors.length) {
      setRowErrors((prev) => ({ ...prev, [variant.id]: errors.join(" ") }));
      return;
    }
    if (isEmptyPatch(patch)) return;
    setBusy(variant.id);
    try {
      await updateCatalogVariant(variant.id, patch);
      setRowErrors((prev) => ({ ...prev, [variant.id]: null }));
      toast.success("Variante guardada");
      refresh();
    } catch (error) {
      setRowErrors((prev) => ({ ...prev, [variant.id]: apiErrorInfo(error, "No se pudo guardar la variante.").message }));
    } finally {
      setBusy(null);
    }
  };

  const changePhoto = async (variant: CatalogVariantDetail, file: File | undefined) => {
    if (!file) return;
    setBusy(variant.id);
    try {
      const url = await uploadImage(file);
      await updateCatalogVariant(variant.id, { images: [url, ...(variant.images ?? []).slice(1)] });
      toast.success("Foto de la variante guardada");
      refresh();
    } catch (error) {
      toast.error(apiErrorInfo(error, "No se pudo guardar la foto.").message);
    } finally {
      setBusy(null);
    }
  };

  if (visible.length === 0) return <p className="text-sm text-muted-foreground">Este producto no tiene variantes.</p>;
  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Foto</TableHead>
              <TableHead>Variante</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead>Código de barras</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.map((variant) => {
              const draft = draftOf(variant);
              const label = formatVariantLabel(variant.attributeValues) || "Única";
              const editable = canEdit && busy !== variant.id;
              const changed = !isEmptyPatch(buildVariantPatch(codesFromVariant(variant), draft).patch);
              const error = rowErrors[variant.id];
              return (
                <TableRow key={variant.id} className={variant.isActive === false ? "opacity-60" : undefined}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <ProductThumb src={variant.images?.[0] || productImage} name={label} />
                      {canEdit ? (
                        <label className="cursor-pointer text-muted-foreground hover:text-foreground" title={variant.images?.[0] ? "Cambiar foto" : "Subir foto"}>
                          <ImagePlus className="h-4 w-4" />
                          <input type="file" accept="image/*" className="hidden" aria-label={`Foto de ${label}`} disabled={!editable} onChange={(event) => void changePhoto(variant, event.target.files?.[0])} />
                        </label>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">{label}</TableCell>
                  <TableCell className="min-w-[12rem]">
                    <Input
                      aria-label={`SKU de ${label}`}
                      className="h-8 font-mono"
                      value={draft.companySku}
                      maxLength={60}
                      disabled={!editable}
                      aria-invalid={Boolean(error)}
                      onChange={(event) => {
                        setDrafts((prev) => ({ ...prev, [variant.id]: { ...draft, companySku: event.target.value } }));
                        setRowErrors((prev) => ({ ...prev, [variant.id]: null }));
                      }}
                    />
                    {variant.skuConflict ? <div className="mt-1 flex items-center gap-1 text-xs text-red-700"><SkuConflictBadge /> renómbralo</div> : null}
                    {error ? <p role="alert" className="mt-1 text-xs text-red-600">{error}</p> : null}
                  </TableCell>
                  <TableCell className="min-w-[12rem]">
                    <Input
                      aria-label={`Código de barras de ${label}`}
                      className="h-8 font-mono"
                      value={draft.barcode}
                      maxLength={64}
                      disabled={!editable}
                      onChange={(event) => setDrafts((prev) => ({ ...prev, [variant.id]: { ...draft, barcode: event.target.value } }))}
                    />
                    {variant.powipEan ? <p className="mt-1 text-[11px] text-muted-foreground">POWIP: <span className="font-mono">{variant.powipEan}</span></p> : null}
                  </TableCell>
                  <TableCell>{variant.isActive === false ? <Badge variant="outline">Inactiva</Badge> : <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">Activa</Badge>}</TableCell>
                  <TableCell className="text-right">
                    {canEdit ? (
                      <Button type="button" size="sm" variant="outline" disabled={!editable || !changed} onClick={() => void save(variant)}>
                        {busy === variant.id ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
                        Guardar
                      </Button>
                    ) : null}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      <p className="text-xs text-muted-foreground">Cada variante tiene su SKU, único en tu empresa. Si la variante no tiene foto, se usa la del producto. Las opciones y los precios se cambian en «Editar opciones y precios».</p>
    </div>
  );
}
