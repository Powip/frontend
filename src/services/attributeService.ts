import { API_URLS } from "@/src/config/apiConfig";

const API_URL = API_URLS.productos;

export async function getAttributesBySubcategory(subcategoryId: string) {
  const res = await fetch(
    `${API_URL}/products/attributes-by-subcategory/${subcategoryId}`,
    { cache: "no-store" }
  );

  if (!res.ok) throw new Error("Error al obtener atributos");

  return res.json();
}
