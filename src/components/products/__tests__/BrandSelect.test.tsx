import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import BrandSelect from "../BrandSelect";
import { useCompanyBrands } from "@/hooks/useCompanyBrands";

jest.mock("@/hooks/useCompanyBrands", () => ({ useCompanyBrands: jest.fn() }));
const createBrand = jest.fn();

describe("BrandSelect (FEAT-24 H0)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(useCompanyBrands).mockReturnValue({ brands: [{ id: "nike", name: "Nike" }, { id: "puma", name: "Puma" }], isLoading: false, createBrand });
    createBrand.mockResolvedValue({ id: "adidas", name: "Adidas" });
  });

  it("lista las marcas de la empresa y elige una", () => {
    const onChange = jest.fn();
    render(<BrandSelect value="" onChange={onChange} />);
    fireEvent.focus(screen.getByLabelText("Marca"));
    fireEvent.click(screen.getByRole("option", { name: "Puma" }));
    expect(onChange).toHaveBeenCalledWith("puma");
  });

  it("ofrece crear la marca si no existe", async () => {
    const onChange = jest.fn();
    render(<BrandSelect value="" onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("Marca"), { target: { value: "Adidas" } });
    fireEvent.click(screen.getByRole("option", { name: 'Crear marca "Adidas"' }));
    await waitFor(() => expect(createBrand).toHaveBeenCalledWith("Adidas"));
    expect(onChange).toHaveBeenCalledWith("adidas");
  });

  it("no ofrece crear si ya existe con otro formato", () => {
    render(<BrandSelect value="" onChange={jest.fn()} />);
    fireEvent.change(screen.getByLabelText("Marca"), { target: { value: " nike " } });
    expect(screen.queryByRole("option", { name: /Crear marca/ })).not.toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Nike" })).toBeInTheDocument();
  });

  it("muestra la marca elegida y permite quitarla", () => {
    const onChange = jest.fn();
    render(<BrandSelect value="nike" onChange={onChange} />);
    expect(screen.getByLabelText("Marca")).toHaveValue("Nike");
    fireEvent.focus(screen.getByLabelText("Marca"));
    fireEvent.click(screen.getByRole("option", { name: "Sin marca" }));
    expect(onChange).toHaveBeenCalledWith("");
  });
});
