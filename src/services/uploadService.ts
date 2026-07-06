import { API_URLS } from "@/config/apiConfig";
import axiosAuth from "@/lib/axiosAuth";

const API_URL = API_URLS.productos;

export const uploadImage = async (file: File): Promise<string> => {
  const formData = new FormData();
  formData.append("file", file, file.name);

  const res = await axiosAuth.post(`${API_URL}/cloudinary/uploadImage`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });

  return res.data;
};
