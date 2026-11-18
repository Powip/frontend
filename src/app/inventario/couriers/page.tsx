import InventarioView from "../_components/InventarioView";

const one = (value: string | string[] | undefined) => (typeof value === "string" && value ? value : undefined);

/**
 * FEAT-24 H8 — Inventario › Couriers. Desde las alertas llegan `?almacen=` (abre ese almacén courier) y
 * `?reclamo=` (abre el detalle del reclamo).
 */
export default async function InventarioCouriersPage({ searchParams }: { searchParams: Promise<{ almacen?: string | string[]; reclamo?: string | string[] }> }) {
  const { almacen, reclamo } = await searchParams;
  return <InventarioView tab="couriers" initialCourier={{ inventoryId: one(almacen), claimId: one(reclamo) }} />;
}
