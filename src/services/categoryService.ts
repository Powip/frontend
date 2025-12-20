import { Category } from "../interfaces/ICategory";
import { API_URLS } from "@/config/apiConfig";

const API_URL = API_URLS.productos;

export async function getCategories(): Promise<Category[]> {
  const res = await fetch(`${API_URL}/categories`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error("Error al obtener categorías");
  }

  return res.json();
}
