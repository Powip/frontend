import InventarioView from "../_components/InventarioView";

/** `?q=` llega desde Stock («Ver movimientos» de una variante) y precarga el buscador. */
export default async function InventarioMovimientosPage({ searchParams }: { searchParams: Promise<{ q?: string | string[] }> }) {
  const { q } = await searchParams;
  return <InventarioView tab="movimientos" initialMovementSearch={typeof q === "string" ? q : ""} />;
}
