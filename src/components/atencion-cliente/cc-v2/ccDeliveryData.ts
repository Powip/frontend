import type { OrderDeliverySnapshot } from "@/interfaces/IOrder";

/** Valores con los que los sistemas de origen rellenan una dirección que no existe. */
const JUNK_LOCATION_VALUES = new Set([
  "", "por completar", "-", "0", "s/d", "n/a", "na", "sd", "n/d", "nd",
  "none", "null", "no data", "sin dato", "sin datos",
  "lima_norte", "lima_centro", "lima_sur", "lima_este", "lima_oeste",
  "zonas_aledanas", "provincias",
]);

export function isJunkLocationValue(value: string | null | undefined): boolean {
  if (!value || !value.trim()) return true;
  return JUNK_LOCATION_VALUES.has(value.trim().toLowerCase());
}

type LocationCustomer = {
  province?: string | null;
  city?: string | null;
  district?: string | null;
  address?: string | null;
};

type LocationOrder = {
  customer?: LocationCustomer | null;
  deliverySnapshot?: Pick<OrderDeliverySnapshot, "department" | "province" | "district" | "address"> | null;
};

/**
 * ¿La dirección de entrega está completa? Misma regla que el backend (`hasCompleteCcCustomerData`,
 * ms-ventas cc-customer-data.ts) pero SIN contar el DNI: con `deliverySnapshot` la dirección sale de ahí
 * (su `department` hace de `city`); si no, del cliente.
 *
 * Deja aceptar una venta sin DNI (el DNI se exige recién al confirmar el despacho) sin aflojar la dirección.
 * Es solo la puerta de la pantalla: el backend no valida esto al aceptar la venta.
 */
export function hasCompleteDeliveryLocation(order: LocationOrder | null | undefined): boolean {
  if (!order) return false;
  if (!order.customer) return true;
  const snapshot = order.deliverySnapshot;
  const place: LocationCustomer = snapshot
    ? { province: snapshot.province, city: snapshot.department, district: snapshot.district, address: snapshot.address }
    : order.customer;
  return (["province", "city", "district", "address"] as const).every(
    (field) => !isJunkLocationValue(place[field]),
  );
}
