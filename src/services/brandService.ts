import { Brand } from "../interfaces/IProvider";

import { API_URLS } from "@/src/config/apiConfig";

const API_URL = API_URLS.supplier;

export const getBrandsBySupplier = async (
  supplierId: string
): Promise<Brand[]> => {
  try {
    const response = await fetch(`${API_URL}/brand/supplier/${supplierId}`);
    if (!response.ok) {
      throw new Error(`Error al obtener marcas del proveedor ${supplierId}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error en getBrandsBySupplier:", error);
    return [];
  }
};

export const getBrands = () => {};
