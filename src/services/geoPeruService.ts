import { API_URLS } from "@/src/config/apiConfig";

const API_URL = API_URLS.supplier;

export async function getDepartments(): Promise<string[]> {
  const res = await fetch(`${API_URL}/geoPeru/allDepartments`);
  if (!res.ok) throw new Error("Error fetching departments");
  return res.json();
}

export async function getProvinces(department: string): Promise<string[]> {
  const res = await fetch(`${API_URL}/geoPeru/${department}/allProvinces`);
  if (!res.ok) throw new Error("Error fetching provinces");
  return res.json();
}

export async function getDistricts(province: string): Promise<string[]> {
  const res = await fetch(`${API_URL}/geoPeru/${province}/allDistritos`);
  if (!res.ok) throw new Error("Error fetching districts");
  return res.json();
}
