import axios from "axios";

export interface InventoryMovement {
  id: string;
  type: "IN" | "OUT" | "RESERVED" | "RELEASED" | "COMMITTED" | "ADJUSTMENT" | "TRANSFER";
  quantity: number;
  reason: string;
  userEmail: string | null;
  userName: string | null;
  companyId: string | null;
  referenceId: string | null;
  created_at: string;
  inventoryItem: {
    id: string;
    sku: string;
    product: {
      name: string;
    };
  };
}

interface MovementsResponse {
  data: InventoryMovement[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export async function getMovementsByCompany(
  companyId: string,
  params: { 
    page?: number; 
    limit?: number;
    type?: string;
    userEmail?: string;
    startDate?: string;
    endDate?: string;
    search?: string;
  } = {}
): Promise<MovementsResponse> {
  const res = await axios.get<MovementsResponse>(
    `${process.env.NEXT_PUBLIC_API_INVENTORY}/inventory-movement/company/${companyId}`,
    { params }
  );
  return res.data;
}
