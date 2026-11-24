import ProductFicha from "@/components/catalog/ficha/ProductFicha";
import { fichaTabFromQuery } from "@/lib/catalog/fichaTabs";

/**
 * FEAT-24 H4 — ficha del producto en pestañas (Catálogo › Productos › ficha).
 * FEAT-32 M7: `?tab=contenido` (u otra pestaña) abre la ficha en esa pestaña.
 */
export default async function ProductoFichaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const { tab } = await searchParams;
  return <ProductFicha productId={id} initialTab={fichaTabFromQuery(tab)} />;
}
