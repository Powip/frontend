import { WHATSAPP_TEMPLATE_CATEGORIES } from "../../enums/whatsapp.enums";
import {
  findPromotionalTerms,
  shouldWarnAboutPromotionalLanguage,
} from "../promotional-language.util";

describe("findPromotionalTerms", () => {
  it("detecta los términos del documento con y sin tildes", () => {
    expect(
      findPromotionalTerms("Usa el CÓDIGO VUELVE10 y llevate 10% de DESCUENTO, compra ya"),
    ).toEqual(["descuento", "%", "código", "compra ya", "llévate"]);
    expect(findPromotionalTerms("Ofertas y promociones")).toEqual(["oferta", "promo"]);
  });

  it("no marca textos de aviso de envío", () => {
    expect(
      findPromotionalTerms(
        "Hola {{cliente}}, tu pedido *{{orden}}* ya está en camino con {{courier}}.",
      ),
    ).toEqual([]);
  });
});

describe("shouldWarnAboutPromotionalLanguage", () => {
  it("advierte solo en la categoría Utilidad", () => {
    const texts = ["Aprovecha la oferta"];
    expect(shouldWarnAboutPromotionalLanguage(WHATSAPP_TEMPLATE_CATEGORIES.UTILITY, texts)).toBe(
      true,
    );
    expect(shouldWarnAboutPromotionalLanguage(WHATSAPP_TEMPLATE_CATEGORIES.MARKETING, texts)).toBe(
      false,
    );
  });

  it("revisa también la versión B y tolera textos vacíos", () => {
    expect(
      shouldWarnAboutPromotionalLanguage(WHATSAPP_TEMPLATE_CATEGORIES.UTILITY, [
        "Tu pedido va en camino",
        null,
        "Llévate otro con 10%",
      ]),
    ).toBe(true);
  });
});
