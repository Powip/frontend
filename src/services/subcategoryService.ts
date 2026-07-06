import { Subcategory } from "@/interfaces/ICategory";
import { GATEWAY } from "@/lib/gateway";
import axiosAuth from "@/lib/axiosAuth";

const BASE = GATEWAY.products;

export const getSubcategoriesByCategory = async (
  categoryId: string
): Promise<Subcategory[]> => {
  try {
    const response = await axiosAuth.get(`${BASE}/categories/${categoryId}`);
    return response.data.subcategories || [];
  } catch {
    return [];
  }
};

export const createSubcategory = async (subcategory: {
  name: string;
  description: string;
  sku: string;
  status: boolean;
  categoryId: string;
}): Promise<Subcategory> => {
  const response = await axiosAuth.post(`${BASE}/subcategories`, subcategory);
  return response.data;
};

export const updateSubcategory = async (
  id: string,
  subcategory: Partial<Subcategory>
): Promise<Subcategory> => {
  const response = await axiosAuth.patch(`${BASE}/subcategories/${id}`, subcategory);
  return response.data;
};

export const inactivateSubcategory = async (id: string): Promise<void> => {
  await axiosAuth.delete(`${BASE}/subcategories/${id}`);
};
