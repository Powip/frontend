import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import type { InventoryUnit } from "@/services/inventoryTrackingService";
import { getAvailableInventoryUnits } from "@/services/inventoryUnitMovementService";
import AvailableInventoryUnitPicker from "../AvailableInventoryUnitPicker";
jest.mock("@/services/inventoryUnitMovementService", () => ({
  getAvailableInventoryUnits: jest.fn(),
}));
const source = {
  inventoryItemId: "position-b",
  variantId: "variant-home-a",
  inventoryId: "warehouse-b",
  inventoryName: "Almacén B",
  productName: "Producto",
  sku: "SKU",
};
const unitA = { id: "a", code: "000A", status: "AVAILABLE" as const };
const unitB = { id: "b", code: "000B", status: "AVAILABLE" as const };
const result = {
  inventoryItemId: source.inventoryItemId,
  inventoryId: source.inventoryId,
  variantId: source.variantId,
  trackingMode: "SERIAL" as const,
  data: [unitA],
  meta: { page: 1, limit: 20, total: 2, totalPages: 2 },
};
const props = { source, companyId: "company", selected: [], onChange: jest.fn() };
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(getAvailableInventoryUnits).mockResolvedValue(result);
});
test("selects the position in warehouse B independently of the catalog product home warehouse", async () => {
  render(<AvailableInventoryUnitPicker {...props} />);
  fireEvent.click(await screen.findByRole("checkbox", { name: "000A Disponible" }));
  expect(getAvailableInventoryUnits).toHaveBeenCalledWith(
    "position-b",
    1,
    "",
    expect.any(AbortSignal),
  );
  expect(props.onChange).toHaveBeenCalledWith([unitA]);
});
test.each([
  { inventoryId: "warehouse-a" },
  { inventoryItemId: "another-position" },
  { variantId: "another-variant" },
  { data: [{ ...unitA, status: "RESERVED" }] },
  { data: [{ ...unitA, status: "SOLD" }] },
])("rejects unavailable or mismatched server rows: %j", async (invalid) => {
  jest.mocked(getAvailableInventoryUnits).mockResolvedValue({ ...result, ...invalid } as any);
  render(<AvailableInventoryUnitPicker {...props} />);
  await screen.findByRole("alert");
  expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  expect(screen.queryByText(unitA.code)).not.toBeInTheDocument();
});
test("selection survives pagination without replacing the units already selected", async () => {
  jest
    .mocked(getAvailableInventoryUnits)
    .mockImplementation(async (_id, page) =>
      page === 1 ? result : { ...result, data: [unitB], meta: { ...result.meta, page: 2 } },
    );
  function Harness() {
    const [selected, onChange] = useState<InventoryUnit[]>([]);
    return (
      <AvailableInventoryUnitPicker
        {...props}
        selected={selected}
        onChange={(units) => {
          props.onChange(units);
          onChange(units);
        }}
      />
    );
  }
  render(<Harness />);
  fireEvent.click(await screen.findByRole("checkbox", { name: "000A Disponible" }));
  fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
  fireEvent.click(await screen.findByRole("checkbox", { name: "000B Disponible" }));
  expect(props.onChange).toHaveBeenLastCalledWith([unitA, unitB]);
});
test("a late response from the previous company is aborted and discarded", async () => {
  let complete!: (value: typeof result) => void;
  jest
    .mocked(getAvailableInventoryUnits)
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          complete = resolve;
        }),
    )
    .mockRejectedValueOnce(new Error("Sin acceso"));
  const view = render(<AvailableInventoryUnitPicker {...props} />);
  await waitFor(() => expect(getAvailableInventoryUnits).toHaveBeenCalledTimes(1));
  const signal = jest.mocked(getAvailableInventoryUnits).mock.calls[0][3];
  view.rerender(<AvailableInventoryUnitPicker {...props} companyId="other" />);
  await screen.findByRole("alert");
  await act(async () => complete(result));
  expect(signal?.aborted).toBe(true);
  expect(screen.queryByText(unitA.code)).not.toBeInTheDocument();
});
test("search keeps leading zeroes intact and resets to the first page", async () => {
  render(<AvailableInventoryUnitPicker {...props} />);
  await screen.findByText("000A");
  fireEvent.change(screen.getByLabelText("Buscar código disponible"), {
    target: { value: "000A" },
  });
  await waitFor(() =>
    expect(getAvailableInventoryUnits).toHaveBeenLastCalledWith(
      "position-b",
      1,
      "000A",
      expect.any(AbortSignal),
    ),
  );
});
