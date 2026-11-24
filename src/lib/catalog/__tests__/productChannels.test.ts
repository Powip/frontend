import {
  SAME_RULE,
  applyRule,
  belowCost,
  parseRuleValue,
  priceRange,
  productChannelStates,
  ruleLabel,
  rulePricesProblem,
  ruleProblem,
} from "@/lib/catalog/productChannels";

describe("FEAT-32 M2 — regla de precio por canal (igual que ms-products)", () => {
  it("calcula igual, más caro, más barato y fijo", () => {
    expect(applyRule(149, SAME_RULE)).toBe(149);
    expect(applyRule(149, { mode: "more", unit: "amount", value: 10 })).toBe(159);
    expect(applyRule(149, { mode: "less", unit: "percent", value: 8 })).toBe(137.08);
    expect(applyRule(149, { mode: "fixed", value: 129.9 })).toBe(129.9);
  });

  it("valida con los mensajes de la spec, también el precio ≤ 0 en alguna variante", () => {
    expect(ruleProblem({ mode: "more", unit: "amount", value: 0 })).toBe("Escribe un valor mayor a 0.");
    expect(ruleProblem({ mode: "less", unit: "percent", value: 100 })).toBe("El descuento debe ser menor a 100%.");
    expect(rulePricesProblem({ mode: "less", unit: "amount", value: 30 }, [149, 25])).toBe("El precio quedaría en cero o negativo.");
    expect(rulePricesProblem({ mode: "less", unit: "amount", value: 30 }, [149])).toBeNull();
    expect(rulePricesProblem(SAME_RULE, [0])).toBeNull();
  });

  it("textos, rango de precios, costo sin IGV y valores con coma", () => {
    expect(ruleLabel({ mode: "less", unit: "percent", value: 8 })).toBe("Tienda − 8%");
    expect(ruleLabel({ mode: "more", unit: "amount", value: 10 })).toBe("Tienda + S/ 10.00");
    expect(priceRange([149, 149])).toBe("S/ 149.00");
    expect(priceRange([129, 159])).toBe("S/ 129.00 – S/ 159.00");
    expect(priceRange([])).toBe("—");
    expect(belowCost(117, 100)).toBe(true);
    expect(belowCost(118, 100)).toBe(false);
    expect(belowCost(50, null)).toBe(false);
    expect(parseRuleValue("12,5")).toBe(12.5);
    expect(parseRuleValue("  ")).toBeNull();
  });

  it("estado por canal en el alcance: sin fila = al día; no activado solo si todas las tiendas lo apagaron", () => {
    const summary = {
      channels: [
        { productId: "p1", storeId: "s1", channel: "POWIP_CRM", active: false, ruleMode: "same" },
        { productId: "p1", storeId: "s2", channel: "CATALOGO_WEB", active: true, ruleMode: "fixed" },
        { productId: "p2", storeId: "s1", channel: "CATALOGO_WEB", active: false, ruleMode: "more" },
      ],
      ownPrices: [{ productId: "p3", storeId: "s2" }],
    };
    expect(productChannelStates(summary, "p1", ["s1"])).toEqual({ states: { POWIP_CRM: "no_activado", CATALOGO_WEB: "al_dia" }, variesByChannel: false });
    expect(productChannelStates(summary, "p1", ["s1", "s2"]).states.POWIP_CRM).toBe("al_dia");
    expect(productChannelStates(summary, "p1", ["s2"]).variesByChannel).toBe(true);
    expect(productChannelStates(summary, "p2", ["s1"]).variesByChannel).toBe(false);
    expect(productChannelStates(summary, "p3", ["s1"]).variesByChannel).toBe(false);
    expect(productChannelStates(summary, "p3", []).variesByChannel).toBe(true);
    expect(productChannelStates(undefined, "p1", ["s1"]).states).toEqual({ POWIP_CRM: "al_dia", CATALOGO_WEB: "al_dia" });
  });
});
