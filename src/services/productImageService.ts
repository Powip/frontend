import axiosAuth from "@/lib/axiosAuth";
import { GATEWAY } from "@/lib/gateway";

const PRODUCT_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);
const MAX_PRODUCT_IMAGE_SIZE = 5 * 1024 * 1024;

export function validateProductImage(file: File): string | null {
  if (file.size === 0) return "La imagen está vacía. Selecciona otro archivo.";
  if (!PRODUCT_IMAGE_TYPES.has(file.type)) {
    return "Selecciona una imagen JPG, PNG, WebP o GIF.";
  }
  if (file.size > MAX_PRODUCT_IMAGE_SIZE) {
    return "La imagen no debe superar los 5 MB.";
  }
  return null;
}

export async function updateProductImage({
  productId,
  variantId,
  file,
}: {
  productId?: string;
  variantId: string;
  file: File;
}): Promise<string> {
  const validationError = validateProductImage(file);
  if (validationError) throw new Error(validationError);

  const apiProducts = (process.env.NEXT_PUBLIC_API_PRODUCTOS || GATEWAY.products).replace(/\/$/, "");
  let resolvedProductId = productId?.trim();
  if (!resolvedProductId) {
    if (!variantId.trim()) throw new Error("No se pudo identificar el producto.");
    const { data } = await axiosAuth.get<{ product?: { id?: string } }>(
      `${apiProducts}/product-variant/${encodeURIComponent(variantId)}`,
    );
    resolvedProductId = typeof data?.product?.id === "string" ? data.product.id.trim() : undefined;
    if (!resolvedProductId) throw new Error("No se pudo identificar el producto.");
  }

  const formData = new FormData();
  formData.append("file", file, file.name);
  const { data } = await axiosAuth.post<string>(
    `${apiProducts}/cloudinary/uploadImage`,
    formData,
    { responseType: "text" },
  );
  const imageUrl = typeof data === "string" ? data.trim() : "";
  if (!imageUrl) throw new Error("No se pudo obtener la imagen subida.");

  await axiosAuth.patch(`${apiProducts}/products/${encodeURIComponent(resolvedProductId)}`, {
    imageUrl,
  });
  return imageUrl;
}
