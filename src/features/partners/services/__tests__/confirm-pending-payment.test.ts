/**
 * Tests: confirmPendingPayment
 *
 * Comportamiento verificado:
 * 1. Marca la confirmación como pagada (confirmed: true).
 * 2. No afecta a otras confirmaciones pendientes.
 * 3. Lanza un error si la confirmación no existe.
 */

import { confirmPendingPayment } from "../confirm-pending-payment";
import {
  listPendingPaymentConfirmations,
  resetPendingPaymentConfirmationsStore,
} from "../../mocks/pending-payment-confirmations.store";

describe("confirmPendingPayment", () => {
  beforeEach(() => {
    resetPendingPaymentConfirmationsStore();
  });

  it("marca la confirmación como pagada", async () => {
    const result = await confirmPendingPayment("ppc-kunca-deco");
    expect(result.confirmed).toBe(true);
  });

  it("no afecta a otras confirmaciones", async () => {
    await confirmPendingPayment("ppc-kunca-deco");
    const other = listPendingPaymentConfirmations().find((item) => item.id === "ppc-cafe-norte");
    expect(other?.confirmed).toBe(false);
  });

  it("lanza un error si no existe", async () => {
    await expect(confirmPendingPayment("ppc-inexistente")).rejects.toThrow();
  });
});
