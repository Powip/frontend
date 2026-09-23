/**
 * Tests: payAdminLiquidation / payAllAdminLiquidations
 *
 * Comportamiento verificado:
 * 1. payAdminLiquidation marca solo la fila indicada como pagada.
 * 2. payAdminLiquidation lanza un error si la fila no existe.
 * 3. payAllAdminLiquidations marca todas las filas como pagadas.
 */

import { payAdminLiquidation } from "../pay-admin-liquidation";
import { payAllAdminLiquidations } from "../pay-all-admin-liquidations";
import { listAdminLiquidations, resetAdminLiquidationsStore } from "../../mocks/admin-liquidations.store";

describe("payAdminLiquidation", () => {
  beforeEach(() => {
    resetAdminLiquidationsStore();
  });

  it("marca solo la fila indicada como pagada", async () => {
    await payAdminLiquidation("liq-maria-torres");
    const rows = listAdminLiquidations();
    expect(rows.find((row) => row.id === "liq-maria-torres")?.paid).toBe(true);
    expect(rows.find((row) => row.id === "liq-joel-coila")?.paid).toBe(false);
  });

  it("lanza un error si la fila no existe", async () => {
    await expect(payAdminLiquidation("liq-inexistente")).rejects.toThrow();
  });
});

describe("payAllAdminLiquidations", () => {
  beforeEach(() => {
    resetAdminLiquidationsStore();
  });

  it("marca todas las filas como pagadas", async () => {
    const result = await payAllAdminLiquidations();
    expect(result.every((row) => row.paid)).toBe(true);
  });
});
