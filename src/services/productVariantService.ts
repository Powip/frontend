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

