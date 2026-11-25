/** FEAT-32 M6a — «Sugerencias para cerrar» del motor de promociones (spec §7.17). */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SaleSuggestions from "@/components/registrar-venta/SaleSuggestions";
import type { SaleSuggestion } from "@/services/promotionsService";

const SUGGESTIONS: SaleSuggestion[] = [
  {
    kind: "PACK", packVariantId: "pk1", name: "Pantalón Jimena + Blusa Sofía", packPrice: 199, looseTotal: 238, sku: "PK1",
    components: [{ variantId: "jim-m", quantity: 1 }], text: "Pantalón Jimena + Blusa Sofía a S/ 199.00 (suelto S/ 238.00).",
  },
  {
    kind: "PACK", packVariantId: "pk2", name: "Pack sin SKU", packPrice: 99, looseTotal: 120, sku: null,
    components: [], text: "Pack sin SKU a S/ 99.00 (suelto S/ 120.00).",
  },
  {
    kind: "VOLUME", promoId: "vol", name: "Lleva 3 blusas Sofía a S/ 210", missing: 1, addVariantId: "sof-l", unitPrice: 70,
    text: "Agrega 1 más y aplica Lleva 3 blusas Sofía a S/ 210 (S/ 70.00 c/u).",
  },
  { kind: "GIFT", promoId: "g1", name: "Regalo Short Luisa", missingAmount: 41, giftName: "Short Luisa", text: "Faltan S/ 41.00 para el regalo: Short Luisa." },
];

describe("SaleSuggestions", () => {
  it("muestra las sugerencias del motor en su orden y con su texto; el pack sin SKU no se ofrece", () => {
    render(<SaleSuggestions suggestions={SUGGESTIONS} hasProducts onAddPack={jest.fn()} />);
    const items = screen.getAllByRole("listitem").map((item) => item.textContent);
    expect(items).toEqual([
      "Pantalón Jimena + Blusa Sofía a S/ 199.00 (suelto S/ 238.00). Agregar pack",
      "Agrega 1 más y aplica Lleva 3 blusas Sofía a S/ 210 (S/ 70.00 c/u).",
      "Faltan S/ 41.00 para el regalo: Short Luisa.",
    ]);
    expect(screen.queryByText(/Pack sin SKU/)).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Agregar pack" })).toHaveLength(1);
  });

  it("«Agregar pack» manda la sugerencia del pack", async () => {
    const onAddPack = jest.fn().mockResolvedValue(undefined);
    render(<SaleSuggestions suggestions={SUGGESTIONS} hasProducts onAddPack={onAddPack} />);
    await userEvent.click(screen.getByRole("button", { name: "Agregar pack" }));
    expect(onAddPack).toHaveBeenCalledWith(SUGGESTIONS[0]);
  });

  it("sin productos (o sin sugerencias) invita a agregar productos", () => {
    const { rerender } = render(<SaleSuggestions suggestions={SUGGESTIONS} hasProducts={false} onAddPack={jest.fn()} />);
    expect(screen.getByText("Agrega productos y POWIP te sugerirá packs, volumen y regalos para cerrar la venta.")).toBeInTheDocument();
    expect(screen.queryByRole("listitem")).not.toBeInTheDocument();
    rerender(<SaleSuggestions suggestions={[]} hasProducts onAddPack={jest.fn()} />);
    expect(screen.getByText(/POWIP te sugerirá packs, volumen y regalos/)).toBeInTheDocument();
  });

  it("si el motor falla lo avisa sin bloquear", () => {
    render(<SaleSuggestions suggestions={[]} hasProducts failed onAddPack={jest.fn()} />);
    expect(screen.getByRole("status")).toHaveTextContent("No se pudieron calcular las promociones.");
  });

  it("debajo siguen las de bundles anteriores; sin motor solo se ve el panel de siempre", () => {
    const { rerender } = render(
      <SaleSuggestions suggestions={[]} hasProducts onAddPack={jest.fn()}>
        <p>Bundle anterior</p>
      </SaleSuggestions>,
    );
    expect(screen.getByRole("region", { name: "Sugerencias para cerrar" })).toHaveTextContent("Bundle anterior");
    rerender(
      <SaleSuggestions enabled={false} suggestions={SUGGESTIONS} hasProducts onAddPack={jest.fn()}>
        <p>Panel de siempre</p>
      </SaleSuggestions>,
    );
    expect(screen.getByText("Panel de siempre")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Sugerencias para cerrar" })).not.toBeInTheDocument();
  });
});
