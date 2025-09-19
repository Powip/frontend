import axios from "axios";
import { API } from "@/lib/api";
import {
  IGetBrand,
  IGetCategory,
  IGetProducts,
  IGetSubCategory,
  IProductFilters,
} from "./Interfaces";

// Categorías
export const getCategories = async (): Promise<IGetCategory[]> => {
  try {
    const { data } = await axios.get(`${API.productos}/categories`);
    return data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(
        error.response?.data?.message || "Error al obtener categorías"
      );
    }
    throw new Error("Error inesperado al obtener categorías");
  }
};

// Subcategorías
export const getSubCategories = async (): Promise<IGetSubCategory[]> => {
  try {
    const { data } = await axios.get(`${API.productos}/subcategories`);
    return data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(
        error.response?.data?.message || "Error al obtener subcategorías"
      );
    }
    throw new Error("Error inesperado al obtener subcategorías");
  }
};

// Marcas
export const getBrands = async (): Promise<IGetBrand[]> => {
  try {
    const { data } = await axios.get(`${API.productos}/brand`);
    return data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(
        error.response?.data?.message || "Error al obtener marcas"
      );
    }
    throw new Error("Error inesperado al obtener marcas");
  }
};

// Proveedores
export const getProviders = async () => {
  try {
    const { data } = await axios.get(`${API.productos}/providers`);
    return data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(
        error.response?.data?.message || "Error al obtener Proveedores"
      );
    }
    throw new Error("Error inesperado al obtener Proveedores");
  }
};

// Atributos por subcategoría
export const getAttributesBySubcategory = async (subcategoryId: string) => {
  if (!subcategoryId) return [];
  const { data } = await axios.get(
    `${API.productos}/products/attributes-by-subcategory/${subcategoryId}`
  );
  return data.attributes; // array de atributos
};

// Productos con filtros
export const getProducts = async (
  filters: IProductFilters = {}
): Promise<IGetProducts[]> => {
  try {
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

    const { data } = await axios.get(
      `${API.productos}/products/report?${params}`
    );
    return data.data || [];
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(
        error.response?.data?.message || "Error al obtener productos"
      );
    }
    throw new Error("Error inesperado al obtener productos");
  }
};

// Eliminar productos
export const deleteProduct = async (id: string) => {
  const { data } = await axios.delete(`${API.productos}/product/${id}`);
  return data;
};
