import { render, screen } from "@testing-library/react";
import SuggestionFacts from "../SuggestionFacts";

const script = jest.fn();
jest.mock("@/hooks/useChatCart", () => ({
  useChatCart: () => ({
    line: { name: "Chompa Ovejera", productId: "p1", variant: "M / Beige", quantity: 1, unitPrice: 115, stockAvailable: 8 },
    storeId: "st-1",
  }),
}));
jest.mock("@/hooks/useCrmContent", () => ({
  useScript: () => script(),
  useSheets: () => ({ data: [{ id: "f1", name: "Chompa Ovejera Unisex", coreProductId: "p1", highlights: "Lana ovejera abrigadora" }] }),
}));
jest.mock("@/hooks/useCrmOrderPanel", () => ({ useStorePolicy: () => ({ data: { shipCharge: 0 } }) }));

describe("Ficha de la sugerencia (B13)", () => {
  it("muestra ficha, precio, stock, envío, promo vigente y Ver ficha", () => {
    script.mockReturnValue({ data: { closingRules: { promo: "2 por S/ 199", lastUnits: 3 }, activePromo: "2 por S/ 199" } });
    render(<SuggestionFacts conversationId="c1" />);
    const facts = screen.getByTestId("suggestion-facts");
    expect(facts).toHaveTextContent("Ficha Chompa Ovejera Unisex");
    expect(facts).toHaveTextContent("Stock M / Beige: 8 en stock");
    expect(facts).toHaveTextContent("Envío gratis");
    expect(facts).toHaveTextContent("Promo 2 por S/ 199");
    expect(facts).toHaveTextContent("Destaca: Lana ovejera abrigadora");
    expect(screen.getByRole("link", { name: "Ver ficha" })).toHaveAttribute("href", "/comercial/ventas-chat/ficha");
  });

  it("no ofrece una promo guardada otro día", () => {
    script.mockReturnValue({ data: { closingRules: { promo: "2 por S/ 199" }, activePromo: null } });
    render(<SuggestionFacts conversationId="c1" />);
    expect(screen.getByTestId("suggestion-facts")).not.toHaveTextContent("Promo");
  });
});
