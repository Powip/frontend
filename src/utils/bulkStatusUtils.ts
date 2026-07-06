import axiosAuth from "@/lib/axiosAuth";
import { GATEWAY } from "@/lib/gateway";
import { OrderStatus } from "@/interfaces/IOrder";

interface BulkUpdateResult {
  success: string[];
  failed: { id: string; error: string }[];
}

/**
 * Cambia el estado de múltiples órdenes usando el endpoint bulk del backend.
 * Una sola request HTTP → una sola query UPDATE en la DB.
 *
 * Fallback automático a requests individuales si el endpoint bulk no existe (404).
 */
export async function processBulkStatusChange(
  orderIds: string[],
  newStatus: OrderStatus | undefined,
  onProgress?: (processed: number, total: number) => void,
  _batchSize: number = 10, // mantenido por compatibilidad, no se usa con bulk
  userInfo?: { userId: string; sellerName: string },
  callStatus?: string,
  callbackAt?: string,
): Promise<BulkUpdateResult> {
  if (orderIds.length === 0) return { success: [], failed: [] };

  try {
    const response = await axiosAuth.patch(`${GATEWAY.ventas}/order-header/bulk-status`, {
      ids: orderIds,
      ...(newStatus !== undefined && { status: newStatus }),
      ...(callStatus !== undefined && { callStatus }),
      ...(callbackAt !== undefined && { callbackAt }),
      ...(userInfo && {
        userId: userInfo.userId,
        sellerName: userInfo.sellerName,
      }),
    });

    const data = response.data as {
      updated: string[];
      skipped: { id: string; reason: string }[];
    };

    onProgress?.(orderIds.length, orderIds.length);

    return {
      success: data.updated ?? [],
      failed: (data.skipped ?? []).map((s) => ({ id: s.id, error: s.reason })),
    };
  } catch (err: any) {
    // Si el endpoint bulk no existe aún en el backend desplegado, fallback individual
    if (err?.response?.status === 404) {
      return processBulkIndividual(orderIds, newStatus, onProgress, userInfo, callStatus, callbackAt);
    }
    throw err;
  }
}

async function processBulkIndividual(
  orderIds: string[],
  newStatus: OrderStatus | undefined,
  onProgress?: (processed: number, total: number) => void,
  userInfo?: { userId: string; sellerName: string },
  callStatus?: string,
  callbackAt?: string,
): Promise<BulkUpdateResult> {
  const result: BulkUpdateResult = { success: [], failed: [] };

  const results = await Promise.allSettled(
    orderIds.map((id) =>
      axiosAuth.patch(`${GATEWAY.ventas}/order-header/${id}`, {
        ...(newStatus !== undefined && { status: newStatus }),
        ...(callStatus !== undefined && { callStatus }),
        ...(callbackAt !== undefined && { callbackAt }),
        ...(userInfo && {
          userId: userInfo.userId,
          sellerName: userInfo.sellerName,
        }),
      }),
    ),
  );

  results.forEach((res, index) => {
    const id = orderIds[index];
    if (res.status === "fulfilled") {
      result.success.push(id);
    } else {
      result.failed.push({
        id,
        error: res.reason?.response?.data?.message ?? "Error desconocido",
      });
    }
  });

  onProgress?.(orderIds.length, orderIds.length);
  return result;
}
