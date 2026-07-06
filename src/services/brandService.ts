import { Brand } from "@/interfaces/IProvider";
import { API_URLS } from "@/config/apiConfig";
import axiosAuth from "@/lib/axiosAuth";

const API_URL = API_URLS.supplier;

export const getBrandsBySupplier = async (supplierId: string): Promise<Brand[]> => {
  try {
    const res = await axiosAuth.get(`${API_URL}/brand/supplier/${supplierId}`);
    const data: Brand[] = res.data;
    return data.filter((brand) => brand.is_active);
  } catch (error) {
    console.error("Error en getBrandsBySupplier:", error);
    return [];
  }
};

export const createBrand = async (brand: Omit<Brand, "id">): Promise<Brand> => {
  try {
    const res = await axiosAuth.post(`${API_URL}/brand`, brand);
    return res.data;
  } catch (error) {
    console.error("Error en createBrand:", error);
    throw error;
  }
};

export const updateBrand = async (id: string, brand: Partial<Brand>): Promise<Brand> => {
  try {
    const res = await axiosAuth.patch(`${API_URL}/brand/${id}`, brand);
    return res.data;
  } catch (error) {
    console.error("Error en updateBrand:", error);
    throw error;
  }
};

export const inactivateBrand = async (id: string): Promise<void> => {
  try {
    await axiosAuth.patch(`${API_URL}/brand/disable/${id}`);
  } catch (error) {
    console.error("Error en inactivateBrand:", error);
    throw error;
  }
};
