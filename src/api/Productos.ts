import axiosAuth from "@/lib/axiosAuth";
import { GATEWAY } from "@/lib/gateway";
import {
  IGetBrand,
  IGetCategory,
  IGetProducts,
  IGetSubCategory,
  IProductFilters,
} from "./Interfaces";

const BASE = GATEWAY.products;

export const getCategories = async (): Promise<IGetCategory[]> => {
  const { data } = await axiosAuth.get(`${BASE}/categories`);
  return data;
};

export const getSubCategories = async (): Promise<IGetSubCategory[]> => {
  const { data } = await axiosAuth.get(`${BASE}/subcategories`);
  return data;
};

export const getBrands = async (): Promise<IGetBrand[]> => {
  const { data } = await axiosAuth.get(`${BASE}/brands`);
  return data;
};

export const getProviders = async () => {
  const { data } = await axiosAuth.get(`${BASE}/providers`);
  return data;
};

export const getAttributesBySubcategory = async (subcategoryId: string) => {
  if (!subcategoryId) return [];
  const { data } = await axiosAuth.get(
    `${BASE}/products/attributes-by-subcategory/${subcategoryId}`,
  );
  return data.attributes;
};

export const getProducts = async (
  filters: IProductFilters = {},
): Promise<IGetProducts[]> => {
  const params = new URLSearchParams();
  if (filters.companyId) params.append("companyId", filters.companyId);
  if (filters.status !== undefined)
    params.append("status", String(filters.status));
  if (filters.brandId) params.append("brandId", filters.brandId);
  if (filters.categoryId) params.append("categoryId", filters.categoryId);
  if (filters.subcategoryId)
    params.append("subcategoryId", filters.subcategoryId);
  if (filters.name) params.append("name", filters.name);
  if (filters.description) params.append("description", filters.description);

  const { data } = await axiosAuth.get(`${BASE}/products/report?${params}`);
  return data.data || [];
};

export const deleteProduct = async (id: string) => {
  const { data } = await axiosAuth.delete(`${BASE}/product/${id}`);
  return data;
};
