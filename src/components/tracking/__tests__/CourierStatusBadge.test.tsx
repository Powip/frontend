import { render, screen } from "@testing-library/react";
import type { OrderHeader } from "@/interfaces/IOrder";
import {
  CourierStatusBadge,
  courierStatusFilterKey,
  getOrderCourierStatus,
} from "../CourierStatusBadge";

const olvaOrder = (overrides: Partial<OrderHeader> = {}) =>
  ({
    id: "o-1",
    orderNumber: "PED-1",
    courier: "Olva Courier",
    olvaShipmentId: "0b1f6a52-5d0e-4c8b-9c5e-3a1d2e4f5a6b",
    olvaStatus: "IN_TRANSIT",
    ...overrides,
  }) as OrderHeader;

describe("CourierStatusBadge — Olva (FEAT-35)", () => {
  it("lee el estado de Olva guardado en el pedido, en español", () => {
    expect(getOrderCourierStatus(olvaOrder())).toEqual({
      source: "olva",
      sourceLabel: "Olva",
      value: "IN_TRANSIT",
      label: "En tránsito",
    });
  });

  it("acepta la grafía del courier en cualquier caso", () => {
    expect(getOrderCourierStatus(olvaOrder({ courier: "OLVA COURIER " }))?.source).toBe("olva");
  });

  it("un pedido de Olva todavía sin envío no tiene estado de integración", () => {
    expect(getOrderCourierStatus(olvaOrder({ olvaStatus: null, olvaShipmentId: null }))).toBeNull();
  });

  it("un estado que el front no conoce se muestra como Desconocido, no en inglés", () => {
    expect(getOrderCourierStatus(olvaOrder({ olvaStatus: "SOMETHING_NEW" }))?.label).toBe(
      "Desconocido",
    );
  });

  it("agrupa el filtro por la etiqueta de Olva", () => {
    const info = getOrderCourierStatus(olvaOrder({ olvaStatus: "DELIVERED" }));

    expect(info && courierStatusFilterKey(info)).toBe("olva:Entregado");
  });

  it("el badge de la tabla muestra el estado de Olva", () => {
    render(<CourierStatusBadge order={olvaOrder({ olvaStatus: "OUT_FOR_DELIVERY" })} />);

    expect(screen.getByText("En reparto")).toBeInTheDocument();
  });

  it("sin estado de Olva el badge queda en guion", () => {
    render(<CourierStatusBadge order={olvaOrder({ olvaStatus: null })} />);

    expect(screen.getByText("—")).toBeInTheDocument();
  });
});
