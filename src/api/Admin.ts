import axiosAuth from "@/lib/axiosAuth";
import { GATEWAY } from "@/lib/gateway";
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
): Promise<IGastoOperativo[]> => {
  const { data } = await axiosAuth.get(
    `${GATEWAY.company}/company/${companyId}/gastos`,
    { params: { fromDate, toDate } },
  );
  return data;
};

export const createGasto = async (
  companyId: string,
  dto: ICreateGastoDto,
): Promise<IGastoOperativo> => {
  const { data } = await axiosAuth.post(
    `${GATEWAY.company}/company/${companyId}/gastos`,
    dto,
  );
  return data;
};

export const updateGasto = async (
  companyId: string,
  gastoId: string,
  dto: Partial<ICreateGastoDto>,
): Promise<IGastoOperativo> => {
  const { data } = await axiosAuth.patch(
    `${GATEWAY.company}/company/${companyId}/gastos/${gastoId}`,
    dto,
  );
  return data;
};

export const getMerma = async (
  companyId: string,
  fromDate: string,
  toDate: string,
): Promise<{ totalUnidades: number; costoEstimado: number }> => {
  const { data } = await axiosAuth.get(
    `${GATEWAY.logistics}/inventory-movement/company/${companyId}/shrinkage`,
    { params: { fromDate, toDate } },
  );
  return data;
};

export const getCourierCost = async (
  storeIds: string[],
  fromDate: string,
  toDate: string,
): Promise<number> => {
  if (storeIds.length === 0) return 0;
  const { data } = await axiosAuth.get(
    `${GATEWAY.courier}/shipping-guides/cost`,
    { params: { storeIds: storeIds.join(','), fromDate, toDate } },
  );
  return Number(data.totalCost ?? 0);
};

export const deleteGasto = async (companyId: string, gastoId: string): Promise<void> => {
  await axiosAuth.delete(`${GATEWAY.company}/company/${companyId}/gastos/${gastoId}`);
};

export const getMarketplaceConfigs = async (companyId: string): Promise<IMarketplaceConfig[]> => {
  const { data } = await axiosAuth.get(
    `${GATEWAY.company}/company/${companyId}/marketplace-config`,
  );
  return data;
};

export const createMarketplaceConfig = async (
  companyId: string,
  dto: ICreateMarketplaceConfigDto,
): Promise<IMarketplaceConfig> => {
  const { data } = await axiosAuth.post(
    `${GATEWAY.company}/company/${companyId}/marketplace-config`,
    dto,
  );
  return data;
};

export const updateMarketplaceConfig = async (
  companyId: string,
  configId: string,
  dto: Partial<ICreateMarketplaceConfigDto>,
): Promise<IMarketplaceConfig> => {
  const { data } = await axiosAuth.patch(
    `${GATEWAY.company}/company/${companyId}/marketplace-config/${configId}`,
    dto,
  );
  return data;
};

export const deleteMarketplaceConfig = async (
  companyId: string,
  configId: string,
): Promise<void> => {
  await axiosAuth.delete(
    `${GATEWAY.company}/company/${companyId}/marketplace-config/${configId}`,
  );
};

export const getShrinkageList = async (
  companyId: string,
  fromDate: string,
  toDate: string,
): Promise<IInventoryShrinkage[]> => {
  const { data } = await axiosAuth.get(
    `${GATEWAY.logistics}/inventory-shrinkage/company/${companyId}`,
    { params: { fromDate, toDate } },
  );
  return data;
};

export const createShrinkage = async (
  companyId: string,
  dto: ICreateShrinkageDto,
): Promise<IInventoryShrinkage> => {
  const { data } = await axiosAuth.post(
    `${GATEWAY.logistics}/inventory-shrinkage/company/${companyId}`,
    dto,
  );
  return data;
};

export const getShrinkageSummary = async (
  companyId: string,
  fromDate: string,
  toDate: string,
): Promise<{ totalUnidades: number; costoEstimado: number }> => {
  const { data } = await axiosAuth.get(
    `${GATEWAY.logistics}/inventory-shrinkage/company/${companyId}/summary`,
    { params: { fromDate, toDate } },
  );
  return data;
};
