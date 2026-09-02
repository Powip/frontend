import type { OrderStatus } from "@/interfaces/IOrder";
import { computeBulkAvailableStatuses } from "../types";
import type { Sale } from "../types";

/**
 * `computeBulkAvailableStatuses` — intersección de los estados siguientes
 * válidos para una selección de pedidos (regla de acción masiva).
 *
 * Solo lee `sale.status`, así que las fixtures son un `Sale` parcial casteado.
 */
const sale = (status: OrderStatus): Sale => ({ status }) as unknown as Sale;

describe("computeBulkAvailableStatuses", () => {
  it("selección vacía → []", () => {
    expect(computeBulkAvailableStatuses([])).toEqual([]);
  });

  it("selección solo-PAGADO → ['PREPARADO'] (ANULADO se excluye de las acciones masivas)", () => {
    expect(computeBulkAvailableStatuses([sale("PAGADO"), sale("PAGADO")])).toEqual(
      ["PREPARADO"],
    );
  });

  it("selección mixta PAGADO + PREPARADO → [] (no hay un único estado siguiente válido para ambos)", () => {
    // PAGADO admite solo PREPARADO; PREPARADO admite LLAMADO / EN_ENVIO.
    // La intersección es vacía — correcto: no se ofrece ninguna transición masiva.
    expect(
      computeBulkAvailableStatuses([sale("PAGADO"), sale("PREPARADO")]),
    ).toEqual([]);
  });

  it("selección mixta PENDIENTE + PREPARADO → intersección real ['LLAMADO', 'EN_ENVIO']", () => {
    expect(
      computeBulkAvailableStatuses([sale("PENDIENTE"), sale("PREPARADO")]),
    ).toEqual(["LLAMADO", "EN_ENVIO"]);
  });

  it("si algún pedido está ANULADO no se ofrece ningún estado", () => {
    expect(
      computeBulkAvailableStatuses([sale("PAGADO"), sale("ANULADO")]),
    ).toEqual([]);
  });
});
