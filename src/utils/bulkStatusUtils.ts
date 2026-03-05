import axios from "axios";
import { OrderStatus } from "@/interfaces/IOrder";

interface BulkUpdateResult {
  success: string[];
  failed: { id: string; error: string }[];
}

interface ProgressCallback {
  (processed: number, total: number): void;
}

/**
 * Processes status updates in batches to handle high concurrency (e.g. 300 orders).
 * Includes user identity for audit traceability.
 */
export async function processBulkStatusChange(
  orderIds: string[],
  newStatus: OrderStatus,
  apiBaseUrl: string,
  onProgress?: ProgressCallback,
  batchSize: number = 10,
  userInfo?: { userId: string; sellerName: string },
): Promise<BulkUpdateResult> {
  const result: BulkUpdateResult = {
    success: [],
    failed: [],
  };

  const total = orderIds.length;
  let processed = 0;

  // Split into chunks
  for (let i = 0; i < total; i += batchSize) {
    const chunk = orderIds.slice(i, i + batchSize);

    // Process chunk in parallel
    const segmentResults = await Promise.allSettled(
      chunk.map((id) =>
        axios.patch(`${apiBaseUrl}/order-header/${id}`, {
          status: newStatus,
          ...(userInfo && {
            userId: userInfo.userId,
            sellerName: userInfo.sellerName,
          }),
        }),
      ),
    );

    segmentResults.forEach((res, index) => {
      const orderId = chunk[index];
      if (res.status === "fulfilled") {
        result.success.push(orderId);
      } else {
        const errorMessage =
          res.reason?.response?.data?.message || "Error desconocido";
        result.failed.push({ id: orderId, error: errorMessage });
      }
    });

    processed += chunk.length;
    if (onProgress) {
      onProgress(processed, total);
    }
  }

  return result;
}
