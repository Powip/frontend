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
 * Renombrar un SKU en cuarentena (PATCH del SKU; el servidor lo saca de la cuarentena y responde 409
 * si el SKU nuevo también está tomado). Lo usan este panel y los grupos de «SKU repetido» de la
 * Unificación (FEAT-24 H11).
 */
export function SkuRenameField({ row, onSaved }: { row: SkuConflictRow; onSaved?: () => void | Promise<void> }) {
  const { auth } = useAuth();
  const companyId = auth?.company?.id;
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const name = `${row.productName} · ${row.label}`;
  const max = row.kind === "product" ? PRODUCT_SKU_MAX : VARIANT_SKU_MAX;

  const rename = async () => {
    const next = draft.trim().replace(/\s+/g, " ");
    const problem = !next ? "Escribe el SKU nuevo."
      : skuKey(next) === skuKey(row.sku) ? "Escribe un SKU distinto al actual."
      : next.length > max ? `El SKU tiene más de ${max} caracteres.` : null;
    if (problem) {
      setError(problem);
      return;
    }
    setSaving(true);
    setError("");
    try {
      if (row.kind === "product") await updateCatalogProduct(row.id, { companySku: next });
      else await updateCatalogVariant(row.id, { companySku: next });
      toast.success(`SKU de «${row.productName}» cambiado a ${next}`);
      setDraft("");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["business-product-catalog"] }),
        queryClient.invalidateQueries({ queryKey: ["catalog-product", companyId, row.productId] }),
        queryClient.invalidateQueries({ queryKey: ["catalog-product-variants", row.productId] }),
        queryClient.invalidateQueries({ queryKey: ["unification-sku-conflicts"] }),
      ]);
      await onSaved?.();
    } catch (err) {
      setError(apiErrorInfo(err, "No se pudo cambiar el SKU.").message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-w-[220px]">
      <div className="flex items-center gap-2">
        <Input
          aria-label={`SKU nuevo de ${name}`}
          className="h-8 font-mono"
          maxLength={max}
          value={draft}
          disabled={saving}
          onChange={(event) => {
            setDraft(event.target.value);
            setError("");
          }}
        />
        <Button size="sm" aria-label={`Guardar SKU de ${name}`} disabled={saving} onClick={() => void rename()}>
          {saving ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
          Guardar
        </Button>
      </div>
      {error ? <p role="alert" className="mt-1 text-xs text-red-600">{error}</p> : null}
    </div>
  );
}

/**
 * FEAT-24 H4 — Unificación › «SKU repetido»: productos y variantes que quedaron en cuarentena porque su
 * SKU ya lo usaba otra variante o producto de la empresa. Se renombran aquí.
 * Lee `GET /products/report` (misma consulta que el listado del catálogo).
 * FEAT-24 H11: las variantes ya salen agrupadas en «Por unificar» (`GET /reconciliation-tasks/sku-conflicts`),
 * así que la Unificación usa este panel solo para el SKU base de los productos (`kinds={["product"]}`).
 */
export default function SkuConflictsPanel({ companyId, kinds }: { companyId?: string; kinds?: Array<SkuConflictRow["kind"]> }) {
  const { auth } = useAuth();
  const accessToken = auth?.accessToken;
  const catalog = useQuery({
    queryKey: ["business-product-catalog", companyId, auth?.user?.id],
    queryFn: ({ signal }) => fetchBusinessProducts({ companyId: companyId!, accessToken: accessToken!, signal }),
    enabled: Boolean(companyId && accessToken),
    retry: false,
  });
  const rows = useMemo(
    () => skuConflictRows(catalog.data ?? []).filter((row) => !kinds || kinds.includes(row.kind)),
    [catalog.data, kinds],
  );
  const onlyProducts = kinds?.length === 1 && kinds[0] === "product";

  if (catalog.isError) {
    return <p role="alert" className="mb-4 text-sm text-muted-foreground">No se pudieron revisar los SKU repetidos. <Button variant="outline" size="sm" onClick={() => void catalog.refetch()}>Reintentar</Button></p>;
  }
  if (rows.length === 0) return null;

  return (
    <section aria-labelledby="sku-conflicts-title" className="mb-6 rounded-lg border border-amber-300 bg-amber-50/40 p-4 dark:bg-amber-950/10">
      <h3 id="sku-conflicts-title" className="flex items-center gap-2 font-semibold">
        <AlertTriangle className="h-4 w-4 text-amber-600" />
        {onlyProducts ? "SKU base repetido" : "SKU repetido"} ({rows.length})
      </h3>
      <p className="mb-3 mt-1 text-sm text-muted-foreground">
        {onlyProducts
          ? "Estos SKU base ya los usaba otro producto de tu empresa. Ponles un SKU nuevo para que no se confundan."
          : "Estos SKU ya los usaba otro producto o variante de tu empresa. Ponles un SKU nuevo para que no se confundan (o unifícalos abajo si son el mismo artículo)."}
      </p>
      <div className="overflow-auto rounded-md border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Producto</TableHead>
              <TableHead>Qué</TableHead>
              <TableHead>SKU actual</TableHead>
              <TableHead className="min-w-[280px]">SKU nuevo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={`${row.kind}-${row.id}`}>
                <TableCell className="text-sm font-medium"><Link className="hover:underline" href={productFichaHref(row.productId)}>{row.productName}</Link></TableCell>
                <TableCell className="text-sm">{row.label}</TableCell>
                <TableCell className="font-mono text-xs">{row.sku || "—"}</TableCell>
                <TableCell><SkuRenameField row={row} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}
