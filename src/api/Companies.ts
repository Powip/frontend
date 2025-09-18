import axios from "axios";
import { API } from "@/lib/api";
import { IGetCompany } from "./Interfaces";

// Compañias
export const getCompany = async (): Promise<IGetCompany[]> => {
  try {
    const { data } = await axios.get(`${API.companies}/company`);
    return data;
  } catch (error) {
    if(axios.isAxiosError(error)) {
      throw new Error(error.response?.data?.message || "Error al obtener compañías");
    }
    throw new Error("Error inesperado al obtener compañías");
  }
};