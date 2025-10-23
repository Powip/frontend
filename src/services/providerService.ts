import { Provider, ProviderRequest } from "../interfaces/IProvider";
import { API_URLS } from "@/config/apiConfig";

const API_URL = API_URLS.supplier;

//Servicio para Traer los proveedores de una compañia
export async function getProvidersByCompany(
  companyId: string
): Promise<Provider[]> {
  try {
    const response = await fetch(`${API_URL}/supplier/company/${companyId}`);
    if (!response.ok) throw new Error("Error al obtener proveedores");
    return await response.json();
  } catch (error) {
    console.error("Error en getProvidersByCompany:", error);
    throw error;
  }
}

//Servicio para Crear Proveedor
export async function createProvider(provider: Provider): Promise<Provider> {
  const response = await fetch(`${API_URL}/supplier`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(provider),
  });

  if (!response.ok) {
    // Intentar leer el error devuelto por el backend
    let errorMessage = `Error ${response.status}`;
    try {
      const errorData = await response.json();
      errorMessage += `: ${JSON.stringify(errorData)}`;
    } catch {
      const text = await response.text();
      errorMessage += text ? `: ${text}` : "";
    }
    throw new Error(errorMessage);
  }

  return response.json();
}

// Servicio para Buscar Proveedor por ID
export async function getProviderById(id: string) {
  const res = await fetch(`${API_URL}/supplier/${id}`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });

  if (!res.ok) {
    const err = await res
      .json()
      .catch(() => ({ message: `HTTP ${res.status}` }));
    console.error("Error getProductById:", res.status, err);
    throw new Error(err.message || "Error al obtener el proveedor");
  }

  return res.json();
}

// Servicio para Eliminar (desactivar) proveedor por ID utilizando PATCH
export async function inactivateProvider(id: string) {
  const res = await fetch(`${API_URL}/supplier/disabled/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || "Error al eliminar el proveedor");
  }

  return res.json();
}

// Servicio para Actualizar un Proveedor por ID
export async function updateProvider(
  id: string,
  providerData: ProviderRequest
) {
  const res = await fetch(`${API_URL}/supplier/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(providerData),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || "Error al actualizar el proveedor");
  }

  return res.json();
}
