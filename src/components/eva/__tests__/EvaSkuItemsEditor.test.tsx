import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import EvaSkuItemsEditor from "../EvaSkuItemsEditor";

const ITEMS = [
  { productVariantId: "v1", sku: "SINSIN-1", productName: "Billetera", quantity: 2 },
  { productVariantId: null, sku: "S/SKU", productName: "Suelto", quantity: 1 },
];

it("precarga el código vinculado y marca 'vinculado' / 'nuevo'", () => {
  render(
    <EvaSkuItemsEditor orderId="o1" items={ITEMS} codes={{ "v:v1": "FEMI064" }} linkedCodes={{ "v:v1": "FEMI064" }} onChange={jest.fn()} />,
  );
  expect(screen.getByLabelText("SKU EVA de Billetera")).toHaveValue("FEMI064");
  expect(screen.getByText("vinculado")).toBeInTheDocument();
  expect(screen.getByText("nuevo")).toBeInTheDocument();
});

it("onChange recibe la clave por variante o por fila", async () => {
  const onChange = jest.fn();
  render(<EvaSkuItemsEditor orderId="o1" items={ITEMS} codes={{}} linkedCodes={{}} onChange={onChange} />);
  await userEvent.type(screen.getByLabelText("SKU EVA de Suelto"), "X");
  expect(onChange).toHaveBeenLastCalledWith("o:o1:1", "X");
});
