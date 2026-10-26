"use client";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import type { AdsProduct } from "@/services/advertisingV22Service";
import type { AdsSummaryV23, AdsSalesV23, SalesRowV23 } from "@/services/advertisingV23Service";
import { allocateV23Sales, spendV23 } from "./v23-model";
import { money, numeric, pct, ratio, summarySpendAvailable } from "./model";
import { Block, Failure, exportAdsWorkbook } from "./shared";

const sumAmount = (rows: SalesRowV23[], key: keyof SalesRowV23) => {
  const values = rows.map((row) => numeric(row[key] as string | number | null | undefined));
  return values.some((value) => value === null)
    ? null
    : values.reduce<number>((sum, value) => sum + value!, 0);
};
export function productRowsV23(
  summary: AdsSummaryV23,
  sales: AdsSalesV23,
  products: AdsProduct[],
  storeId: string,
  accountId = "all",
) {
  const productSales = allocateV23Sales(sales.byProduct, summary, sales.daily).filter(
    (row) =>
      (row.channelFamily === "messages" || row.channelFamily === "web") &&
      (storeId === "all" || row.storeId === storeId) &&
      (accountId === "all" || row.accountId === accountId),
  );
  const days = summary.days.filter(
    (day) =>
      (storeId === "all" || day.storeId === storeId) &&
      (accountId === "all" || day.accountId === accountId),
  );
  const assignment = new Map(
    summary.adProducts.map((item) => [JSON.stringify([item.accountId, item.adId]), item]),
  );
  const groups = new Map<string, { productId: string; storeId: string }>();
  const add = (productId: string | null | undefined, selectedStore: string | null | undefined) => {
    if (
      productId &&
      productId !== "varios" &&
      selectedStore &&
      (storeId === "all" || selectedStore === storeId)
    )
      groups.set(JSON.stringify([productId, selectedStore]), { productId, storeId: selectedStore });
  };
  for (const row of productSales) add(row.productId, row.storeId);
  for (const day of days)
    add(assignment.get(JSON.stringify([day.accountId, day.adId]))?.productId, day.storeId);
  for (const product of products)
    if (summary.stores.some((store) => store.id === product.storeId))
      add(product.id, product.storeId);
  return [...groups.values()]
    .map((scope) => {
      const product = products.find((item) => item.id === scope.productId);
      const own = productSales.filter(
        (row) => row.productId === scope.productId && row.storeId === scope.storeId,
      );
      const adDays = days.filter(
        (day) =>
          day.storeId === scope.storeId &&
          assignment.get(JSON.stringify([day.accountId, day.adId]))?.productId === scope.productId,
      );
      const adCount = new Set(adDays.map((day) => JSON.stringify([day.accountId, day.adId]))).size;
      const spend = spendV23(summary, adDays, scope.storeId, accountId);
      const deliveredUnits = own.reduce((sum, row) => sum + row.deliveredUnits, 0);
      const eligibleUnits = own.reduce(
        (sum, row) => sum + (row.eligibleDeliveredUnits ?? row.eligibleBilledUnits ?? 0),
        0,
      );
      const missingCosts = own.reduce((sum, row) => sum + row.missingCostOrders, 0);
      const revenue = sumAmount(own, "deliveredRevenue");
      const eligibleRevenue = sumAmount(own, "eligibleRevenue"),
        productCost = sumAmount(own, "eligibleProductCost"),
        shippingCost = sumAmount(own, "eligibleShippingCost");
      const historicalCosts =
        own.length > 0 &&
        eligibleUnits > 0 &&
        eligibleRevenue !== null &&
        productCost !== null &&
        shippingCost !== null;
      const contribution = historicalCosts ? eligibleRevenue! - productCost! - shippingCost! : null;
      const gain = contribution !== null && spend !== null ? contribution - spend : null;
      const usage = ratio(spend, contribution);
      const catalogCostKnown =
        numeric(product?.unitCost) !== null ||
        product?.variants.some((variant) => numeric(variant.unitCost) !== null);
      return {
        ...scope,
        name: product?.name ?? own.find((row) => row.productName)?.productName ?? "Producto",
        storeName: summary.stores.find((store) => store.id === scope.storeId)?.name ?? "Tienda",
        adCount,
        spend,
        deliveredUnits,
        costUnit: ratio(spend, deliveredUnits),
        netPrice: ratio(revenue, deliveredUnits),
        costAndShipping: historicalCosts
          ? ratio(productCost! + shippingCost!, eligibleUnits)
          : null,
        gainUnit: ratio(gain, eligibleUnits),
        usage,
        missingCosts,
        noCost: !historicalCosts,
        reason: !catalogCostKnown
          ? "Carga el costo del producto."
          : !historicalCosts
            ? "Faltan costos históricos de las unidades entregadas. El costo actual no reemplaza el costo de la venta."
            : missingCosts > 0
              ? `${missingCosts} pedidos sin costo histórico se excluyen de la ganancia.`
              : "Ganancia calculada con precios netos y costos guardados al vender.",
        estimated: true,
        catalogCostKnown,
      };
    })
    .sort((a, b) => (b.spend ?? 0) - (a.spend ?? 0) || a.name.localeCompare(b.name));
}
export function ProductsV23({
  summary,
  sales,
  products,
  storeId,
  accountId = "all",
  canSpend,
  canProfit,
}: {
  summary: AdsSummaryV23;
  sales: AdsSalesV23;
  products: AdsProduct[];
  storeId: string;
  accountId?: string;
  canSpend: boolean;
  canProfit: boolean;
}) {
  const [error, setError] = useState<unknown>(null);
  const rows = useMemo(
    () => productRowsV23(summary, sales, products, storeId, accountId),
    [summary, sales, products, storeId, accountId],
  );
  const assignments = new Map(
    summary.adProducts.map((item) => [JSON.stringify([item.accountId, item.adId]), item.productId]),
  );
  const unassignedDays = summary.days.filter(
    (day) =>
      (storeId === "all" || day.storeId === storeId) &&
      (accountId === "all" || day.accountId === accountId) &&
      (!assignments.get(JSON.stringify([day.accountId, day.adId])) ||
        assignments.get(JSON.stringify([day.accountId, day.adId])) === "varios"),
  );
  const unassignedAds = new Set(
    unassignedDays.map((day) => JSON.stringify([day.accountId, day.adId])),
  ).size;
  const unassignedSpend = unassignedDays.some((day) => numeric(day.spend) === null)
    ? null
    : unassignedDays.reduce((sum, day) => sum + (numeric(day.spend) ?? 0), 0);
  return (
    <Block
      title="Costo por producto"
      tools={
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            void exportAdsWorkbook(`POWIP_Publicidad_Productos_${summary.from}_${summary.to}`, [
              {
                name: "Costo por producto",
                rows: rows.map((row) => ({
                  Producto: row.name,
                  Tienda: row.storeName,
                  "N° anuncios": row.adCount,
                  ...(canSpend ? { Gasto: row.spend, "Costo por unidad": row.costUnit } : {}),
                  "Unidades entregadas": row.deliveredUnits,
                  "Precio neto": row.netPrice,
                  ...(canProfit
                    ? {
                        "Costo + envío por unidad": row.costAndShipping,
                        "Ganancia por unidad": row.gainUnit,
                        "La publicidad se lleva del margen": row.usage,
                      }
                    : {}),
                  Base: "Estimado",
                  Observaciones: row.reason,
                })),
              },
            ]).catch(setError)
          }
        >
          ↓ Excel
        </Button>
      }
    >
      <p className="mb-3 text-xs text-muted-foreground">
        ◐ Estimado · El gasto usa el producto asignado a cada anuncio. Las unidades y sus costos
        conservan la tienda de la venta y el precio neto sin envío cobrado.
      </p>
      {error != null && <Failure error={error} />}
      <div className="overflow-x-auto">
        <table className="w-full text-sm [&_td]:p-3 [&_th]:p-3">
          <thead className="bg-muted/60">
            <tr>
              {[
                "Producto",
                "Tienda",
                "N° anuncios",
                ...(canSpend ? ["Gasto"] : []),
                "Unidades entregadas",
                ...(canSpend ? ["Costo por unidad"] : []),
                "Precio neto",
                ...(canProfit
                  ? [
                      "Costo + envío por unidad",
                      "Ganancia por unidad",
                      "La publicidad se lleva del margen",
                    ]
                  : []),
              ].map((label) => (
                <th className="whitespace-nowrap text-left text-xs" key={label}>
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                className={`border-t ${row.adCount === 0 ? "text-muted-foreground" : ""}`}
                key={`${row.productId}:${row.storeId}`}
              >
                <td className="min-w-44">
                  <span className="font-medium">{row.name}</span>
                  {canProfit && row.noCost && (
                    <span className="block text-xs" title={row.reason}>
                      {row.catalogCostKnown ? "— sin costo histórico" : "— sin costo"} ·{" "}
                      <a className="text-primary underline" href="/productos">
                        Carga el costo
                      </a>
                    </span>
                  )}
                  {canProfit && row.missingCosts > 0 && (
                    <span className="block text-xs text-amber-700" title={row.reason}>
                      {row.missingCosts} pedidos sin costo excluidos
                    </span>
                  )}
                </td>
                <td>{row.storeName}</td>
                <td>{row.adCount}</td>
                {canSpend && <td>{money(row.spend)}</td>}
                <td>
                  {new Intl.NumberFormat("es-PE", { maximumFractionDigits: 2 }).format(
                    row.deliveredUnits,
                  )}
                </td>
                {canSpend && (
                  <td
                    title={
                      row.deliveredUnits === 0
                        ? "No hay unidades entregadas en este grupo."
                        : undefined
                    }
                  >
                    {money(row.costUnit)}
                  </td>
                )}
                <td title="Precio neto histórico por unidad entregada; excluye envío cobrado.">
                  {money(row.netPrice)}
                </td>
                {canProfit && (
                  <>
                    <td title={row.reason}>{money(row.costAndShipping)}</td>
                    <td
                      title={row.reason}
                      className={row.gainUnit !== null && row.gainUnit < 0 ? "text-red-600" : ""}
                    >
                      {money(row.gainUnit)}
                    </td>
                    <td
                      title={row.reason}
                      className={
                        row.usage === null
                          ? ""
                          : row.usage > 1
                            ? "text-red-600"
                            : row.usage >= 0.7
                              ? "text-amber-600"
                              : "text-emerald-600"
                      }
                    >
                      {pct(row.usage)}
                      {row.usage !== null && (
                        <progress
                          aria-label={`${row.name}: publicidad sobre margen`}
                          className="block h-2 w-28"
                          max={1}
                          value={Math.min(1, row.usage)}
                        />
                      )}
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length === 0 && (
        <p className="p-4 text-sm text-muted-foreground">No hay productos en este ámbito.</p>
      )}
      {unassignedAds > 0 && (
        <p className="mt-3 rounded-md bg-amber-50 p-3 text-sm text-amber-900">
          Anuncios sin producto o de catálogo: {unassignedAds}
          {canSpend ? ` · ${money(unassignedSpend)}` : ""} ·{" "}
          <a
            className="underline"
            href={`/publicidad/configuracion?section=products&storeId=${storeId}&adAccountId=${accountId}`}
          >
            Asignar producto →
          </a>
        </p>
      )}
    </Block>
  );
}
