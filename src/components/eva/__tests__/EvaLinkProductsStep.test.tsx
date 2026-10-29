import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import EvaLinkProductsStep from "../EvaLinkProductsStep";

const CANDIDATES = [
  { variantId: "v1", productName: "Billetera", powipSku: "SINSIN-1", totalQuantity: 7, orderCount: 3 },
  { variantId: "v2", productName: "Monedero", powipSku: "SINSIN-2", totalQuantity: 1, orderCount: 1 },
];

it("muestra cada variante una vez con su cantidad y pedidos", () => {
  render(<EvaLinkProductsStep candidates={CANDIDATES} saving={false} onSave={jest.fn()} />);
  expect(screen.getByText("Billetera")).toBeInTheDocument();
  expect(screen.getByText(/x7 · 3 pedidos/)).toBeInTheDocument();
  expect(screen.getByText(/2 productos sin código EVA/)).toBeInTheDocument();
});

it("guarda solo los códigos escritos (sin espacios) por variantId", async () => {
  const onSave = jest.fn().mockResolvedValue(undefined);
  render(<EvaLinkProductsStep candidates={CANDIDATES} saving={false} onSave={onSave} />);
  await userEvent.type(screen.getByLabelText("SKU EVA de Billetera"), " FEMI064 ");
  await userEvent.click(screen.getByRole("button", { name: /guardar vínculos y seguir/i }));
  expect(onSave).toHaveBeenCalledWith({ v1: "FEMI064" });
});

it("deshabilita guardar si hay un código inválido", async () => {
  render(<EvaLinkProductsStep candidates={CANDIDATES} saving={false} onSave={jest.fn()} />);
  await userEvent.type(screen.getByLabelText("SKU EVA de Billetera"), "FEMI(1)");
  expect(screen.getByRole("button", { name: /guardar vínculos y seguir/i })).toBeDisabled();
});
