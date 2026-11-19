"use client";

import Link from "next/link";
import { formatDay } from "@/lib/purchaseOrders";
import { purchaseOrderHref } from "@/lib/suggestedPurchase";
import { bestPriceSupplierId } from "@/lib/supplierPrices";
import type { SupplierPrice } from "@/services/suggestedPurchaseService";
import { Money } from "../PurchaseBits";

// FEAT-24 H13-D4 — tabla del precio de compra por proveedor: por proveedor (en la
// ficha del producto, una variante) o por producto (en el detalle del proveedor).
// Costos netos (sin IGV) por unidad de stock; «••••» si el rol no los ve.

interface Props {
  rows: SupplierPrice[];
  /** `supplier`: una fila por proveedor (ficha). `product`: una fila por variante (proveedor). */
  by: "supplier" | "product";
  /** Enlaza el número de la última compra a su OC (solo quien entra a Compras). */
  linkOrders?: boolean;
}

export default function SupplierPricesTable({ rows, by, linkOrders = false }: Props) {
  const best = by === "supplier" ? bestPriceSupplierId(rows) : null;
  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-xs text-muted-foreground">
          <tr>
            <th className="p-2 text-left">{by === "supplier" ? "Proveedor" : "Producto"}</th>
            <th className="p-2 text-right">Último precio</th>
            <th className="p-2 text-right" title="Ponderado por unidades">Promedio</th>
            <th className="p-2 text-right">Más bajo</th>
            <th className="p-2 text-right">Más alto</th>
            <th className="p-2 text-right">Compras</th>
            <th className="p-2 text-right">Unidades</th>
            <th className="p-2 text-left">Primera compra</th>
            <th className="p-2 text-left">Última compra</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.variantId}:${row.supplierId}`} className="border-t" data-testid={`supplier-price-${by === "supplier" ? row.supplierId : row.variantId}`}>
              <td className="p-2">
                {by === "supplier" ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{row.supplierName ?? "Proveedor"}</span>
                    {best === row.supplierId ? (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">
                        Mejor precio
                      </span>
                    ) : null}
                    {row.supplierActive === false ? <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">Inactivo</span> : null}
                  </div>
                ) : (
                  <>
                    <div className="font-medium">{row.productName ?? "Producto sin nombre"}</div>
                    {row.sku ? <div className="font-mono text-xs text-muted-foreground">{row.sku}</div> : null}
                  </>
                )}
              </td>
              <td className="p-2 text-right">
                <Money value={row.lastUnitCost} decimals={4} />
              </td>
              <td className="p-2 text-right">
                <Money value={row.averageUnitCost} decimals={4} />
              </td>
              <td className="p-2 text-right">
                <Money value={row.minUnitCost} decimals={4} />
              </td>
              <td className="p-2 text-right">
                <Money value={row.maxUnitCost} decimals={4} />
              </td>
              <td className="p-2 text-right tabular-nums">{row.purchases}</td>
              <td className="p-2 text-right tabular-nums">{row.units.toLocaleString("es-PE")}</td>
              <td className="p-2 whitespace-nowrap">{formatDay(row.firstDate)}</td>
              <td className="p-2 whitespace-nowrap">
                {formatDay(row.lastDate)}
                {row.lastPurchaseNumber ? (
                  linkOrders && row.lastPurchaseOrderId ? (
                    <Link href={purchaseOrderHref(row.lastPurchaseOrderId)} className="ml-2 font-mono text-xs underline underline-offset-2">
                      {row.lastPurchaseNumber}
                    </Link>
                  ) : (
                    <span className="ml-2 font-mono text-xs text-muted-foreground">{row.lastPurchaseNumber}</span>
                  )
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
