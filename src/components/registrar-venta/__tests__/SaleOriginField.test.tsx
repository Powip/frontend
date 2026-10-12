import { render, screen } from "@testing-library/react";
import { SaleOriginField } from "../SaleOriginField";

describe("Campo de origen de venta", () => {
  it("muestra la única tienda sin un selector innecesario", () => {
    render(<SaleOriginField label="Tienda de la venta" options={[{ id: "a", name: "Tienda A" }]} value="a" onChange={jest.fn()} />);
    expect(screen.getByRole("textbox", { name: /Tienda de la venta/ })).toHaveValue("Tienda A");
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("ofrece un selector obligatorio si hay varias tiendas", () => {
    render(<SaleOriginField label="Tienda de la venta" options={[{ id: "a", name: "A" }, { id: "b", name: "B" }]} value="" onChange={jest.fn()} />);
    expect(screen.getByRole("combobox", { name: /Tienda de la venta/ })).toHaveAttribute("aria-required", "true");
    expect(screen.getByText("Selecciona una tienda")).toBeInTheDocument();
  });

  it("explica el almacén desconocido de una venta histórica sin mostrar un UUID", () => {
    render(<SaleOriginField label="Almacén de salida" options={[{ id: "a", name: "Central" }]} value="" onChange={jest.fn()} readOnly />);
    expect(screen.getByRole("textbox", { name: "Almacén de salida" })).toHaveValue("Almacén no registrado");
  });

  it("conserva una tienda guardada que ya no está disponible para nuevas ventas", () => {
    render(<SaleOriginField label="Tienda de la venta" options={[]} value="archived" onChange={jest.fn()} readOnly />);
    expect(screen.getByRole("textbox", { name: "Tienda de la venta" })).toHaveValue("Tienda registrada");
  });

  it("bloquea el cambio de almacén y mantiene la explicación accesible", () => {
    render(<SaleOriginField label="Almacén de salida" options={[{ id: "a", name: "A" }, { id: "b", name: "B" }]} value="a" onChange={jest.fn()} disabled hint="Vacía el carrito para cambiar de almacén." />);
    const field = screen.getByRole("combobox", { name: /Almacén de salida/ });
    expect(field).toBeDisabled();
    expect(field).toHaveAccessibleDescription("Vacía el carrito para cambiar de almacén.");
  });
});
