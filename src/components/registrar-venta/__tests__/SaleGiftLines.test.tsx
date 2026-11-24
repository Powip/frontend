/** FEAT-32 M6a — regalo del motor como línea virtual «Regalo · S/ 0» (spec §6.17). */
import { render, screen } from "@testing-library/react";
import SaleGiftLines from "@/components/registrar-venta/SaleGiftLines";
import type { SaleEngineGift } from "@/services/promotionsService";

const gift = (patch: Partial<SaleEngineGift> = {}): SaleEngineGift => ({
  promoId: "g1", name: "Regalo Short Luisa", variantId: "lui-s", quantity: 1, sku: "LUI-S-GRI", giftName: "Short Luisa",
  minAmount: 450, status: "GIVEN", ...patch,
});

describe("SaleGiftLines", () => {
  it("muestra el regalo con su nombre, SKU y «Regalo · S/ 0», sin controles para editarlo", () => {
    render(<SaleGiftLines gifts={[gift()]} skipped={[]} />);
    const section = screen.getByRole("region", { name: "Regalo de la promoción" });
    expect(section).toHaveTextContent("Short Luisa");
    expect(section).toHaveTextContent("Regalo · S/ 0");
    expect(section).toHaveTextContent("LUI-S-GRI");
    expect(section).toHaveTextContent("S/ 0.00");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("muestra en gris por qué no entran los demás regalos", () => {
    render(
      <SaleGiftLines
        gifts={[]}
        skipped={[
          gift({ promoId: "g2", name: "Regalo Aclari", giftName: "Aclari", status: "NOT_SUMMED" }),
          gift({ promoId: "g3", name: "Regalo Gorra", giftName: "Gorra", status: "NO_STOCK" }),
        ]}
      />,
    );
    expect(screen.getByText("Regalo Aclari (Aclari): no se suma")).toBeInTheDocument();
    expect(screen.getByText("Regalo Gorra (Gorra): sin stock en este almacén")).toBeInTheDocument();
  });

  it("sin regalos no muestra nada", () => {
    const { container } = render(<SaleGiftLines gifts={[]} skipped={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
