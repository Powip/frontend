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

  it("«Crear marca» va primera: se ve sin bajar aunque haya muchas parecidas", () => {
    jest.mocked(useCompanyBrands).mockReturnValue({
      brands: Array.from({ length: 12 }, (_, index) => ({ id: `n-${index}`, name: `Nike ${index}` })),
      isLoading: false,
      createBrand,
    });
    render(<BrandSelect value="" onChange={jest.fn()} />);
    fireEvent.change(screen.getByLabelText("Marca"), { target: { value: "Nike" } });
    expect(screen.getAllByRole("option")[0]).toHaveAccessibleName('Crear marca "Nike"');
  });

  it("sin marcas todavía, al abrir explica que se crean escribiendo el nombre", () => {
    jest.mocked(useCompanyBrands).mockReturnValue({ brands: [], isLoading: false, createBrand });
    render(<BrandSelect value="" onChange={jest.fn()} />);
    fireEvent.focus(screen.getByLabelText("Marca"));
    expect(screen.getByText("Aún no tienes marcas: escribe el nombre para crearla.")).toBeInTheDocument();
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
