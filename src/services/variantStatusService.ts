import axiosAuth from "@/lib/axiosAuth";
import { GATEWAY } from "@/lib/gateway";

/** FEAT-24 H0 — una variante guardada no se borra: se desactiva o se vuelve a activar. */
export async function setVariantActive(variantId: string, isActive: boolean): Promise<void> {
  await axiosAuth.patch(
    `${process.env.NEXT_PUBLIC_API_PRODUCTOS || GATEWAY.products}/product-variant/${encodeURIComponent(variantId)}`,
    { isActive },
  );
}
