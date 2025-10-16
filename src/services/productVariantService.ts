// services/productVariantService.ts
import { IProductVariantRequest } from "../interfaces/IProductVariant";

import { API_URLS } from "@/src/config/apiConfig";

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
    console.log("✅ Variante creada:", data);
    return data;
  } catch (err) {
    console.error("⚠️ Excepción en createProductVariant:", err);
    throw err;
  }
}

//Servicio para Eliminar Variantes por ID de Producto
export async function deleteProductVariants(productId: string) {
  // Según lo probaste, el endpoint es /product-variants/{id} y borra TODAS las variants del producto
  const res = await fetch(`${API_URL}/product-variants/${productId}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
  });

  if (!res.ok) {
    const err = await res
      .json()
      .catch(() => ({ message: `HTTP ${res.status}` }));
    console.error("Error deleteProductVariants:", res.status, err);
    throw new Error(err.message || "Error al eliminar variantes del producto");
  }

  return res.json(); // devuelve mensaje de éxito
}
