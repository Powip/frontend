import { IProductRequest, IProductApiResponse } from "../interfaces/IProduct";
import { API_URLS } from "@/src/config/apiConfig";

const API_URL = API_URLS.productos;

//Servicio para Crear Producto
export const createProduct = async (payload: IProductRequest) => {
  try {
    const response = await fetch(`${API_URL}/products`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      // Intentamos parsear JSON, si no se puede, capturamos como texto
      let errorData;
      try {
        errorData = await response.json();
      } catch {
        errorData = await response.text();
      }

      throw new Error(
        `Error al crear producto: ${response.status} - ${JSON.stringify(
          errorData
        )}`
      );
    }

    const result: IProductApiResponse = await response.json();
    return result.data;
  } catch (error) {
    console.error("🔥 Error en createProduct:", error);
    throw error;
  }
};

// Servicio para Buscar producto por ID
export async function getProductById(id: string) {
  const res = await fetch(`${API_URL}/products/${id}`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });

  if (!res.ok) {
    const err = await res
      .json()
      .catch(() => ({ message: `HTTP ${res.status}` }));
    console.error("Error getProductById:", res.status, err);
    throw new Error(err.message || "Error al obtener producto");
  }

  return res.json(); // según swagger devuelve el objeto del producto directamente
}

// Servicio para Eliminar producto por ID
export async function deleteProduct(id: string) {
  const res = await fetch(`${API_URL}/products/${id}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
  });

  if (!res.ok) {
    const err = await res
      .json()
      .catch(() => ({ message: `HTTP ${res.status}` }));
    console.error("Error deleteProduct:", res.status, err);
    throw new Error(err.message || "Error al eliminar producto");
  }

  return res.json(); // devuelve message + product en el ejemplo
}

// Servicio para Actualizar producto por ID
export async function updateProduct(id: string, productData: IProductRequest) {
  const res = await fetch(`${API_URL}/products/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(productData),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || "Error al actualizar producto");
  }

  return res.json();
}
