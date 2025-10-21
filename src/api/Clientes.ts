import axios from "axios";
import { API } from "@/lib/api";
import { IClient } from "./Interfaces";


// Obtener todos los clientes
export const getClients = async (): Promise<IClient[]> => {
  try {
    const { data } = await axios.get(`${API.clientes}/api/clients`);
    return data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(error.response?.data?.message || "Error al obtener clientes");
    }
    throw new Error("Error inesperado al obtener clientes");
  }
};

// Obtener cliente por teléfono
export const getClientByPhone = async (phone: string): Promise<IClient> => {
  try {
    const { data } = await axios.get(`${API.clientes}/api/clients/phone/${phone}`);
    return data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(error.response?.data?.message || "Error al obtener cliente por teléfono");
    }
    throw new Error("Error inesperado al obtener cliente por teléfono");
  }
};

// Buscar clientes por documento o RUC
export const searchClients = async (query: string): Promise<IClient[]> => {
  try {
    const { data } = await axios.get(`${API.clientes}/api/clients/search`, {
      params: { q: query },
    });
    return data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(error.response?.data?.message || "Error al buscar clientes");
    }
    throw new Error("Error inesperado al buscar clientes");
  }
};

// Obtener cliente por ID
export const getClientById = async (id: string): Promise<IClient> => {
  try {
    const { data } = await axios.get(`${API.clientes}/api/clients/${id}`);
    return data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(error.response?.data?.message || "Error al obtener cliente por ID");
    }
    throw new Error("Error inesperado al obtener cliente por ID");
  }
};

// Obtener clientes por companyId
export const getClientsByCompany = async (companyId: string): Promise<IClient[]> => {
  try {
    const { data } = await axios.get(`${API.clientes}/api/clients/company/${companyId}`);
    return data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(error.response?.data?.message || "Error al obtener clientes por empresa");
    }
    throw new Error("Error inesperado al obtener clientes por empresa");
  }
};


// Crear cliente
export const createClient = async (client: Partial<IClient>) => {
  const { data } = await axios.post(`${API.clientes}/api/clients/create`, client);
  return data;
};

// Actualizar cliente
export const updateClient = async (id: string, client: Partial<IClient>) => {
  const { data } = await axios.put(`${API.clientes}/api/clients/update/${id}`, client);
  return data;
};

// Eliminar cliente
export const deleteClient = async (id: string) => {
  const { data } = await axios.delete(`${API.clientes}/api/clients/delete/${id}`);
  return data;
};

// Desactivar cliente
export const disableClient = async (id: string) => {
  const { data } = await axios.patch(`${API.clientes}/api/clients/disabled/${id}`);
  return data;
};

// Reactivar cliente
export const enableClient = async (id: string) => {
  const { data } = await axios.patch(`${API.clientes}/api/clients/enabled/${id}`);
  return data;
};
