import axiosAuth from "@/lib/axiosAuth";
import { GATEWAY } from "@/lib/gateway";
import { updateClient } from "@/services/clients.service";

/** Read the order first: an absent integration marker must never mean shared-client delivery. */
export async function saveAliclikDestinationCoordinates(
  orderId: string,
  companyId: string,
  clientId: string | undefined,
  latitude: number,
  longitude: number,
): Promise<void> {
  const response = await axiosAuth.get<{
    id: string;
    companyId: string;
    deliverySnapshot?: unknown;
  }>(`${GATEWAY.ventas}/order-header/manual/${encodeURIComponent(orderId)}`);
  const order = response.data;
  if (order.id !== orderId || order.companyId !== companyId) {
    throw new Error("No se pudo verificar el destino de este pedido");
  }
  if (order.deliverySnapshot) {
    await axiosAuth.put(
      `${GATEWAY.ventas}/order-header/manual/${encodeURIComponent(orderId)}/full`,
      {
        delivery: { latitude, longitude },
      },
    );
    return;
  }
  if (!clientId) throw new Error("No se pudo determinar el cliente para guardar las coordenadas");
  await updateClient(clientId, { companyId, latitude, longitude });
}
