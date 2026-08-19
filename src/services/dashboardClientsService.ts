import axios from "axios";
import { Client } from "@/interfaces/ICliente";

const API_VENTAS = process.env.NEXT_PUBLIC_API_VENTAS;

/**
 * Todos los clientes de la empresa (el endpoint no filtra por tienda ni por
 * fecha — si la empresa tiene varias tiendas, esto mezcla clientes de todas).
 */
export async function getClientsByCompany(companyId: string): Promise<Client[]> {
  const res = await axios.get<Client[]>(`${API_VENTAS}/clients/company/${companyId}`);
  return res.data;
}
