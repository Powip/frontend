"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ImagePlus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import BrandSelect from "@/components/products/BrandSelect";
import CategoryTreeSelect from "@/components/catalog/CategoryTreeSelect";
import { ProductThumb, SkuConflictBadge } from "@/components/catalog/CatalogBadges";
import { uploadImage } from "@/services/uploadService";
import { updateCatalogProduct, updateCatalogVariant, type CatalogProductDetail, type CatalogVariantDetail } from "@/services/catalogProductService";
import {
  apiErrorInfo,
  buildProductPatch,
  buildVariantPatch,
  isEmptyPatch,
  type ProductGeneralForm,
  type VariantCodesForm,
} from "@/lib/catalog/catalogPayloads";
import type { CatalogCategoryNode } from "@/lib/catalog/categoryTree";
import VariantCostField from "@/components/products/VariantCostField";

export const formFromProduct = (product: CatalogProductDetail): ProductGeneralForm => ({
  name: product.name ?? "",
  description: product.description ?? "",
  companySku: product.companySku ?? "",
  brandId: product.brandId ?? "",
  categoryId: product.categoryId ?? product.category?.id ?? "",
  purchaseUnit: product.purchaseUnit ?? "",
  purchaseFactor: String(product.purchaseFactor ?? 1),
  imageUrl: product.imageUrl ?? "",
});

export const codesFromVariant = (variant: CatalogVariantDetail | null | undefined): VariantCodesForm => ({
  companySku: variant?.companySku ?? "",
  barcode: variant?.barcode ?? "",
});

/**
 * FEAT-24 H4 (H4-D11) — pestaña General: nombre, SKU base, marca (con creación rápida), categoría propia,
 * unidad de compra y factor, descripción y foto principal. Un producto simple muestra acá su SKU y su
 * código de barras (no tiene tabla de variantes).
 */
/**
 * FEAT-24 H10 — costo promedio en la ficha: lo ven Administrador y Operaciones; solo el Administrador lo carga
 * a mano (`PUT /variant-costs` con `operationId`). `byVariant`: `undefined` = cargando, `"error"` = no se pudo leer.
 */
export interface FichaCosts {
  byVariant: Map<string, number | null> | undefined | "error";
  canEdit: boolean;
  onSaved: (variantId: string, cost: number) => void;
}

export default function FichaGeneralTab({
  product,
  simpleVariant,
  categoryTree,
  canEdit,
  costs,
}: {
  product: CatalogProductDetail;
  /** La única variante de un producto simple (null si tiene variantes). */
  simpleVariant: CatalogVariantDetail | null;
  categoryTree: CatalogCategoryNode[];
  canEdit: boolean;
  /** Sin rol de costos no viene. */
  costs?: FichaCosts;
}) {
  const queryClient = useQueryClient();
  const original = formFromProduct(product);
  const originalCodes = codesFromVariant(simpleVariant);
  const [form, setForm] = useState<ProductGeneralForm>(original);
  const [codes, setCodes] = useState<VariantCodesForm>(originalCodes);
  const [skuError, setSkuError] = useState<string | null>(null);
  const [variantSkuError, setVariantSkuError] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const set = <K extends keyof ProductGeneralForm>(key: K, value: ProductGeneralForm[K]) => setForm((prev) => ({ ...prev, [key]: value }));

  const productDraft = buildProductPatch(original, form);
  const codesDraft = simpleVariant ? buildVariantPatch(originalCodes, codes) : { patch: {}, errors: [] };
  const dirty = !isEmptyPatch(productDraft.patch) || !isEmptyPatch(codesDraft.patch) || productDraft.errors.length > 0 || codesDraft.errors.length > 0;

  const onPhoto = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try {
      set("imageUrl", await uploadImage(file));
    } catch (error) {
      toast.error(error instanceof Error && error.message ? error.message : "No se pudo subir la foto.");
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    setSkuError(null);
    setVariantSkuError(null);
    const problems = [...productDraft.errors, ...codesDraft.errors];
    setErrors(problems);
    if (problems.length) return;
    setSaving(true);
    let saved = false;
    try {
      if (!isEmptyPatch(productDraft.patch)) {
        try {
          await updateCatalogProduct(product.id, productDraft.patch);
          saved = true;
        } catch (error) {
          const info = apiErrorInfo(error, "No se pudo guardar el producto.");
          if (info.conflict && "companySku" in productDraft.patch) setSkuError(info.message);
          else setErrors([info.message]);
          return;
        }
      }
      if (simpleVariant && !isEmptyPatch(codesDraft.patch)) {
        try {
          await updateCatalogVariant(simpleVariant.id, codesDraft.patch);
          saved = true;
        } catch (error) {
          const info = apiErrorInfo(error, "No se pudo guardar el SKU o el código de barras.");
          if (info.conflict) setVariantSkuError(info.message);
          else setErrors([info.message]);
          return;
        }
      }
      if (saved) toast.success("Cambios guardados");
    } finally {
      setSaving(false);
      if (saved) {
        void queryClient.invalidateQueries({ queryKey: ["catalog-product", product.companyId, product.id] });
        void queryClient.invalidateQueries({ queryKey: ["catalog-product-variants", product.id] });
        void queryClient.invalidateQueries({ queryKey: ["business-product-catalog"] });
      }
    }
  };

  const disabled = !canEdit || saving;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start gap-4">
        <ProductThumb src={form.imageUrl} name={form.name || product.name} size={96} />
        <div className="space-y-2">
          <p className="font-medium">Foto principal</p>
          <p className="text-xs text-muted-foreground">JPG, PNG o WEBP, hasta 5 MB. Se usa en la lista, el reporte y los canales. Cada variante puede tener su propia foto.</p>
          {canEdit ? (
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" asChild disabled={uploading || saving}>
                <label className="cursor-pointer">
                  {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ImagePlus className="mr-2 h-4 w-4" />}
                  {form.imageUrl ? "Cambiar foto" : "Subir foto"}
                  <input type="file" accept="image/*" className="hidden" aria-label="Foto principal" onChange={(event) => void onPhoto(event.target.files?.[0])} />
                </label>
              </Button>
              {form.imageUrl ? <Button type="button" variant="ghost" size="sm" onClick={() => set("imageUrl", "")}>Quitar foto</Button> : null}
            </div>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="ficha-name">Nombre</Label>
          <Input id="ficha-name" value={form.name} disabled={disabled} onChange={(event) => set("name", event.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ficha-sku">SKU base</Label>
          <Input id="ficha-sku" className="font-mono" value={form.companySku} disabled={disabled} maxLength={50} aria-invalid={Boolean(skuError)} onChange={(event) => { set("companySku", event.target.value); setSkuError(null); }} />
          {product.skuConflict ? <p className="flex items-center gap-2 text-xs text-red-700"><SkuConflictBadge /> Otro producto de tu empresa tiene este SKU base: cámbialo.</p> : null}
          {skuError ? <p role="alert" className="text-xs text-red-600">{skuError}</p> : <p className="text-xs text-muted-foreground">Único en tu empresa. Si lo dejas vacío no se usa SKU base.</p>}
        </div>
        <BrandSelect value={form.brandId} disabled={disabled} onChange={(brandId) => set("brandId", brandId)} />
        <div className="space-y-2">
          <Label htmlFor="ficha-category">Categoría</Label>
          <CategoryTreeSelect id="ficha-category" tree={categoryTree} value={form.categoryId} disabled={disabled} onChange={(value) => set("categoryId", value)} />
          <p className="text-xs text-muted-foreground">Las categorías de tu catálogo se administran en Catálogo › Categorías.</p>
        </div>
        <div className="grid grid-cols-[1fr_7rem] gap-2">
          <div className="space-y-2">
            <Label htmlFor="ficha-purchase-unit">Unidad de compra</Label>
            <Input id="ficha-purchase-unit" placeholder="Unidad" value={form.purchaseUnit} disabled={disabled} maxLength={30} onChange={(event) => set("purchaseUnit", event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ficha-purchase-factor">Factor</Label>
            <Input id="ficha-purchase-factor" inputMode="numeric" value={form.purchaseFactor} disabled={disabled} onChange={(event) => set("purchaseFactor", event.target.value)} />
          </div>
          <p className="col-span-2 text-xs text-muted-foreground">Ej.: Caja × 12. Vacío = se compra por unidad.</p>
        </div>
        {simpleVariant ? (
          <>
            <div className="space-y-2">
              <Label htmlFor="ficha-variant-sku">SKU</Label>
              <Input id="ficha-variant-sku" className="font-mono" value={codes.companySku} disabled={disabled} maxLength={60} aria-invalid={Boolean(variantSkuError)} onChange={(event) => { setCodes((prev) => ({ ...prev, companySku: event.target.value })); setVariantSkuError(null); }} />
              {simpleVariant.skuConflict ? <p className="flex items-center gap-2 text-xs text-red-700"><SkuConflictBadge /> Otra variante de tu empresa tiene este SKU: cámbialo.</p> : null}
              {variantSkuError ? <p role="alert" className="text-xs text-red-600">{variantSkuError}</p> : <p className="text-xs text-muted-foreground">Es el que se escanea y se ve en pedidos y compras.</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="ficha-barcode">Código de barras</Label>
              <Input id="ficha-barcode" className="font-mono" value={codes.barcode} disabled={disabled} maxLength={64} onChange={(event) => setCodes((prev) => ({ ...prev, barcode: event.target.value }))} />
              <p className="text-xs text-muted-foreground">{simpleVariant.powipEan ? `EAN de fábrica. Si no tiene, se usa el de POWIP: ${simpleVariant.powipEan}.` : "EAN de fábrica (opcional)."}</p>
            </div>
            {costs ? (
              <div className="space-y-2 md:col-span-2">
                {costs.byVariant === "error" ? <p className="text-xs text-muted-foreground">No se pudo leer el costo promedio.</p> : (
                  <VariantCostField variantId={simpleVariant.id} cost={costs.byVariant === undefined ? undefined : costs.byVariant.get(simpleVariant.id) ?? null} canEdit={costs.canEdit} onSaved={(cost) => costs.onSaved(simpleVariant.id, cost)} />
                )}
              </div>
            ) : null}
          </>
        ) : null}
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="ficha-description">Descripción</Label>
          <Textarea id="ficha-description" rows={3} value={form.description} disabled={disabled} onChange={(event) => set("description", event.target.value)} />
        </div>
      </div>

      {errors.length ? <div role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">{errors.map((error) => <p key={error}>{error}</p>)}</div> : null}
      {canEdit ? (
        <div className="flex items-center justify-end gap-3">
          {dirty ? <span className="text-xs text-muted-foreground">Hay cambios sin guardar</span> : null}
          <Button type="button" onClick={() => void save()} disabled={saving || uploading || !dirty}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Guardar cambios
          </Button>
        </div>
      ) : null}
    </div>
  );
}
