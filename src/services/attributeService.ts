import { API_URLS } from "@/config/apiConfig";
import axiosAuth from "@/lib/axiosAuth";

const API_URL = API_URLS.productos;

export async function getAttributesBySubcategory(subcategoryId: string) {
  const res = await axiosAuth.get(
    `${API_URL}/products/attributes-by-subcategory/${subcategoryId}`
  );
  return res.data;
}
