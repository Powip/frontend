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
    customer?: { id?: string } | null;
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
  // Sin clientId (p. ej. desde el modal de guía) se usa el cliente que devuelve la venta.
  const targetClientId = clientId || order.customer?.id;
  if (!targetClientId) throw new Error("No se pudo determinar el cliente para guardar las coordenadas");
  await updateClient(targetClientId, { companyId, latitude, longitude });
}

/**
 * Guarda la agencia Shalom elegida en el pedido, igual que Registrar venta al editar: pasa el pedido
 * a «Recojo en agencia» (`deliveryType: PUNTO_EXTERNO`) y guarda el nombre en `delivery.agency`.
 * El backend exige que el pedido tenga dirección propia (`deliverySnapshot`) y que no tenga guía.
 */
export async function saveOrderShalomAgency(orderId: string, agency: string): Promise<void> {
  await axiosAuth.put(`${GATEWAY.ventas}/order-header/manual/${encodeURIComponent(orderId)}/full`, {
    deliveryType: "PUNTO_EXTERNO",
    delivery: { agency: agency.trim().slice(0, 150) },
  });
}
