import ProductFicha from "@/components/catalog/ficha/ProductFicha";

/** FEAT-24 H4 — ficha del producto en pestañas (Catálogo › Productos › ficha). */
export default async function ProductoFichaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ProductFicha productId={id} />;
}
