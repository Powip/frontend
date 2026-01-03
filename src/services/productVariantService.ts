// services/productVariantService.ts
import { IProductVariantRequest } from "../interfaces/IProductVariant";

import { API_URLS } from "@/config/apiConfig";

const API_URL = API_URLS.productos;

//Servicio para Crear Variante/s
export async function createProductVariant(payload: IProductVariantRequest) {
  try {
    const res = await fetch(`${API_URL}/product-variants`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    // 📌 Si la respuesta no es ok, loggeamos el detalle
    if (!res.ok) {
      const errorData = await res.text(); // puede venir en JSON o string
      console.error("❌ Error al crear variante:", res.status, errorData);
      throw new Error(`Error al crear variante: ${res.status}`);
    }

    const data = await res.json();
    return data;
  } catch (err) {
    console.error("⚠️ Excepción en createProductVariant:", err);
    throw err;
  }
}

//Servicio para Eliminar Variantes por ID de Producto
export async function deleteProductVariants(productId: string) {
  const res = await fetch(`${API_URL}/product-variants/${productId}`, {
    method: "DELETE",
  });

  if (!res.ok) {
    // Intentamos obtener texto o JSON según lo que haya
    const contentType = res.headers.get("content-type") || "";
    let errMsg = `Error al eliminar variantes del producto (${res.status})`;

    try {
      if (contentType.includes("application/json")) {
        const errJson = await res.json();
        errMsg = errJson.message || errMsg;
      } else {
        const errText = await res.text();
        if (errText) errMsg = errText;
      }
    } catch {
      // fallback
    }

    console.error("Error deleteProductVariants:", res.status, errMsg);
    throw new Error(errMsg);
  }

  return;
}
