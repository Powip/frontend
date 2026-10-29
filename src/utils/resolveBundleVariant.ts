import type { BundleProductRef } from "@/interfaces/IPack";
import type { InventoryItemForSale } from "@/interfaces/IProduct";
import axiosAuth from "@/lib/axiosAuth";
import { GATEWAY } from "@/lib/gateway";
import { searchInventoryItems } from "@/services/inventoryItems.service";

type VariantMetadata = {
  id: string;
  sku?: string;
  isActive?: boolean;
  product?: { name?: string; companyId?: string; status?: boolean };
};

type VariantPage = {
  data: InventoryItemForSale[];
  meta?: { totalPages: number };
};

type BundleVariantScope = {
  inventoryId?: string;
  companyId?: string;
  /** Quotations use the store-scoped catalog, which exposes no pagination. */
  search?: (query: string, page: number) => Promise<VariantPage>;
};

/**
 * Resolve exact references against current catalog metadata and current stock.
 * The saved name/SKU is display metadata only. Legacy selection stays with the
 * caller so sales and quotations retain their different stock policies.
 */
export async function resolveBundleVariant(
  ref: BundleProductRef,
  scope: BundleVariantScope,
): Promise<InventoryItemForSale | null> {
  if (typeof ref.variantId !== "string" || !ref.variantId.trim()) return null;
  if (!scope.search && !scope.inventoryId) return null;

  const { data: variant } = await axiosAuth.get<VariantMetadata>(
    `${GATEWAY.products}/product-variant/${encodeURIComponent(ref.variantId)}`,
  );
  if (
    variant.id !== ref.variantId ||
    variant.isActive === false ||
    variant.product?.status === false ||
    (scope.companyId && variant.product?.companyId !== scope.companyId)
  ) return null;

  const query = variant.sku?.trim() || variant.product?.name?.trim();
  if (!query) return null;
  const search = scope.search ?? ((q: string, page: number) =>
    searchInventoryItems({
      inventoryId: scope.inventoryId!,
      companyId: scope.companyId,
      q,
      page,
      limit: 100,
    }));

  let page = 1;
  let totalPages = 1;
  do {
    const result = await search(query, page);
    const exact = result.data.find((item) => item.variantId === ref.variantId);
    // Return the inventory row intact, including tracking mode and attributes.
    if (exact) return exact;
    totalPages = result.meta?.totalPages ?? 1;
    page += 1;
  } while (page <= totalPages);
  return null;
}
