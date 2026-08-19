import axios from "axios";
import { OrderHeader } from "@/interfaces/IOrder";

const API_VENTAS = process.env.NEXT_PUBLIC_API_VENTAS;

/** Todos los pedidos de la tienda (el endpoint no filtra por fecha — se filtra en cliente). */
export async function getOrdersByStore(storeId: string): Promise<OrderHeader[]> {
  const res = await axios.get<OrderHeader[]>(`${API_VENTAS}/order-header/store/${storeId}`);
  return res.data;
}
