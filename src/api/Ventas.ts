import axiosAuth from "@/lib/axiosAuth";
import { GATEWAY } from "@/lib/gateway";
import {
  ICreateOrderHeader,
  ICreateOrderHeaderPlusItems,
  IUpdateOrderHeaderDto,
  ICreateOrderItemsDto,
  ICreatePaymentDto,
  IUpdatePaymentDto,
} from "./Interfaces";

const BASE = GATEWAY.ventas;

export const createOrderHeader = async (payload: ICreateOrderHeader) => {
  const { data } = await axiosAuth.post(`${BASE}/order-header`, payload);
  return data;
};

export const createOrderWithItems = async (payload: ICreateOrderHeaderPlusItems) => {
  const { data } = await axiosAuth.post(`${BASE}/order-header/orderPlusItems`, payload);
  return data;
};

export const getOrders = async () => {
  const { data } = await axiosAuth.get(`${BASE}/order-header`);
  return data;
};

export const getOrdersByCompany = async (
  companyId: string,
  fromDate?: string,
  toDate?: string,
) => {
  const { data } = await axiosAuth.get(`${BASE}/order-header/company/${companyId}`, {
    params: { fromDate, toDate },
  });
  return data;
};

export const getOrderById = async (orderId: string) => {
  const { data } = await axiosAuth.get(`${BASE}/order-header/${orderId}`);
  return data;
};

export const updateOrderHeader = async (orderId: string, payload: IUpdateOrderHeaderDto) => {
  const { data } = await axiosAuth.patch(`${BASE}/order-header/${orderId}`, payload);
  return data;
};

export const deleteOrderHeader = async (orderId: string) => {
  const { data } = await axiosAuth.delete(`${BASE}/order-header/${orderId}`);
  return data;
};

export const recalculateOrder = async (orderId: string) => {
  const { data } = await axiosAuth.post(`${BASE}/order-header/${orderId}/recalculate`);
  return data;
};

export const addOrderItem = async (orderId: string, payload: ICreateOrderItemsDto) => {
  const { data } = await axiosAuth.post(`${BASE}/order/${orderId}/items`, payload);
  return data;
};

export const deleteOrderItem = async (orderId: string, itemId: string) => {
  const { data } = await axiosAuth.delete(`${BASE}/order/${orderId}/items/${itemId}`);
  return data;
};

export const createPayment = async (payload: ICreatePaymentDto) => {
  const { data } = await axiosAuth.post(`${BASE}/payment`, payload);
  return data;
};

export const getPayments = async () => {
  const { data } = await axiosAuth.get(`${BASE}/payment`);
  return data;
};

export const getPaymentById = async (paymentId: string) => {
  const { data } = await axiosAuth.get(`${BASE}/payment/${paymentId}`);
  return data;
};

export const updatePayment = async (paymentId: string, payload: IUpdatePaymentDto) => {
  const { data } = await axiosAuth.patch(`${BASE}/payment/${paymentId}`, payload);
  return data;
};

export const deletePayment = async (paymentId: string) => {
  const { data } = await axiosAuth.delete(`${BASE}/payment/${paymentId}`);
  return data;
};

export const createPaymentForOrder = async (orderId: string, payload: ICreatePaymentDto) => {
  const { data } = await axiosAuth.post(`${BASE}/payments/orders/${orderId}`, payload);
  return data;
};

export const getPaymentsByOrder = async (orderId: string) => {
  const { data } = await axiosAuth.get(`${BASE}/order-header/${orderId}/payment`);
  return data;
};

export const updatePaymentForOrder = async (
  orderId: string,
  paymentId: string,
  payload: IUpdatePaymentDto,
) => {
  const { data } = await axiosAuth.patch(
    `${BASE}/order-header/${orderId}/payment/${paymentId}`,
    payload,
  );
  return data;
};

export const deletePaymentForOrder = async (orderId: string, paymentId: string) => {
  const { data } = await axiosAuth.delete(
    `${BASE}/order-header/${orderId}/payment/${paymentId}`,
  );
  return data;
};

export const revertPayment = async (paymentId: string) => {
  const { data } = await axiosAuth.post(`${BASE}/payment/${paymentId}/revert`);
  return data;
};

export const getLogVentas = async (orderId: string) => {
  const { data } = await axiosAuth.get(`${BASE}/log-ventas/${orderId}`);
  return data;
};

export const getSellerSummary = async (companyId: string) => {
  const { data } = await axiosAuth.get(
    `${BASE}/order-header/summary/company/${companyId}/sellers`,
  );
  return data;
};
