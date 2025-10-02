import axios from "axios";
import { API } from "@/lib/api";
import { ICreateOrderHeader } from "./Interfaces";

// Crear orden (solo cabecera)
export const createOrderHeader = async (payload: ICreateOrderHeader) => {
  try {
    const { data } = await axios.post(`${API.ventas}/order-header`, payload);
    return data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(
        error.response?.data?.message || "Error al crear la orden"
      );
    }
    throw new Error("Error inesperado al crear la orden");
  }
};

// Obtener una orden por ID
export const getOrderById = async (orderId: string) => {
  try {
    const { data } = await axios.get(`${API.ventas}/order-header/${orderId}`);
    return data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(
        error.response?.data?.message || "Error al obtener la orden"
      );
    }
    throw new Error("Error inesperado al obtener la orden");
  }
};

// Recalcular totales de una orden
export const recalculateOrder = async (orderId: string) => {
  try {
    const { data } = await axios.post(
      `${API.ventas}/order-header/${orderId}/recalculate`
    );
    return data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(
        error.response?.data?.message || "Error al recalcular la orden"
      );
    }
    throw new Error("Error inesperado al recalcular la orden");
  }
};
