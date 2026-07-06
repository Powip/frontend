import axiosAuth from "@/lib/axiosAuth";
import { GATEWAY } from "@/lib/gateway";
import { IGetCompany } from "./Interfaces";

export const getCompany = async (): Promise<IGetCompany[]> => {
  const { data } = await axiosAuth.get(`${GATEWAY.company}/company`);
  return data;
};
