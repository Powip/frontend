/* eslint-disable @typescript-eslint/no-require-imports */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HistorialTab } from "@/app/operaciones/pedidos/_components/HistorialTab";
import { mapOrderToSale, type PedidosActions } from "@/app/operaciones/pedidos/_components/types";
import type { ShippingGuideData } from "@/components/modals/CustomerServiceModal";
import type { OrderHeader } from "@/interfaces/IOrder";
import {
  OrderDetailButton,
  OrderDetailModalProvider,
  useOrderDetailModal,
} from "../OrderDetailModal";

/**
 * Botón «Ver» compartido + modal general del pedido.
 *
 * CustomerServiceModal se reemplaza por un stub que expone las props que
 * recibe: lo que se prueba es la integración (qué pedido, qué variante, cuándo
 * se monta), no el contenido del modal.
 */
const modalSpy = jest.fn();

jest.mock("@/components/modals/CustomerServiceModal", () => ({
  __esModule: true,
  default: (props: {
    open: boolean;
    orderId: string;
    onClose: () => void;
    isOperaciones?: boolean;
    showTracking?: boolean;
    initialTab?: string;
    shippingGuide?: unknown;
  }) => {
    const React = require("react");
    modalSpy(props);
    if (!props.open) return null;
    return React.createElement(
      "div",
      { role: "dialog", "aria-label": "Detalle del Pedido" },
      React.createElement("span", null, `pedido:${props.orderId}`),
      React.createElement("button", { type: "button", onClick: props.onClose }, "Cerrar"),
    );
  },
}));

const lastModalProps = () => modalSpy.mock.calls[modalSpy.mock.calls.length - 1][0];

beforeEach(() => {
  modalSpy.mockClear();
});

describe("OrderDetailButton", () => {
  it("muestra icono + «Ver» con un nombre accesible que identifica el pedido", () => {
    render(
      <OrderDetailModalProvider>
        <OrderDetailButton orderId="o-1" orderNumber="PED-001" />
      </OrderDetailModalProvider>,
    );

    const btn = screen.getByRole("button", { name: "Ver detalle del pedido PED-001" });
    expect(btn).toHaveTextContent("Ver");
    expect(btn.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("no monta el modal hasta la primera apertura (sin carga por fila)", () => {
    render(
      <OrderDetailModalProvider>
        <OrderDetailButton orderId="o-1" orderNumber="PED-001" />
        <OrderDetailButton orderId="o-2" orderNumber="PED-002" />
      </OrderDetailModalProvider>,
    );

    expect(modalSpy).not.toHaveBeenCalled();
  });

  it("abre el pedido de su fila con las opciones del proveedor, y se puede cerrar y reabrir", async () => {
    const user = userEvent.setup();
    const onOrderUpdated = jest.fn();
    render(
      <OrderDetailModalProvider isOperaciones showTracking onOrderUpdated={onOrderUpdated}>
        <OrderDetailButton orderId="o-1" orderNumber="PED-001" />
        <OrderDetailButton orderId="o-2" orderNumber="PED-002" />
      </OrderDetailModalProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Ver detalle del pedido PED-002" }));
    expect(await screen.findByRole("dialog")).toHaveTextContent("pedido:o-2");
    expect(lastModalProps()).toMatchObject({
      open: true,
      orderId: "o-2",
      isOperaciones: true,
      showTracking: true,
      onOrderUpdated,
    });

    await user.click(screen.getByRole("button", { name: "Cerrar" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Ver detalle del pedido PED-001" }));
    expect(await screen.findByRole("dialog")).toHaveTextContent("pedido:o-1");

    await user.click(screen.getByRole("button", { name: "Cerrar" }));
    await user.click(screen.getByRole("button", { name: "Ver detalle del pedido PED-001" }));
    expect(await screen.findByRole("dialog")).toHaveTextContent("pedido:o-1");
  });

  it("no dispara el onClick de la fila contenedora", async () => {
    const user = userEvent.setup();
    const onRowClick = jest.fn();
    render(
      <OrderDetailModalProvider>
        <table>
          <tbody>
            <tr onClick={onRowClick}>
              <td>
                <OrderDetailButton orderId="o-1" orderNumber="PED-001" />
              </td>
            </tr>
          </tbody>
        </table>
      </OrderDetailModalProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Ver detalle del pedido PED-001" }));
    await screen.findByRole("dialog");
    expect(onRowClick).not.toHaveBeenCalled();
  });

  it("pasa los datos propios de la fila (guía) sin perder las opciones de la página", async () => {
    const user = userEvent.setup();
    const guide: ShippingGuideData = {
      id: "g-1",
      guideNumber: "SH-1",
      status: "EN_RUTA",
      deliveryZone: "LIMA",
      deliveryType: "DOMICILIO",
      created_at: "2026-09-01T15:00:00.000Z",
    };
    render(
      <OrderDetailModalProvider hideCallManagement>
        <OrderDetailButton orderId="o-1" orderNumber="PED-001" shippingGuide={guide} />
        <OrderDetailButton orderId="o-2" orderNumber="PED-002" shippingGuide={null} />
      </OrderDetailModalProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Ver detalle del pedido PED-001" }));
    await screen.findByRole("dialog");
    expect(lastModalProps()).toMatchObject({
      orderId: "o-1",
      shippingGuide: guide,
      hideCallManagement: true,
    });

    await user.click(screen.getByRole("button", { name: "Cerrar" }));
    await user.click(screen.getByRole("button", { name: "Ver detalle del pedido PED-002" }));
    await waitFor(() =>
      expect(lastModalProps()).toMatchObject({ open: true, orderId: "o-2", shippingGuide: null }),
    );
  });

  it("respeta un nombre accesible propio (vistas de seguimiento)", () => {
    render(
      <OrderDetailModalProvider initialTab="seguimiento">
        <OrderDetailButton orderId="o-1" ariaLabel="Ver seguimiento del pedido PED-001" />
      </OrderDetailModalProvider>,
    );

    expect(
      screen.getByRole("button", { name: "Ver seguimiento del pedido PED-001" }),
    ).toHaveTextContent("Ver");
  });

  it("fuera de un proveedor falla con un mensaje claro", () => {
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<OrderDetailButton orderId="o-1" />)).toThrow(/OrderDetailModalProvider/);
    spy.mockRestore();
  });
});

describe("useOrderDetailModal — apertura programática", () => {
  function Rastrear() {
    const { openOrderDetail } = useOrderDetailModal();
    return (
      <button type="button" onClick={() => openOrderDetail("o-9")}>
        Rastrear
      </button>
    );
  }

  it("abre el mismo modal sin el botón compartido", async () => {
    const user = userEvent.setup();
    render(
      <OrderDetailModalProvider isOperaciones>
        <Rastrear />
      </OrderDetailModalProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Rastrear" }));
    expect(await screen.findByRole("dialog")).toHaveTextContent("pedido:o-9");
    expect(lastModalProps()).toMatchObject({ isOperaciones: true });
  });
});

describe("integración con una tabla (Operaciones › Historial)", () => {
  function makeOrder(n: number): OrderHeader {
    return {
      id: `o-${n}`,
      orderNumber: `PED-00${n}`,
      customer: { id: `c-${n}`, fullName: `Cliente ${n}`, phoneNumber: "999111222" },
      deliveryType: "DOMICILIO",
      grandTotal: "50.00",
      status: "ENTREGADO",
      salesRegion: "LIMA",
      items: [],
      payments: [],
      created_at: "2026-09-01T15:00:00.000Z",
      updated_at: "2026-09-01T15:00:00.000Z",
    } as unknown as OrderHeader;
  }

  it("cada fila abre su propio pedido con la variante de Operaciones", async () => {
    const user = userEvent.setup();
    const actions = {
      can: () => true,
      apiCouriers: [],
      salesChannels: [],
      isBulkLoading: false,
      onExportExcel: jest.fn(),
    } as unknown as PedidosActions;

    render(
      <OrderDetailModalProvider isOperaciones showTracking>
        <HistorialTab sales={[makeOrder(1), makeOrder(2)].map(mapOrderToSale)} actions={actions} />
      </OrderDetailModalProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Ver detalle del pedido PED-002" }));
    expect(await screen.findByRole("dialog")).toHaveTextContent("pedido:o-2");
    expect(lastModalProps()).toMatchObject({ isOperaciones: true, showTracking: true });
  });
});
