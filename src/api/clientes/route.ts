import axios from "axios";

interface CreateClientDto {
  companyId: string;
  fullName: string;
  phoneNumber: string;
  clientType: "TRADICIONAL" | "MAYORISTA";
  province: string;
  city: string;
  district: string;
  address: string;
  reference?: string;
  latitude?: number;
  longitude?: number;
}
interface UpdateClientDto extends Partial<CreateClientDto> {
  id: string;
}
export async function createClient(data: CreateClientDto) {
  try {
    const res = await axios.post(
      `${process.env.NEXT_PUBLIC_API_VENTAS}/clients`,
      data
    );
    return res;
  } catch (error) {
    console.log("Hemos teniedo un error al crear el usuario", error);
  }
}

export async function updateClient(id: string, data: UpdateClientDto) {
  try {
    const res = await axios.patch(
      `${process.env.NEXT_PUBLIC_API_VENTAS}/clients/${id}`,
      data
    );
    return res;
  } catch (error) {
    console.log("Error al actualizar el cliente", error);
  }
}

export async function findByCompany(id: string) {
  try {
    const res = await axios.get(
      `${process.env.NEXT_PUBLIC_API_VENTAS}/clients/company/${id}`
    );
    return res;
  } catch (error) {
    console.log("Error al obtener clientes", error);
  }
}

export async function toggleClienteActivo(id: string) {
  try {
    const res = await axios.patch(
      `${process.env.NEXT_PUBLIC_API_VENTAS}/clients/${id}/toggle`
    );
    return res;
  } catch (error) {
    console.log("Error al activar/desactivar cliente", error);
  }
}
