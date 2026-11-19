"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { warehouseErrorMessage } from "@/components/forms/warehouseUi";
import { useAuth } from "@/contexts/AuthContext";
import { filterSupplierPrices } from "@/lib/supplierPrices";
import { getSupplierPrices } from "@/services/suggestedPurchaseService";
import type { PurchaseSupplier } from "@/services/purchasesService";
import SupplierPricesTable from "./SupplierPricesTable";

// FEAT-24 H13-D4 — Compras › Proveedores › «Productos que le compras»: cada
// variante que se le compró al proveedor con su último precio, el promedio, el
// mínimo y las fechas de la primera y la última compra.

interface Props {
  supplier: Pick<PurchaseSupplier, "id" | "name">;
  /** Enlaza la última compra a su OC (quien entra a Compras). */
  linkOrders?: boolean;
  onClose: () => void;
}

export default function SupplierPricesDialog({ supplier, linkOrders = false, onClose }: Props) {
  const { auth } = useAuth();
  const companyId = auth?.company?.id ?? "";
  const [query, setQuery] = useState("");
  const pricesQuery = useQuery({
    queryKey: ["supplier-prices", companyId, "supplier", supplier.id],
    queryFn: ({ signal }) => getSupplierPrices({ supplierId: supplier.id }, signal),
    enabled: !!companyId,
    retry: false,
    staleTime: 60_000,
  });
  const all = (pricesQuery.data?.items ?? []).filter((row) => row.supplierId === supplier.id);
  const rows = filterSupplierPrices(all, query);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>Productos que le compras a {supplier.name}</DialogTitle>
          <DialogDescription>Costo sin IGV por unidad, de las órdenes emitidas o recibidas (sin borradores ni anuladas).</DialogDescription>
        </DialogHeader>

        {all.length > 8 ? (
          <div className="relative md:w-80">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <Input className="pl-8" aria-label="Buscar producto" placeholder="Busca por nombre o SKU" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
        ) : null}

        {pricesQuery.error ? (
          <div role="alert" className="flex flex-wrap items-center gap-2 rounded-md border border-destructive/50 bg-destructive/5 p-3 text-sm text-destructive">
            {warehouseErrorMessage(pricesQuery.error, "No se pudieron cargar los productos de este proveedor.")}
            <Button type="button" size="sm" variant="outline" onClick={() => void pricesQuery.refetch()}>
              Reintentar
            </Button>
          </div>
        ) : pricesQuery.isPending ? (
          <p role="status" className="text-sm text-muted-foreground">
            Cargando productos…
          </p>
        ) : all.length === 0 ? (
          <p className="text-sm text-muted-foreground">Todavía no hay compras emitidas o recibidas a este proveedor.</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Ningún producto coincide con «{query}».</p>
        ) : (
          <SupplierPricesTable rows={rows} by="product" linkOrders={linkOrders} />
        )}
        {pricesQuery.data?.truncated ? (
          <p className="text-xs text-muted-foreground">Se muestran las primeras 5000 filas.</p>
        ) : null}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
