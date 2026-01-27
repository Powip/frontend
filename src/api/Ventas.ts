import axios from "axios";
import { API } from "@/lib/api";
import {
  ICreateOrderHeader,
  ICreateOrderHeaderPlusItems,
  IUpdateOrderHeaderDto,
  ICreateOrderItemsDto,
  ICreatePaymentDto,
  IUpdatePaymentDto,
} from "./Interfaces";

// Crear cabecera de orden
export const createOrderHeader = async (payload: ICreateOrderHeader) => {
  const { data } = await axios.post(`${API.ventas}/order-header`, payload);
  return data;
};

// Crear orden con ítems
export const createOrderWithItems = async (
  payload: ICreateOrderHeaderPlusItems,
) => {
  const { data } = await axios.post(
    `${API.ventas}/order-header/orderPlusItems`,
    payload,
  );
  return data;
};

// Obtener todas las órdenes
export const getOrders = async () => {
  const { data } = await axios.get(`${API.ventas}/order-header`);
  return data;
};

// Obtener una orden por ID
export const getOrderById = async (orderId: string) => {
  const { data } = await axios.get(`${API.ventas}/order-header/${orderId}`);
  return data;
};

// Actualizar cabecera
export const updateOrderHeader = async (
  orderId: string,
  payload: IUpdateOrderHeaderDto,
) => {
  const { data } = await axios.patch(
    `${API.ventas}/order-header/${orderId}`,
    payload,
  );
  return data;
};

// Eliminar cabecera
export const deleteOrderHeader = async (orderId: string) => {
  const { data } = await axios.delete(`${API.ventas}/order-header/${orderId}`);
  return data;
};

// Recalcular totales de orden
export const recalculateOrder = async (orderId: string) => {
  const { data } = await axios.post(
    `${API.ventas}/order-header/${orderId}/recalculate`,
  );
  return data;
};

// Agregar ítem a orden
export const addOrderItem = async (
  orderId: string,
  payload: ICreateOrderItemsDto,
) => {
  const { data } = await axios.post(
    `${API.ventas}/order/${orderId}/items`,
    payload,
  );
  return data;
};

// Eliminar ítem de orden
export const deleteOrderItem = async (orderId: string, itemId: string) => {
  const { data } = await axios.delete(
    `${API.ventas}/order/${orderId}/items/${itemId}`,
  );
  return data;
};

// Crear pago general
export const createPayment = async (payload: ICreatePaymentDto) => {
  const { data } = await axios.post(`${API.ventas}/payment`, payload);
  return data;
};

// Obtener todos los pagos
export const getPayments = async () => {
  const { data } = await axios.get(`${API.ventas}/payment`);
  return data;
};

// Obtener un pago por ID
export const getPaymentById = async (paymentId: string) => {
  const { data } = await axios.get(`${API.ventas}/payment/${paymentId}`);
  return data;
};

// Actualizar un pago
export const updatePayment = async (
  paymentId: string,
  payload: IUpdatePaymentDto,
) => {
  const { data } = await axios.patch(
    `${API.ventas}/payment/${paymentId}`,
    payload,
  );
  return data;
};

// Eliminar un pago
export const deletePayment = async (paymentId: string) => {
  const { data } = await axios.delete(`${API.ventas}/payment/${paymentId}`);
  return data;
};

// Crear pago asociado a orden
export const createPaymentForOrder = async (
  orderId: string,
  payload: ICreatePaymentDto,
) => {
  const { data } = await axios.post(
    `${API.ventas}/payments/orders/${orderId}`,
    payload,
  );
  return data;
};

// Obtener pagos por orden
export const getPaymentsByOrder = async (orderId: string) => {
  const { data } = await axios.get(
    `${API.ventas}/order-header/${orderId}/payment`,
  );
  return data;
};

// Actualizar pago por orden
export const updatePaymentForOrder = async (
  orderId: string,
  paymentId: string,
  payload: IUpdatePaymentDto,
) => {
  const { data } = await axios.patch(
    `${API.ventas}/order-header/${orderId}/payment/${paymentId}`,
    payload,
  );
  return data;
};

// Eliminar pago de una orden
export const deletePaymentForOrder = async (
  orderId: string,
  paymentId: string,
) => {
  const { data } = await axios.delete(
    `${API.ventas}/order-header/${orderId}/payment/${paymentId}`,
  );
  return data;
};

// Revertir un pago
export const revertPayment = async (paymentId: string) => {
  const { data } = await axios.post(
    `${API.ventas}/payment/${paymentId}/revert`,
  );
  return data;
};

export const getLogVentas = async (orderId: string) => {
  const { data } = await axios.get(`${API.ventas}/log-ventas/${orderId}`);
  return data;
};

// Obtener resumen por vendedores
export const getSellerSummary = async (companyId: string) => {
  const { data } = await axios.get(
    `${API.ventas}/order-header/summary/company/${companyId}/sellers`,
  );
  return data;
};
