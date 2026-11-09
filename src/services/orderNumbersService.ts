import axiosAuth from "@/lib/axiosAuth";
import { GATEWAY } from "@/lib/gateway";

// FEAT-24 H0 — UUID de pedido → ORD-… para el historial de inventario.
// ms-ventas filtra por la empresa del token. Si falla, el historial muestra
// "Pedido" sin número; nunca el UUID.
const BATCH = 200;

export async function resolveOrderNumbers(ids: string[]): Promise<Record<string, string>> {
  const unique = [...new Set(ids)];
  if (!unique.length) return {};
  const base = process.env.NEXT_PUBLIC_API_VENTAS || GATEWAY.ventas;
  try {
    const batches = [];
    for (let index = 0; index < unique.length; index += BATCH) {
      batches.push(
        axiosAuth.post<{ numbers: Record<string, string> }>(`${base}/order-header/numbers`, { ids: unique.slice(index, index + BATCH) }),
      );
    }
    const responses = await Promise.all(batches);
    return Object.assign({}, ...responses.map((response) => response.data.numbers ?? {}));
  } catch {
    return {};
  }
}
