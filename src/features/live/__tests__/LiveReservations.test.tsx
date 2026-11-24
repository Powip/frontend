import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import LiveReservationsPanel from "../LiveReservationsPanel";
import type { LiveConsoleData, LiveReservation } from "../types";

const reservation = (
  id: string,
  extra: Partial<LiveReservation> = {},
): LiveReservation => ({
  id,
  variantId: "v",
  productName: "Short Sastre Luisa",
  variantLabel: "Gris / M",
  quantity: 1,
  unitPrice: 119,
  customer: { id: "ana", name: "Ana Torres", phone: "912345678" },
  status: "ACTIVE",
  expiresAt: "2026-11-24T12:10:00Z",
  createdAt: "2026-11-24T12:00:00Z",
  type: "TIMED",
  ...extra,
});
const data = (
  reservations: LiveReservation[],
  extra: Partial<LiveConsoleData> = {},
) =>
  ({
    config: { allowAccumulation: true },
    products: [],
    reservations,
    customers: [
      { id: "ana", name: "Ana Torres", phone: "912345678" },
      { id: "rosa", name: "Rosa Paz", phone: "948221730" },
      { id: "luz", name: "Luz Díaz", phone: "933111222" },
    ],
    trustedCustomers: [{ id: "luz", name: "Luz Díaz", phone: "933111222" }],
    serverNow: "2026-11-24T12:00:00Z",
    ...extra,
  }) as unknown as LiveConsoleData;
const handlers = () => ({
  onRelease: jest.fn(),
  onTrust: jest.fn(),
  onTrustPhone: jest.fn().mockResolvedValue(true),
  onPaymentLink: jest.fn(),
  onReviewPayments: jest.fn(),
});
const panel = (value: LiveConsoleData, h = handlers()) => {
  render(
    <LiveReservationsPanel
      data={value}
      canManage
      canOperate
      busy={false}
      {...h}
    />,
  );
  return h;
};

const sample = [
  reservation("t1", { quantity: 2 }),
  reservation("t2", { expiresAt: "2026-11-24T12:05:00Z", productName: "Polo" }),
  reservation("t3", {
    customer: { id: "bea", name: "Bea Ruiz", phone: "923456789" },
  }),
  reservation("a1", {
    type: "ACCUMULATED",
    expiresAt: null,
    customer: { id: "luz", name: "Luz Díaz", phone: "933111222" },
  }),
  reservation("r1", {
    checkoutId: "c1",
    reviewHold: true,
    customer: { id: "rosa", name: "Rosa Paz", phone: "948221730" },
  }),
  reservation("p1", {
    status: "PAID",
    customer: { id: "rosa", name: "Rosa Paz", phone: "948221730" },
  }),
  reservation("x1", { status: "EXPIRED" }),
];

describe("Apartados (FEAT-33 A3)", () => {
  test("opens on «Con tiempo» and every tab counts the cards it lists", () => {
    panel(data(sample));
    expect(screen.getByRole("tab", { name: /Con tiempo/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("tab", { name: /Con tiempo/ })).toHaveTextContent(
      "2",
    );
    expect(
      screen.getByRole("tab", { name: /Separado sin pagar/ }),
    ).toHaveTextContent("1");
    expect(
      screen.getByRole("tab", { name: /Pago por validar/ }),
    ).toHaveTextContent("1");
    expect(screen.getByRole("tab", { name: /Pagados/ })).toHaveTextContent("1");
    expect(screen.getAllByRole("article")).toHaveLength(2);
  });

  test("one card per customer with all their items, the total and a single timer", () => {
    panel(data(sample));
    const ana = screen.getByRole("article", { name: "Ana Torres" });
    expect(ana).toHaveTextContent("2 × Short Sastre Luisa");
    expect(ana).toHaveTextContent("1 × Polo");
    expect(ana).toHaveTextContent("3 unidades");
    expect(ana).toHaveTextContent("S/ 357.00");
    expect(within(ana).getAllByText(/^\d{2}:\d{2}$|Vencido/)).toHaveLength(1);
  });

  test("Link de pago and Liberar act on that customer's holds", () => {
    const h = panel(data(sample));
    const ana = screen.getByRole("article", { name: "Ana Torres" });
    fireEvent.click(within(ana).getByRole("button", { name: /Link de pago/ }));
    expect(h.onPaymentLink).toHaveBeenCalledWith(
      expect.objectContaining({ id: "t1" }),
    );
    fireEvent.click(within(ana).getByRole("button", { name: /Liberar/ }));
    expect(h.onRelease).toHaveBeenCalledWith([
      expect.objectContaining({ id: "t1" }),
      expect.objectContaining({ id: "t2" }),
    ]);
  });

  test("Pago por validar sends to the payment review", () => {
    const h = panel(data(sample));
    fireEvent.click(screen.getByRole("tab", { name: /Pago por validar/ }));
    const rosa = screen.getByRole("article", { name: "Rosa Paz" });
    expect(
      within(rosa).queryByRole("button", { name: /Liberar/ }),
    ).not.toBeInTheDocument();
    fireEvent.click(
      within(rosa).getByRole("button", { name: "Validar pago →" }),
    );
    expect(h.onReviewPayments).toHaveBeenCalled();
  });

  test("an empty tab says so", () => {
    panel(data([]));
    expect(
      screen.getByText("No hay apartados con tiempo."),
    ).toBeInTheDocument();
  });
});

describe("Clientes de confianza (FEAT-33 A3/D3)", () => {
  const openTrusted = (value = data(sample), h = handlers()) => {
    panel(value, h);
    fireEvent.click(screen.getByRole("tab", { name: /Separado sin pagar/ }));
    return h;
  };

  test("finds a customer by name or WhatsApp and marks them trusted", () => {
    const h = openTrusted();
    const search = screen.getByLabelText(
      "Buscar cliente por nombre o WhatsApp",
    );
    fireEvent.change(search, { target: { value: "rosa" } });
    fireEvent.click(
      screen.getByRole("button", { name: "Marcar de confianza a Rosa Paz" }),
    );
    expect(h.onTrust).toHaveBeenCalledWith("rosa");
    fireEvent.change(search, { target: { value: "948 221" } });
    expect(
      screen.getByRole("button", { name: "Marcar de confianza a Rosa Paz" }),
    ).toBeInTheDocument();
    fireEvent.change(search, { target: { value: "luz" } });
    expect(
      screen.queryByRole("button", { name: "Marcar de confianza a Luz Díaz" }),
    ).not.toBeInTheDocument();
  });

  test("adds a WhatsApp that never entered the live", async () => {
    const h = openTrusted();
    fireEvent.change(screen.getByLabelText("Nombre"), {
      target: { value: "Carla" },
    });
    fireEvent.change(screen.getByLabelText("WhatsApp"), {
      target: { value: "+51 955 444 333" },
    });
    fireEvent.click(screen.getByRole("button", { name: "＋ Agregar" }));
    await waitFor(() =>
      expect(h.onTrustPhone).toHaveBeenCalledWith({
        name: "Carla",
        phone: "955444333",
      }),
    );
    await waitFor(() =>
      expect(screen.getByLabelText("WhatsApp")).toHaveValue(""),
    );
  });

  test("an invalid WhatsApp is not sent", () => {
    const h = openTrusted();
    fireEvent.change(screen.getByLabelText("Nombre"), {
      target: { value: "Carla" },
    });
    fireEvent.change(screen.getByLabelText("WhatsApp"), {
      target: { value: "12345" },
    });
    fireEvent.click(screen.getByRole("button", { name: "＋ Agregar" }));
    expect(screen.getByLabelText("WhatsApp")).toHaveAccessibleDescription(
      /9 dígitos/,
    );
    expect(h.onTrustPhone).not.toHaveBeenCalled();
  });

  test("Quitar removes the trust", () => {
    const h = openTrusted();
    fireEvent.click(
      screen.getByRole("button", { name: "Quitar confianza a Luz Díaz" }),
    );
    expect(h.onTrust).toHaveBeenCalledWith("luz", true);
  });

  test("warns when accumulation is off in Configuración", () => {
    openTrusted(
      data(sample, {
        config: { allowAccumulation: false } as LiveConsoleData["config"],
      }),
    );
    expect(
      screen.getByText(/Está apagado en Configuración/),
    ).toBeInTheDocument();
  });
});
