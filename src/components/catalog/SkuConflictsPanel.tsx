"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { fetchBusinessProducts } from "@/services/businessProductsService";
import { updateCatalogProduct, updateCatalogVariant } from "@/services/catalogProductService";
import { PRODUCT_SKU_MAX, VARIANT_SKU_MAX, apiErrorInfo, skuKey } from "@/lib/catalog/catalogPayloads";
import { skuConflictRows, type SkuConflictRow } from "@/lib/catalog/skuConflicts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { productFichaHref } from "./CatalogProductTable";

/**
 * FEAT-24 H4 — Unificación › «SKU repetido»: productos y variantes que quedaron en cuarentena porque su
 * SKU ya lo usaba otra variante o producto de la empresa. Se renombran aquí (PATCH del SKU; el
 * servidor los saca de la cuarentena y responde 409 si el SKU nuevo también está tomado).
 * Lee `GET /products/report` (misma consulta que el listado del catálogo): no hay endpoint propio.
 */
export default function SkuConflictsPanel({ companyId }: { companyId?: string }) {
  const { auth } = useAuth();
  const accessToken = auth?.accessToken;
  const queryClient = useQueryClient();
  const catalog = useQuery({
    queryKey: ["business-product-catalog", companyId, auth?.user?.id],
    queryFn: ({ signal }) => fetchBusinessProducts({ companyId: companyId!, accessToken: accessToken!, signal }),
    enabled: Boolean(companyId && accessToken),
    retry: false,
  });
  const rows = useMemo(() => skuConflictRows(catalog.data ?? []), [catalog.data]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  if (catalog.isError) {
    return <p role="alert" className="mb-4 text-sm text-muted-foreground">No se pudieron revisar los SKU repetidos. <Button variant="outline" size="sm" onClick={() => void catalog.refetch()}>Reintentar</Button></p>;
  }
  if (rows.length === 0) return null;

  const rename = async (row: SkuConflictRow) => {
    const next = (drafts[row.id] ?? "").trim().replace(/\s+/g, " ");
    const max = row.kind === "product" ? PRODUCT_SKU_MAX : VARIANT_SKU_MAX;
    const problem = !next ? "Escribe el SKU nuevo."
      : skuKey(next) === skuKey(row.sku) ? "Escribe un SKU distinto al actual."
      : next.length > max ? `El SKU tiene más de ${max} caracteres.` : null;
    if (problem) {
      setErrors((prev) => ({ ...prev, [row.id]: problem }));
      return;
    }
    setSavingId(row.id);
    setErrors((prev) => ({ ...prev, [row.id]: "" }));
    try {
      if (row.kind === "product") await updateCatalogProduct(row.id, { companySku: next });
      else await updateCatalogVariant(row.id, { companySku: next });
      toast.success(`SKU de «${row.productName}» cambiado a ${next}`);
      setDrafts((prev) => ({ ...prev, [row.id]: "" }));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["business-product-catalog"] }),
        queryClient.invalidateQueries({ queryKey: ["catalog-product", companyId, row.productId] }),
        queryClient.invalidateQueries({ queryKey: ["catalog-product-variants", row.productId] }),
      ]);
    } catch (err) {
      setErrors((prev) => ({ ...prev, [row.id]: apiErrorInfo(err, "No se pudo cambiar el SKU.").message }));
    } finally {
      setSavingId(null);
    }
  };

  return (
    <section aria-labelledby="sku-conflicts-title" className="mb-6 rounded-lg border border-amber-300 bg-amber-50/40 p-4 dark:bg-amber-950/10">
      <h3 id="sku-conflicts-title" className="flex items-center gap-2 font-semibold">
        <AlertTriangle className="h-4 w-4 text-amber-600" />
        SKU repetido ({rows.length})
      </h3>
      <p className="mb-3 mt-1 text-sm text-muted-foreground">
        Estos SKU ya los usaba otro producto o variante de tu empresa. Ponles un SKU nuevo para que no se confundan
        (o unifícalos abajo si son el mismo artículo).
      </p>
      <div className="overflow-auto rounded-md border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Producto</TableHead>
              <TableHead>Qué</TableHead>
              <TableHead>SKU actual</TableHead>
              <TableHead className="min-w-[220px]">SKU nuevo</TableHead>
              <TableHead className="w-28" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const name = `${row.productName} · ${row.label}`;
              return (
                <TableRow key={`${row.kind}-${row.id}`}>
                  <TableCell className="text-sm font-medium"><Link className="hover:underline" href={productFichaHref(row.productId)}>{row.productName}</Link></TableCell>
                  <TableCell className="text-sm">{row.label}</TableCell>
                  <TableCell className="font-mono text-xs">{row.sku || "—"}</TableCell>
                  <TableCell>
                    <Input
                      aria-label={`SKU nuevo de ${name}`}
                      className="h-8 font-mono"
                      maxLength={row.kind === "product" ? PRODUCT_SKU_MAX : VARIANT_SKU_MAX}
                      value={drafts[row.id] ?? ""}
                      disabled={savingId === row.id}
                      onChange={(event) => {
                        const value = event.target.value;
                        setDrafts((prev) => ({ ...prev, [row.id]: value }));
                        setErrors((prev) => ({ ...prev, [row.id]: "" }));
                      }}
                    />
                    {errors[row.id] ? <p role="alert" className="mt-1 text-xs text-red-600">{errors[row.id]}</p> : null}
                  </TableCell>
                  <TableCell>
                    <Button size="sm" aria-label={`Guardar SKU de ${name}`} disabled={savingId !== null} onClick={() => void rename(row)}>
                      {savingId === row.id ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
                      Guardar
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}
