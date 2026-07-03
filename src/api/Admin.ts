import axios from 'axios';
import { API } from '@/lib/api';
import {
  ICreateGastoDto,
  ICreateMarketplaceConfigDto,
  ICreateShrinkageDto,
  IGastoOperativo,
  IInventoryShrinkage,
  IMarketplaceConfig,
} from '@/interfaces/IAdmin';

export const getGastos = async (
  companyId: string,
  fromDate: string,
  toDate: string,
  token: string,
): Promise<IGastoOperativo[]> => {
  const { data } = await axios.get(
    `${API.companies}/company/${companyId}/gastos`,
    {
      params: { fromDate, toDate },
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  return data;
};

export const createGasto = async (
  companyId: string,
  dto: ICreateGastoDto,
  token: string,
): Promise<IGastoOperativo> => {
  const { data } = await axios.post(
    `${API.companies}/company/${companyId}/gastos`,
    dto,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  return data;
};

export const updateGasto = async (
  companyId: string,
  gastoId: string,
  dto: Partial<ICreateGastoDto>,
  token: string,
): Promise<IGastoOperativo> => {
  const { data } = await axios.patch(
    `${API.companies}/company/${companyId}/gastos/${gastoId}`,
    dto,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  return data;
};

export const getMerma = async (
  companyId: string,
  fromDate: string,
  toDate: string,
  token: string,
): Promise<{ totalUnidades: number; costoEstimado: number }> => {
  const { data } = await axios.get(
    `${API.inventory}/inventory-movement/company/${companyId}/shrinkage`,
    {
      params: { fromDate, toDate },
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  return data;
};

export const getCourierCost = async (
  storeIds: string[],
  fromDate: string,
  toDate: string,
  token: string,
): Promise<number> => {
  if (storeIds.length === 0) return 0;
  const { data } = await axios.get(
    `${API.courier}/shipping-guides/cost`,
    {
      params: { storeIds: storeIds.join(','), fromDate, toDate },
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  return Number(data.totalCost ?? 0);
};

export const deleteGasto = async (
  companyId: string,
  gastoId: string,
  token: string,
): Promise<void> => {
  await axios.delete(
    `${API.companies}/company/${companyId}/gastos/${gastoId}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
};

// ── Marketplace Config (B3) ──────────────────────────────────────────────────

export const getMarketplaceConfigs = async (
  companyId: string,
  token: string,
): Promise<IMarketplaceConfig[]> => {
  const { data } = await axios.get(
    `${API.companies}/company/${companyId}/marketplace-config`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  return data;
};

export const createMarketplaceConfig = async (
  companyId: string,
  dto: ICreateMarketplaceConfigDto,
  token: string,
): Promise<IMarketplaceConfig> => {
  const { data } = await axios.post(
    `${API.companies}/company/${companyId}/marketplace-config`,
    dto,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  return data;
};

export const updateMarketplaceConfig = async (
  companyId: string,
  configId: string,
  dto: Partial<ICreateMarketplaceConfigDto>,
  token: string,
): Promise<IMarketplaceConfig> => {
  const { data } = await axios.patch(
    `${API.companies}/company/${companyId}/marketplace-config/${configId}`,
    dto,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  return data;
};

export const deleteMarketplaceConfig = async (
  companyId: string,
  configId: string,
  token: string,
): Promise<void> => {
  await axios.delete(
    `${API.companies}/company/${companyId}/marketplace-config/${configId}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
};

// ── Inventory Shrinkage (B4) ─────────────────────────────────────────────────

export const getShrinkageList = async (
  companyId: string,
  fromDate: string,
  toDate: string,
  token: string,
): Promise<IInventoryShrinkage[]> => {
  const { data } = await axios.get(
    `${API.inventory}/inventory-shrinkage/company/${companyId}`,
    {
      params: { fromDate, toDate },
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  return data;
};

export const createShrinkage = async (
  companyId: string,
  dto: ICreateShrinkageDto,
  token: string,
): Promise<IInventoryShrinkage> => {
  const { data } = await axios.post(
    `${API.inventory}/inventory-shrinkage/company/${companyId}`,
    dto,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  return data;
};

export const getShrinkageSummary = async (
  companyId: string,
  fromDate: string,
  toDate: string,
  token: string,
): Promise<{ totalUnidades: number; costoEstimado: number }> => {
  const { data } = await axios.get(
    `${API.inventory}/inventory-shrinkage/company/${companyId}/summary`,
    {
      params: { fromDate, toDate },
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  return data;
};
