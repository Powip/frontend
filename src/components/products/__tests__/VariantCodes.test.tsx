import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import VariantCodes from "../VariantCodes";

jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

describe("códigos de la variante en la ficha (FEAT-24 H2-F)", () => {
  beforeEach(() => jest.clearAllMocks());

  it("muestra el código de fábrica y el EAN de POWIP, y copia el EAN", async () => {
    const user = userEvent.setup();
    const writeText = jest.spyOn(navigator.clipboard, "writeText").mockResolvedValue(undefined);
    render(<VariantCodes sku="POW-1" barcode="7750000000001" powipEan="2000000000015" />);
    expect(screen.getByText("Código de fábrica")).toBeInTheDocument();
    expect(screen.getByText("7750000000001")).toBeInTheDocument();
    expect(screen.getByText("2000000000015")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Copiar EAN de POWIP" }));
    expect(writeText).toHaveBeenCalledWith("2000000000015");
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("EAN de POWIP copiado"));
  });

  it("sin códigos lo dice y no ofrece copiar", () => {
    render(<VariantCodes barcode={null} powipEan={null} />);
    expect(screen.getByText("—")).toBeInTheDocument();
    expect(screen.getByText("Se asigna al guardar")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Copiar EAN de POWIP" })).not.toBeInTheDocument();
  });

  it("si el portapapeles falla, avisa", async () => {
    const user = userEvent.setup();
    jest.spyOn(navigator.clipboard, "writeText").mockRejectedValue(new Error("denegado"));
    render(<VariantCodes powipEan="2000000000015" />);
    await user.click(screen.getByRole("button", { name: "Copiar EAN de POWIP" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
  });
});
