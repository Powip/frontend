import { API_URLS } from "@/src/config/apiConfig";

const API_URL = API_URLS.productos;

export const uploadImage = async (file: File): Promise<string> => {
  const formData = new FormData();
  formData.append("file", file, file.name);

  const res = await fetch(`${API_URL}/cloudinary/uploadImage`, {
    method: "POST",
    body: formData,
  });

  const resText = await res.text();

  if (!res.ok) {
    let message = resText;
    try {
      message = JSON.parse(resText).message;
    } catch {}
    throw new Error(message);
  }

  return resText;
};
