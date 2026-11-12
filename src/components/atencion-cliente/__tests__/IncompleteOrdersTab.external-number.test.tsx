import { render, screen } from "@testing-library/react";

/**
 * Atención al cliente › pedidos con errores de sincronización — «N° Externo» (FEAT-31).
 * Son justo los pedidos de Shopify que quedaron INCOMPLETE: el número de Shopify ayuda a
 * ubicarlos. La columna solo se dibuja si alguno lo trae.
 */
jest.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ auth: { user: { id: "u-1" }, company: { id: "c-1", stores: [] } } }) }));
jest.mock("@/components/atencion-cliente/RepairOrderModal", () => ({ RepairOrderModal: () => null }));
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

import type { OrderHeader } from "@/interfaces/IOrder";
import { IncompleteOrdersTab } from "../IncompleteOrdersTab";

function incompleto(id: string, orderNumber: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    orderNumber,
    status: "INCOMPLETE",
    externalSource: "shopify",
    syncErrors: { phoneNumber: "formato inválido" },
    customer: { fullName: `Cliente ${orderNumber}` },
    created_at: "2026-09-25T15:00:00.000Z",
    ...overrides,
  } as unknown as OrderHeader;
}

describe("IncompleteOrdersTab — N° Externo", () => {
  it("con un pedido que trae N° externo muestra la columna y el número", () => {
    render(<IncompleteOrdersTab orders={[incompleto("o-1", "ORD-001", { externalOrderNumber: "AGPE923190" }), incompleto("o-2", "ORD-002")]} isLoading={false} onRepaired={jest.fn()} />);

    expect(screen.getByRole("columnheader", { name: "N° Externo" })).toBeInTheDocument();
    expect(screen.getByText("AGPE923190")).toBeInTheDocument();
  });

  it("sin ningún N° externo no dibuja la columna", () => {
    render(<IncompleteOrdersTab orders={[incompleto("o-1", "ORD-001")]} isLoading={false} onRepaired={jest.fn()} />);

    expect(screen.getByRole("columnheader", { name: "N° Pedido" })).toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "N° Externo" })).not.toBeInTheDocument();
  });
});
