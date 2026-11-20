"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { warehouseErrorMessage } from "@/components/forms/warehouseUi";
import { useAuth } from "@/contexts/AuthContext";
import { sortBySupplierPrice } from "@/lib/supplierPrices";
import { getSupplierPrices } from "@/services/suggestedPurchaseService";
import { SELECT_CLASS } from "../PurchaseBits";
import SupplierPricesTable from "./SupplierPricesTable";

// FEAT-24 H13-D4 — ficha del producto › «Precio de compra por proveedor»: por
// cada variante (se elige arriba), lo que se le pagó a cada proveedor: último,
// promedio, mínimo y fechas. Sirve para negociar o cambiar de proveedor.

interface Props {
  /** Variantes del producto (sin las unificadas). */
  variants: Array<{ id: string; label: string }>;
  /** Enlaza la última compra a su OC (quien entra a Compras). */
  linkOrders?: boolean;
}

export default function FichaSupplierPrices({ variants, linkOrders = false }: Props) {
  const { auth } = useAuth();
  const companyId = auth?.company?.id ?? "";
  const [picked, setPicked] = useState("");
  const variantId = variants.some((variant) => variant.id === picked) ? picked : variants[0]?.id ?? "";

  const pricesQuery = useQuery({
    queryKey: ["supplier-prices", companyId, "variant", variantId],
    queryFn: ({ signal }) => getSupplierPrices({ variantId }, signal),
    enabled: !!companyId && !!variantId,
    retry: false,
    staleTime: 60_000,
  });
  const rows = sortBySupplierPrice((pricesQuery.data?.items ?? []).filter((row) => row.variantId === variantId));

  if (variants.length === 0) return null;
  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <CardTitle className="flex items-center gap-2 text-base">
          <Building2 className="h-4 w-4" aria-hidden="true" />
          Precio de compra por proveedor
        </CardTitle>
        {variants.length > 1 ? (
          <div className="flex items-center gap-2">
            <Label htmlFor="ficha-supplier-prices-variant" className="text-sm font-normal">
              Variante
            </Label>
            <select
              id="ficha-supplier-prices-variant"
              className={`${SELECT_CLASS} md:w-72`}
              value={variantId}
              onChange={(e) => setPicked(e.target.value)}
            >
              {variants.map((variant) => (
                <option key={variant.id} value={variant.id}>
                  {variant.label}
                </option>
              ))}
            </select>
          </div>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-2">
        {pricesQuery.error ? (
          <div role="alert" className="flex flex-wrap items-center gap-2 text-sm text-destructive">
            {warehouseErrorMessage(pricesQuery.error, "No se pudieron cargar los precios de compra.")}
            <Button type="button" size="sm" variant="outline" onClick={() => void pricesQuery.refetch()}>
              Reintentar
            </Button>
          </div>
        ) : pricesQuery.isPending ? (
          <p role="status" className="text-sm text-muted-foreground">
            Cargando precios de compra…
          </p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Todavía no hay compras emitidas o recibidas de esta variante.</p>
        ) : (
          <SupplierPricesTable rows={rows} by="supplier" linkOrders={linkOrders} />
        )}
        <p className="text-xs text-muted-foreground">
          Costo sin IGV por unidad, de las órdenes de compra emitidas o recibidas (sin borradores ni anuladas).
        </p>
      </CardContent>
    </Card>
  );
}
