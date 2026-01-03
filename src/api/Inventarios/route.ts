import axios from "axios";

interface CreateInventoryDto {
  name: string;
  store_id: string;
}

export async function createInventory(data: CreateInventoryDto) {
  try {
    const res = await axios.post(
      `${process.env.NEXT_PUBLIC_API_INVENTORY}/inventory`,
      data
    );

    return res;
  } catch (error) {
    console.log("Hemos tenido un error al crear el inventario", error);
  }
}
