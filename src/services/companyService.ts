import axios from "axios";

interface Store {
  id: string;
  name: string;
}

interface Company {
  id: string;
  name: string;
  stores?: Store[];
}

export const fetchUserCompany = async (
  userId: string,
  token: string
): Promise<Company | null> => {
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
      stores: response.data.stores || [],
    };
  } catch (error) {
    console.error("Error al obtener company by userId:", error);
    return null;
  }
};
