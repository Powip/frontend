import axiosAuth from "@/lib/axiosAuth";
import { GATEWAY } from "@/lib/gateway";
import { IClient } from "./Interfaces";

const BASE = GATEWAY.clients;

export const getClients = async (): Promise<IClient[]> => {
  const { data } = await axiosAuth.get(`${BASE}/api/clients`);
  return data;
};

export const getClientByPhone = async (phone: string): Promise<IClient> => {
  const { data } = await axiosAuth.get(`${BASE}/api/clients/phone/${phone}`);
  return data;
};

export const searchClients = async (query: string): Promise<IClient[]> => {
  const { data } = await axiosAuth.get(`${BASE}/api/clients/search`, {
    params: { q: query },
  });
  return data;
};

export const getClientById = async (id: string): Promise<IClient> => {
  const { data } = await axiosAuth.get(`${BASE}/api/clients/${id}`);
  return data;
};

export const getClientsByCompany = async (companyId: string): Promise<IClient[]> => {
  const { data } = await axiosAuth.get(`${BASE}/api/clients/company/${companyId}`);
  return data;
};

export const createClient = async (client: Partial<IClient>) => {
  const { data } = await axiosAuth.post(`${BASE}/api/clients/create`, client);
  return data;
};

export const updateClient = async (id: string, client: Partial<IClient>) => {
  const { data } = await axiosAuth.put(`${BASE}/api/clients/update/${id}`, client);
  return data;
};

export const deleteClient = async (id: string) => {
  const { data } = await axiosAuth.delete(`${BASE}/api/clients/delete/${id}`);
  return data;
};

export const disableClient = async (id: string) => {
  const { data } = await axiosAuth.patch(`${BASE}/api/clients/disabled/${id}`);
  return data;
};

export const enableClient = async (id: string) => {
  const { data } = await axiosAuth.patch(`${BASE}/api/clients/enabled/${id}`);
  return data;
};
