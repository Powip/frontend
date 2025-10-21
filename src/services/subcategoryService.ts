import { Subcategory } from "@/src/interfaces/ICategory";
import { API_URLS } from "@/src/config/apiConfig";

const API_URL = API_URLS.productos; // viene de tu .env.local → NEXT_PUBLIC_API_PRODUCTOS

// Obtener subcategorías por categoría
export const getSubcategoriesByCategory = async (
  categoryId: string
): Promise<Subcategory[]> => {
  try {
    const response = await fetch(`${API_URL}/categories/${categoryId}`);
    if (!response.ok) throw new Error(`Error al obtener subcategorías`);
    const data = await response.json();
    return data.subcategories || [];
  } catch (error) {
    console.error("Error en getSubcategoriesByCategory:", error);
    return [];
  }
};

// Crear subcategoría
export const createSubcategory = async (subcategory: {
  name: string;
  description: string;
  sku: string;
  status: boolean;
  categoryId: string;
}): Promise<Subcategory> => {
  try {
    const response = await fetch(`${API_URL}/subcategories`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(subcategory),
    });

    if (!response.ok)
      throw new Error(`Error al crear subcategoría: ${response.status}`);

    return await response.json();
  } catch (error) {
    console.error("Error en createSubcategory:", error);
    throw error;
  }
};

// Actualizar subcategoría
export const updateSubcategory = async (
  id: string,
  subcategory: Partial<Subcategory>
): Promise<Subcategory> => {
  try {
    const response = await fetch(`${API_URL}/subcategories/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(subcategory),
    });

    if (!response.ok)
      throw new Error(`Error al actualizar subcategoría con id ${id}`);

    return await response.json();
  } catch (error) {
    console.error("Error en updateSubcategory:", error);
    throw error;
  }
};

//  Eliminar (desactivar) subcategoría
export const inactivateSubcategory = async (id: string): Promise<void> => {
  try {
    const response = await fetch(`${API_URL}/subcategories/${id}`, {
      method: "DELETE",
    });

    if (!response.ok)
      throw new Error(`Error al eliminar subcategoría con id ${id}`);
  } catch (error) {
    console.error("Error en deleteSubcategory:", error);
    throw error;
  }
};
