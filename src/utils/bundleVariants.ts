import type { BundlePack, BundleProductRef } from "@/interfaces/IPack";

type BundleLine = { variantId: string; productName: string };

/** A present but invalid variantId is never a product-wide legacy reference. */
export function bundleItemKey(ref: BundleProductRef): string {
  if ("variantId" in ref) {
    return typeof ref.variantId === "string" && ref.variantId.trim()
      ? `variant:${ref.variantId}`
      : "";
  }
  return typeof ref.productKey === "string" && ref.productKey.trim()
    ? `product:${ref.productKey}`
    : "";
}

export function matchesBundleItem(ref: BundleProductRef, line: BundleLine): boolean {
  if ("variantId" in ref) {
    return Boolean(bundleItemKey(ref)) && ref.variantId === line.variantId;
  }
  return Boolean(bundleItemKey(ref)) && ref.productKey === line.productName;
}

/** Legacy packs keep their existing product-wide scope; v2 must be fully exact. */
export function hasValidBundleItems(pack: Pick<BundlePack, "items" | "schemaVersion">): boolean {
  return (
    Array.isArray(pack.items) &&
    pack.items.length > 0 &&
    pack.items.every((ref) =>
      typeof ref === "object" && ref !== null && Boolean(bundleItemKey(ref)) &&
      (pack.schemaVersion !== 2 ||
        (typeof ref.variantId === "string" && ref.variantId.trim().length > 0)),
    )
  );
}

export function bundleItemLabel(ref: BundleProductRef): string {
  const attributes = Object.values(ref.attributes ?? {}).filter(Boolean).join(" · ");
  return [ref.productName, attributes || ref.sku].filter(Boolean).join(" · ");
}
