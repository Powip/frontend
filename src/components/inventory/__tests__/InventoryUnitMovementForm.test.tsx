import { fireEvent, render, screen } from "@testing-library/react";
import InventoryUnitMovementForm, {
  unitMovementSelectionError,
} from "../InventoryUnitMovementForm";
import type { InventoryUnit } from "@/services/inventoryTrackingService";

const unit: InventoryUnit = { id: "unit-a", code: "001234567890123", status: "AVAILABLE" };
const source = {
  inventoryItemId: "item",
  variantId: "variant",
  inventoryId: "origin",
  inventoryName: "Principal",
  sku: "PHONE",
  productName: "Teléfono",
  attributes: { color: "Azul", capacidad: "128GB" },
};
const props = {
  companyId: "company",
  source,
  destinations: [
    { id: "origin", name: "Principal" },
    { id: "destination", name: "Sucursal" },
  ],
  selectedUnits: [unit],
  selection: <div>Selector disponible</div>,
  onConfirm: jest.fn(),
};
beforeEach(() => jest.clearAllMocks());
test("transfer keeps leading zeroes visible, excludes the origin and requires explicit destination confirmation", () => {
  render(<InventoryUnitMovementForm {...props} action="transfer" />);
  expect(screen.getByText(unit.code)).toBeInTheDocument();
  expect(screen.queryByRole("option", { name: "Principal" })).not.toBeInTheDocument();
  const submit = screen.getByRole("button", { name: "Confirmar transferencia" });
  expect(submit).toBeDisabled();
  fireEvent.change(screen.getByLabelText("Almacén de destino"), {
    target: { value: "destination" },
  });
  fireEvent.change(screen.getByLabelText("Motivo del movimiento"), {
    target: { value: "Reposición sucursal" },
  });
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(submit);
  expect(props.onConfirm).toHaveBeenCalledWith({
    quantity: 1,
    unitIds: [unit.id],
    destinationInventoryId: "destination",
    reason: "Reposición sucursal",
  });
});
test("write-off has no destination and sends only explicit available units", () => {
  render(<InventoryUnitMovementForm {...props} action="write-off" />);
  expect(screen.queryByLabelText("Almacén de destino")).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Motivo del movimiento"), {
    target: { value: "Daño físico" },
  });
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(screen.getByRole("button", { name: "Confirmar merma de unidades" }));
  expect(props.onConfirm).toHaveBeenCalledWith({
    quantity: 1,
    unitIds: [unit.id],
    reason: "Daño físico",
    shrinkageType: "otro",
    unitCost: 0,
    recoveredAmount: 0,
  });
});
test.each(["RESERVED", "SOLD", "WRITTEN_OFF"] as const)(
  "rejects unavailable %s units",
  (status) => {
    expect(unitMovementSelectionError(1, [{ ...unit, status }])).toMatch(/disponibles/);
  },
);
test("requires exact cardinality, positive integers and distinct IDs", () => {
  expect(unitMovementSelectionError(2, [unit])).toMatch(/exactamente 2/);
  expect(unitMovementSelectionError(1.5, [unit])).toMatch(/entero/);
  expect(unitMovementSelectionError(0, [])).toMatch(/entero/);
  expect(unitMovementSelectionError(2, [unit, { ...unit, id: unit.id.toUpperCase() }])).toMatch(
    /más de una vez/,
  );
});
test("changing company clears the reason, destination and physical confirmation immediately", () => {
  const view = render(<InventoryUnitMovementForm {...props} action="transfer" />);
  fireEvent.change(screen.getByLabelText("Almacén de destino"), {
    target: { value: "destination" },
  });
  fireEvent.change(screen.getByLabelText("Motivo del movimiento"), {
    target: { value: "Reposición" },
  });
  fireEvent.click(screen.getByRole("checkbox"));
  view.rerender(
    <InventoryUnitMovementForm {...props} companyId="another-company" action="transfer" />,
  );
  expect(screen.getByLabelText("Motivo del movimiento")).toHaveValue("");
  expect(screen.getByLabelText("Almacén de destino")).toHaveValue("");
  expect(screen.getByRole("checkbox")).not.toBeChecked();
  expect(screen.getByRole("button", { name: "Confirmar transferencia" })).toBeDisabled();
});

test.each(["-1", "1.234", "10000000000"])(
  "rejects money %s before a request is saved",
  (invalid) => {
    render(<InventoryUnitMovementForm {...props} action="write-off" />);
    fireEvent.change(screen.getByLabelText("Motivo del movimiento"), { target: { value: "Daño" } });
    fireEvent.change(screen.getByLabelText("Costo unitario S/"), { target: { value: invalid } });
    fireEvent.click(screen.getByRole("checkbox"));
    expect(screen.getByRole("button", { name: "Confirmar merma de unidades" })).toBeDisabled();
    expect(props.onConfirm).not.toHaveBeenCalled();
  },
);
test("the explicit zero cost and recovery remain zero in the merma request", () => {
  render(<InventoryUnitMovementForm {...props} action="write-off" />);
  fireEvent.change(screen.getByLabelText("Tipo de merma"), { target: { value: "daño_almacen" } });
  fireEvent.change(screen.getByLabelText("Motivo del movimiento"), {
    target: { value: "Garantía sin costo" },
  });
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(screen.getByRole("button", { name: "Confirmar merma de unidades" }));
  expect(props.onConfirm).toHaveBeenCalledWith(
    expect.objectContaining({ shrinkageType: "daño_almacen", unitCost: 0, recoveredAmount: 0 }),
  );
});
