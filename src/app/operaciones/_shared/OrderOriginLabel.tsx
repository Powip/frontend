export function OrderOriginLabel({ storeId, storeName, stockStoreName }: { storeId?: string | null; storeName?: string; stockStoreName?: string }) {
  if (!storeId) return null;
  return <span className="block text-[10px] font-normal text-muted-foreground">{storeName || "Tienda de origen"}{stockStoreName && stockStoreName !== storeName ? ` · Almacén ${stockStoreName}` : ""}</span>;
}
