import { IProductVariantRequest } from "../interfaces/IProductVariant";
import { API_URLS } from "@/config/apiConfig";
import axiosAuth from "@/lib/axiosAuth";

const API_URL = API_URLS.productos;

export async function createProductVariant(payload: IProductVariantRequest) {
  try {
    const res = await axiosAuth.post(`${API_URL}/product-variants`, payload);
    return res.data;
  } catch (err) {
    console.error("Excepción en createProductVariant:", err);
    throw err;
  }
}

export async function deleteProductVariants(productId: string) {
  await axiosAuth.delete(`${API_URL}/product-variants/${productId}`);
}
