import InventarioView from "../_components/InventarioView";

const one = (value: string | string[] | undefined) => (typeof value === "string" ? value : "");

/**
 * Desde Stock («Ver movimientos» de una variante) llegan `?variantId=` y su nombre en `?q=`; un `?q=` solo con
 * un documento (ORD-, OC-…) precarga el filtro «Documento».
 */
export default async function InventarioMovimientosPage({ searchParams }: { searchParams: Promise<{ q?: string | string[]; variantId?: string | string[] }> }) {
  const { q, variantId } = await searchParams;
  return <InventarioView tab="movimientos" initialMovementSearch={one(q)} initialMovementVariantId={one(variantId) || undefined} />;
}
