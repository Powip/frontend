import { Category } from "../interfaces/ICategory";
import { API_URLS } from "@/config/apiConfig";
import axiosAuth from "@/lib/axiosAuth";

const API_URL = API_URLS.productos;

export async function getCategories(): Promise<Category[]> {
  const res = await axiosAuth.get(`${API_URL}/categories`);
  return res.data;
}
