import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { toast } from "sonner";
import { ReservationWarehouseControl } from "../ReservationWarehouseControl";
import { changeReservationWarehouse } from "@/services/orderStockService";
import { listWarehouses } from "@/services/warehousesService";

jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
jest.mock("@/services/orderStockService", () => ({ changeReservationWarehouse: jest.fn() }));
jest.mock("@/services/warehousesService", () => ({ listWarehouses: jest.fn() }));

const warehouse = (id: string, name: string, status = true) => ({
  id,
  name,
  status,
  store_id: "s-1",
  company_id: "c-1",
  type: "PROPIO" as const,
  is_main: id === "inv-1",
});

function renderControl(order: Parameters<typeof ReservationWarehouseControl>[0]["order"], onChanged = jest.fn()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <ReservationWarehouseControl companyId="c-1" order={order} onChanged={onChanged} />
    </QueryClientProvider>,
  );
  return { onChanged };
}

describe("cambiar el almacén de la reserva (FEAT-24 H2-F)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(listWarehouses).mockResolvedValue({
      warehouses: [warehouse("inv-1", "Central"), warehouse("inv-2", "Arequipa"), warehouse("inv-3", "Cerrado", false)],
      links: [],
    });
  });

  it("cambia a otro almacén activo y avisa", async () => {
    const user = userEvent.setup();
    jest.mocked(changeReservationWarehouse).mockResolvedValue({});
    const { onChanged } = renderControl({ id: "o-1", status: "PREPARADO", stockState: "reserved", inventoryId: "inv-1" });
    const select = await screen.findByRole("combobox", { name: "Almacén de la reserva" });
    expect(screen.queryByRole("option", { name: /Cerrado/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cambiar almacén" })).toBeDisabled();
    await user.selectOptions(select, "inv-2");
    await user.click(screen.getByRole("button", { name: "Cambiar almacén" }));

    expect(changeReservationWarehouse).toHaveBeenCalledWith("o-1", "inv-2");
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    expect(toast.success).toHaveBeenCalledWith("La reserva pasa al almacén Arequipa");
  });

  it("un 409 del servidor se muestra tal cual", async () => {
    const user = userEvent.setup();
    jest.mocked(changeReservationWarehouse).mockRejectedValue({
      response: { status: 409, data: { message: "Un pedido con IMEI o series no puede cambiar de almacén." } },
    });
    const { onChanged } = renderControl({ id: "o-1", status: "PREPARADO", inventoryId: "inv-1" });
    await user.selectOptions(await screen.findByRole("combobox", { name: "Almacén de la reserva" }), "inv-2");
    await user.click(screen.getByRole("button", { name: "Cambiar almacén" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Un pedido con IMEI o series no puede cambiar de almacén.");
    expect(onChanged).not.toHaveBeenCalled();
  });

  it.each([
    [{ status: "EN_ENVIO" }],
    [{ status: "DESPACHADO" }],
    [{ status: "PREPARADO", stockState: "dispatched" }],
    [{ status: "PREPARADO", externalSource: "POWIP_LIVE" }],
  ])("no se ofrece después del despacho ni en Live (%o)", (extra) => {
    renderControl({ id: "o-1", inventoryId: "inv-1", ...extra });
    expect(screen.queryByTestId("reservation-warehouse")).not.toBeInTheDocument();
    expect(listWarehouses).not.toHaveBeenCalled();
  });
});
