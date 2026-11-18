import SuggestedPurchaseView from "@/components/compras/suggested/SuggestedPurchaseView";
import { suggestedFiltersFrom } from "@/lib/suggestedPurchase";

/**
 * FEAT-24 H13-D3 — Compras › Pedido sugerido. Los filtros pueden llegar en la URL (`inventoryId`, `days`,
 * `targetDays`, `supplierId`, `includeWithoutSales=true`): así lo abre el atajo «Crear compra» de la alerta
 * «Bajo mínimo».
 */
export default async function PedidoSugeridoPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const one = Object.fromEntries(Object.entries(params).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value]));
  return <SuggestedPurchaseView initialFilters={suggestedFiltersFrom(one)} />;
}
