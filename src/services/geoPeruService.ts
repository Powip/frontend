import { API_URLS } from "@/config/apiConfig";
import axiosAuth from "@/lib/axiosAuth";

const API_URL = API_URLS.supplier;

export async function getDepartments(): Promise<string[]> {
  const res = await axiosAuth.get(`${API_URL}/geoPeru/allDepartments`);
  return res.data;
}

export async function getProvinces(department: string): Promise<string[]> {
  const res = await axiosAuth.get(`${API_URL}/geoPeru/${department}/allProvinces`);
  return res.data;
}

export async function getDistricts(province: string): Promise<string[]> {
  const res = await axiosAuth.get(`${API_URL}/geoPeru/${province}/allDistritos`);
  return res.data;
}
