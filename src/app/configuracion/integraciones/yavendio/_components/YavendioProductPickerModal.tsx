"use client";

import { useEffect, useState } from "react";
import { Loader2, AlertCircle, PackageSearch } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { getCompanyProducts, PowipProduct } from "@/services/productService";
import {
  syncYavendioProduct,
  CatalogSyncSummary,
} from "@/services/yavendioService";

export interface YavendioProductPickerModalProps {
  open: boolean;
  companyId: string;
  onClose: () => void;
  /** Se invoca con el resumen de la corrida al terminar — el modal se cierra solo. */
  onComplete: (summary: CatalogSyncSummary) => void;
}

/**
 * Modal de selección manual de productos para sincronizar a Yavendio.
 *
 * A diferencia del sync masivo (`syncYavendioCatalog`, filtra `status=true`
 * server-side), este modal muestra TODOS los productos (activos e inactivos)
 * y, al confirmar, recorre la selección EN SERIE con `syncYavendioProduct`
 * — es el único camino que propaga productos descontinuados a Yavendio.
 * Nunca usa `Promise.all` ni el endpoint de sync masivo, sin importar cuántos
 * productos estén tildados (decisión de diseño explícita del spec FEAT-13
 * Fase 3b, no es una optimización pendiente).
 */
export default function YavendioProductPickerModal({
  open,
  companyId: propCompanyId,
  onClose,
  onComplete,
}: YavendioProductPickerModalProps) {
  const { auth } = useAuth();
  const companyId = propCompanyId || auth?.company?.id || "";
  const token = auth?.accessToken ?? "";

  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [products, setProducts] = useState<PowipProduct[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    if (!open || !companyId || !token) return;

    setLoading(true);
    setLoadError(null);
    setProducts([]);
    setSelected(new Set());
    setSyncing(false);

    getCompanyProducts(token, companyId)
      .then((list) => setProducts(list))
      .catch(() => {
        setLoadError("No se pudo cargar el catálogo de productos.");
      })
      .finally(() => setLoading(false));
  }, [open, companyId, token]);

  const allSelected = products.length > 0 && selected.size === products.length;

  const toggleAll = (checked: boolean) => {
    setSelected(checked ? new Set(products.map((p) => p.id)) : new Set());
  };

  const toggleOne = (productId: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(productId);
      } else {
        next.delete(productId);
      }
      return next;
    });
  };

  const handleConfirm = async () => {
    if (!companyId || !token || selected.size === 0) return;

    const selectedProducts = products.filter((p) => selected.has(p.id));

    setSyncing(true);

    const summary: CatalogSyncSummary = {
      companyId,
      totalProducts: selectedProducts.length,
      created: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
      errors: [],
    };

    // Serie estricta: nunca Promise.all — mismo criterio que el spec exige
    // (evitar concurrencia contra la API de Yavendio, ver YavendioApiClient).
    for (const product of selectedProducts) {
      try {
        const result = await syncYavendioProduct(token, companyId, product.id);
        if (result.outcome === "created") summary.created += 1;
        else if (result.outcome === "updated") summary.updated += 1;
        else summary.skipped += 1;
      } catch (err: unknown) {
        summary.failed += 1;
        const axiosError = err as {
          response?: { data?: { message?: string } };
          message?: string;
        };
        const message =
          axiosError?.response?.data?.message ||
          axiosError?.message ||
          "Error desconocido al sincronizar el producto";
        summary.errors.push({
          productId: product.id,
          sku: product.sku,
          message,
        });
      }
    }

    setSyncing(false);
    onComplete(summary);
    onClose();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !syncing) onClose();
      }}
    >
      <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 dark:text-slate-100">
            <PackageSearch className="h-5 w-5 text-blue-500" />
            Elegir productos a sincronizar
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-500 dark:text-slate-400">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            <p className="text-sm">Cargando catálogo de productos...</p>
          </div>
        ) : loadError ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <AlertCircle className="h-10 w-10 text-red-400" />
            <p className="text-sm text-red-600 dark:text-red-400 text-center">
              {loadError}
            </p>
            <Button variant="outline" onClick={onClose}>
              Cerrar
            </Button>
          </div>
        ) : products.length === 0 ? (
          <div className="py-16 text-center text-sm text-slate-400 dark:text-slate-500">
            Esta empresa no tiene productos cargados en Powip.
          </div>
        ) : (
          <div className="flex flex-col gap-3 min-h-0">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Se muestran productos activos y descontinuados: sincronizar un
              producto descontinuado es la única forma de propagar esa baja a
              Yavendio.
            </p>

            <div className="flex items-center justify-between border-b dark:border-slate-700 pb-2">
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300 cursor-pointer select-none">
                <Checkbox
                  data-testid="yavendio-picker-select-all"
                  checked={allSelected}
                  onCheckedChange={(checked) => toggleAll(checked === true)}
                  disabled={syncing}
                />
                Seleccionar todos
              </label>
              <span className="text-xs text-slate-400 dark:text-slate-500">
                {selected.size} de {products.length} seleccionados
              </span>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto max-h-[45vh] space-y-1 pr-1">
              {products.map((product) => (
                <label
                  key={product.id}
                  data-testid={`yavendio-picker-row-${product.id}`}
                  className="flex items-center gap-3 rounded-lg border border-slate-100 dark:border-slate-700 px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                >
                  <Checkbox
                    checked={selected.has(product.id)}
                    onCheckedChange={(checked) =>
                      toggleOne(product.id, checked === true)
                    }
                    disabled={syncing}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">
                      {product.name}
                    </p>
                    <p className="text-[11px] font-mono text-slate-400 dark:text-slate-500">
                      {product.companySku || product.sku}
                    </p>
                  </div>
                  {product.status ? (
                    <Badge className="border-green-200 dark:border-emerald-800 bg-green-50 dark:bg-emerald-950/40 text-green-700 dark:text-emerald-400 shrink-0">
                      Activo
                    </Badge>
                  ) : (
                    <Badge className="border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 shrink-0">
                      Descontinuado
                    </Badge>
                  )}
                </label>
              ))}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t dark:border-slate-700">
              <Button variant="outline" onClick={onClose} disabled={syncing}>
                Cancelar
              </Button>
              <Button
                data-testid="yavendio-picker-confirm"
                onClick={handleConfirm}
                disabled={selected.size === 0 || syncing}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {syncing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Sincronizando...
                  </>
                ) : (
                  `Sincronizar seleccionados (${selected.size})`
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
