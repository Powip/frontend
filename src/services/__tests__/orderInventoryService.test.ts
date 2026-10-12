import { resolveOrderInventory } from "../orderInventoryService";
const warehouses = [{ id: "original-warehouse", name: "Web", storeId: "owner-store" }, { id: "selected-store-warehouse", name: "Otra", storeId: "selected-store" }];
it("uses the warehouse recorded on the sale independently of the selected store and company catalog order", () => {
  expect(resolveOrderInventory({ companyId: "company-a", inventoryId: "original-warehouse" }, "company-a", [...warehouses].reverse())).toBe(warehouses[0]);
});
it("supports legacy company association via the customer", () => {
  expect(resolveOrderInventory({ customer: { companyId: "company-a" }, inventoryId: "original-warehouse" }, "company-a", warehouses).id).toBe("original-warehouse");
});
it("requires an explicit original warehouse rather than falling back to the selected store", () => {
  expect(() => resolveOrderInventory({ companyId: "company-a", inventoryId: null }, "company-a", warehouses)).toThrow("no tiene almacén de origen");
});
it("rejects an order or warehouse belonging to another business", () => {
  expect(() => resolveOrderInventory({ companyId: "company-b", inventoryId: "original-warehouse" }, "company-a", warehouses)).toThrow("pedido no pertenece");
  expect(() => resolveOrderInventory({ companyId: "company-a", inventoryId: "foreign" }, "company-a", warehouses)).toThrow("almacén de origen");
});
