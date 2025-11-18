import axios from "axios";

export const fetchUserCompany = async (userId: string, token: string) => {
  try {
    const response = await axios.get(
      `${process.env.NEXT_PUBLIC_API_COMPANY}/company/user/${userId}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    // Si no trae company
    if (!response.data) return null;

    // Si tu endpoint devuelve la company directamente:
    return {
      id: response.data.id,
      name: response.data.name,
    };
  } catch (error) {
    console.error("Error al obtener company by userId:", error);
    return null;
  }
};
