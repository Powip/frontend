import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import InventoryUnitsModal from "../InventoryUnitsModal";
import { getInventoryUnits } from "@/services/inventoryTrackingService";
jest.mock("@/services/inventoryTrackingService", () => ({
  ...jest.requireActual("@/services/inventoryTrackingService"),
  getInventoryUnits: jest.fn(),
}));

it("paginates units and resets to page one when searching an IMEI as text", async () => {
  const get = jest.mocked(getInventoryUnits);
  get.mockResolvedValue({
    data: [{ id: "unit", code: "001234567890123", status: "AVAILABLE" }],
    meta: { total: 21, totalPages: 2 },
  });
  render(
    <InventoryUnitsModal
      companyId="company"
      inventoryItemId="item"
      productName="Celular"
      onClose={jest.fn()}
    />,
  );
  await screen.findByText("001234567890123");
  expect(screen.getByText("Disponible")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
  await waitFor(() => expect(get).toHaveBeenLastCalledWith("item", 2, "", expect.any(AbortSignal)));
  fireEvent.change(screen.getByLabelText("Buscar IMEI o serie"), { target: { value: "001234" } });
  await waitFor(() =>
    expect(get).toHaveBeenLastCalledWith("item", 1, "001234", expect.any(AbortSignal)),
  );
});

it("opens the selected unit history with its complete code as text", async () => {
  jest
    .mocked(getInventoryUnits)
    .mockResolvedValue({
      data: [{ id: "unit", code: "001234567890123", status: "SOLD" }],
      meta: { total: 1, totalPages: 1 },
    });
  const history = jest.fn();
  render(
    <InventoryUnitsModal
      companyId="company"
      inventoryItemId="item"
      productName="Celular"
      onClose={jest.fn()}
      onViewHistory={history}
    />,
  );
  fireEvent.click(await screen.findByRole("button", { name: "Ver historial de 001234567890123" }));
  expect(history).toHaveBeenCalledWith("001234567890123");
});
