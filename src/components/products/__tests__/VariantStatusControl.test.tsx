import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import VariantStatusControl from "../VariantStatusControl";
import { setVariantActive } from "@/services/variantStatusService";
import { getStockByVariants } from "@/services/inventoryItems.service";

jest.mock("@/services/variantStatusService", () => ({ setVariantActive: jest.fn() }));
jest.mock("@/services/inventoryItems.service", () => ({ getStockByVariants: jest.fn() }));
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

describe("VariantStatusControl (FEAT-24 H0)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(setVariantActive).mockResolvedValue(undefined);
    jest.mocked(getStockByVariants).mockResolvedValue([{ variant_id: "v-1", quantity: 4, reserved_quantity: 1, available: 3, inventories: [] }]);
  });

  it("desactiva con aviso de stock y de Shopify", async () => {
    const onChanged = jest.fn();
    render(<VariantStatusControl variant={{ id: "v-1", isActive: true, linkedSources: ["shopify"] }} onChanged={onChanged} />);
    fireEvent.click(screen.getByRole("button", { name: "Desactivar" }));
    expect(await screen.findByText("Tiene 4 unidades en stock y 1 reservada.")).toBeInTheDocument();
    expect(screen.getByText("Las ventas nuevas de esta variante en Shopify quedarán por vincular.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Desactivar variante" }));
    await waitFor(() => expect(setVariantActive).toHaveBeenCalledWith("v-1", false));
    expect(onChanged).toHaveBeenCalledWith(false);
  });

  it("sin stock ni vínculos no muestra avisos", async () => {
    jest.mocked(getStockByVariants).mockResolvedValue([]);
    render(<VariantStatusControl variant={{ id: "v-1", isActive: true, linkedSources: [] }} onChanged={jest.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Desactivar" }));
    await screen.findByRole("button", { name: "Desactivar variante" });
    expect(screen.queryByText(/unidades en stock/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Shopify/)).not.toBeInTheDocument();
  });

  it("una inactiva se puede activar", async () => {
    const onChanged = jest.fn();
    render(<VariantStatusControl variant={{ id: "v-1", isActive: false, mergedInto: null }} onChanged={onChanged} />);
    expect(screen.getByText("Inactiva")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Activar" }));
    await waitFor(() => expect(setVariantActive).toHaveBeenCalledWith("v-1", true));
    expect(onChanged).toHaveBeenCalledWith(true);
  });

  it("una unificada no tiene botones", () => {
    render(<VariantStatusControl variant={{ id: "v-1", isActive: false, mergedInto: "m", mergedIntoSku: "ROPREM-AB12" }} onChanged={jest.fn()} />);
    expect(screen.getByText("Unificada con ROPREM-AB12")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
