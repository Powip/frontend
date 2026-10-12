import { BusinessInventory } from "./inventoryCatalogService";

/** Editing an existing sale must use its recorded stock origin, independently of the header selector. */
export function resolveOrderInventory(order: { companyId?: string; customer?: { companyId?: string }; inventoryId?: string | null }, companyId: string, inventories: BusinessInventory[]) {
  if (!companyId || (order.companyId ?? order.customer?.companyId) !== companyId) throw new Error("El pedido no pertenece al negocio activo.");
  if (!order.inventoryId) throw new Error("Este pedido no tiene almacén de origen. Completa su origen antes de agregar productos.");
  const inventory = inventories.find((inv) => inv.id === order.inventoryId);
  if (!inventory) throw new Error("El almacén de origen del pedido no pertenece al negocio activo.");
  return inventory;
}
