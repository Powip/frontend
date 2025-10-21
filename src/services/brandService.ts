import { Brand } from "@/src/interfaces/IProvider";
import { API_URLS } from "@/src/config/apiConfig";

const API_URL = API_URLS.supplier;

// Obtener marcas por proveedor (solo activas)
export const getBrandsBySupplier = async (
  supplierId: string
): Promise<Brand[]> => {
  try {
    const response = await fetch(`${API_URL}/brand/supplier/${supplierId}`);
    if (!response.ok) {
      throw new Error(`Error al obtener marcas del proveedor ${supplierId}`);
    }

    const data: Brand[] = await response.json();

    // ✅ Filtrar solo las marcas activas
    const activeBrands = data.filter((brand) => brand.is_active);

    return activeBrands;
  } catch (error) {
    console.error("Error en getBrandsBySupplier:", error);
    return [];
  }
};

// Crear una nueva marca
export const createBrand = async (brand: Omit<Brand, "id">): Promise<Brand> => {
  try {
    const response = await fetch(`${API_URL}/brand`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(brand),
    });

    if (!response.ok) {
      throw new Error(`Error al crear la marca: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error en createBrand:", error);
    throw error;
  }
};

// Actualizar una marca existente
export const updateBrand = async (
  id: string,
  brand: Partial<Brand>
): Promise<Brand> => {
  try {
    const response = await fetch(`${API_URL}/brand/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(brand),
    });

    if (!response.ok) {
      throw new Error(`Error al actualizar la marca con id ${id}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error en updateBrand:", error);
    throw error;
  }
};

// Inactivar una marca
export const inactivateBrand = async (id: string): Promise<void> => {
  try {
    const response = await fetch(`${API_URL}/brand/disable/${id}`, {
      method: "PATCH",
    });

    if (!response.ok) {
      throw new Error(`Error al inactivar la marca con id ${id}`);
    }
  } catch (error) {
    console.error("Error en inactivateBrand:", error);
    throw error;
  }
};
