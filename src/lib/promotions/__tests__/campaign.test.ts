import {
  activeCampaign,
  applyDiscount,
  campaignInStores,
  campaignPrice,
  campaignTag,
  discountLabel,
  discountProblem,
  isoFromLimaLocal,
  limaDateTimeText,
  limaLocalFromIso,
  limaShortDate,
  nextCampaign,
  parseMoneyInput,
  productCampaigns,
  promoPriceFor,
  promoStatus,
  type CampaignLike,
} from "@/lib/promotions/campaign";

const NOW = new Date("2026-11-24T15:00:00Z"); // 24/11 10:00 en Lima

const campaign = (over: Partial<CampaignLike> = {}): CampaignLike => ({
  id: "c-1",
  name: "Cyber Wow",
  type: "CAMPAIGN",
  isActive: true,
  startsAt: "2026-11-24T05:00:00.000Z",
  endsAt: "2026-11-28T05:00:00.000Z",
  storeIds: [],
  channels: ["CATALOGO_WEB", "WEB"],
  allProducts: false,
  discountType: "PERCENT",
  discountValue: 20,
  products: [{ productId: "jim", discountType: null, discountValue: null }],
  manualPrices: [],
  ...over,
});

describe("precio de campaña (spec §6.9 y los ejemplos de §6.12)", () => {
  it("% sobre el precio del canal: S/ 149 −20% = S/ 119.20 y S/ 159 −20% = S/ 127.20", () => {
    const general = { type: "PERCENT" as const, value: 20 };
    expect(campaignPrice({ base: 149, general })).toBe(119.2);
    expect(campaignPrice({ base: 159, general })).toBe(127.2);
  });

  it("prioridad: precio a mano > descuento propio > general", () => {
    const general = { type: "PERCENT" as const, value: 20 };
    expect(campaignPrice({ base: 89, general, own: { type: "PERCENT", value: 10 } })).toBe(80.1);
    expect(campaignPrice({ base: 89, general, own: { type: "PERCENT", value: 10 }, manual: 159 })).toBe(159);
  });

  it("monto y precio final", () => {
    expect(applyDiscount(149, { type: "AMOUNT", value: 30 })).toBe(119);
    expect(applyDiscount(149, { type: "FINAL", value: 129 })).toBe(129);
  });

  it("errores de la spec: tipo, valor > 0 y porcentaje < 100", () => {
    expect(discountProblem({ type: null, value: 10 })).toBe("Elige el tipo de descuento.");
    expect(discountProblem({ type: "AMOUNT", value: 0 })).toBe("Escribe un descuento mayor a 0.");
    expect(discountProblem({ type: "PERCENT", value: 100 })).toBe("El porcentaje debe ser menor a 100.");
    expect(discountProblem({ type: "PERCENT", value: 99.5 })).toBeNull();
  });

  it("promoPriceFor: el precio a mano del canal manda y un precio ≤ 0 da null (la venta no lo aplica)", () => {
    const promo = campaign({ manualPrices: [{ productId: "jim", channel: "WEB", price: 159 }] });
    expect(promoPriceFor(promo, "jim", "CATALOGO_WEB", 149)).toBe(119.2);
    expect(promoPriceFor(promo, "jim", "WEB", 149)).toBe(159);
    expect(promoPriceFor(campaign({ discountType: "AMOUNT", discountValue: 200 }), "jim", "WEB", 149)).toBeNull();
  });

  it("etiquetas del descuento", () => {
    expect(discountLabel({ type: "PERCENT", value: 20 })).toBe("−20%");
    expect(discountLabel({ type: "AMOUNT", value: 10 })).toBe("−S/ 10.00");
    expect(discountLabel({ type: "FINAL", value: 129 })).toBe("Precio final S/ 129.00");
    expect(discountLabel({ type: null, value: null })).toBe("—");
  });
});

describe("estado calculado", () => {
  it("Terminada gana a Pausada; después Pausada, Programada y Activa", () => {
    expect(promoStatus({ isActive: false, startsAt: null, endsAt: "2026-11-20T05:00:00Z" }, NOW)).toBe("ENDED");
    expect(promoStatus({ isActive: false, startsAt: null, endsAt: null }, NOW)).toBe("PAUSED");
    expect(promoStatus({ isActive: true, startsAt: "2026-11-25T05:00:00Z", endsAt: null }, NOW)).toBe("SCHEDULED");
    expect(promoStatus({ isActive: true, startsAt: "2026-11-24T05:00:00Z", endsAt: "2026-11-28T05:00:00Z" }, NOW)).toBe("ACTIVE");
  });
});

describe("hora de Lima", () => {
  it("datetime-local ↔ ISO con −05:00", () => {
    expect(isoFromLimaLocal("2026-11-24T18:30")).toBe("2026-11-24T18:30:00-05:00");
    expect(isoFromLimaLocal("2026-11-24")).toBeNull();
    expect(limaLocalFromIso("2026-11-24T23:30:00.000Z")).toBe("2026-11-24T18:30");
    expect(limaDateTimeText("2026-11-28T04:59:00.000Z")).toBe("27/11/2026 23:59");
  });

  it("fecha corta sin la hora a medianoche", () => {
    expect(limaShortDate("2026-11-24T05:00:00.000Z")).toBe("24/11");
    expect(limaShortDate("2026-11-24T23:00:00.000Z")).toBe("24/11 18:00");
    expect(limaShortDate(null)).toBe("");
  });

  it("importes con coma decimal", () => {
    expect(parseMoneyInput("12,5")).toBe(12.5);
    expect(parseMoneyInput("  ")).toBeNull();
    expect(parseMoneyInput("abc")).toBeNaN();
  });
});

describe("campañas de un producto (ficha, lista y Listas de precios)", () => {
  const promos = [
    campaign(),
    campaign({ id: "c-2", name: "Navidad", startsAt: "2026-12-20T05:00:00.000Z", endsAt: "2026-12-26T05:00:00.000Z" }),
    campaign({ id: "c-3", name: "Liquidación", allProducts: true, products: [], channels: ["POWIP_CRM"], storeIds: ["s2"] }),
    campaign({ id: "c-4", name: "Vieja", startsAt: "2026-10-01T05:00:00.000Z", endsAt: "2026-10-05T05:00:00.000Z" }),
    { ...campaign({ id: "v-1", name: "Lleva 3" }), type: "VOLUME" },
  ];

  it("tiendas: sin tiendas en la campaña o en el alcance = aplica", () => {
    expect(campaignInStores({ storeIds: [] }, ["s1"])).toBe(true);
    expect(campaignInStores({ storeIds: ["s2"] }, [])).toBe(true);
    expect(campaignInStores({ storeIds: ["s2"] }, ["s1"])).toBe(false);
  });

  it("solo campañas que incluyen el producto en la tienda, en orden activa → programada → terminada", () => {
    expect(productCampaigns(promos, "jim", ["s1"], NOW).map((promo) => promo.id)).toEqual(["c-1", "c-2", "c-4"]);
    expect(productCampaigns(promos, "otro", ["s2"], NOW).map((promo) => promo.id)).toEqual(["c-3"]);
  });

  it("activa y próxima por canal", () => {
    expect(activeCampaign(promos, "jim", ["s1"], "CATALOGO_WEB", NOW)?.id).toBe("c-1");
    expect(activeCampaign(promos, "jim", ["s1"], "POWIP_CRM", NOW)).toBeNull();
    expect(nextCampaign(promos, "jim", ["s1"], "WEB", NOW)?.id).toBe("c-2");
  });

  it("etiqueta con el descuento del producto y «precio ajustado» si tiene un precio a mano", () => {
    const own = campaign({ products: [{ productId: "sofia", discountType: "PERCENT", discountValue: 10 }], manualPrices: [{ productId: "sofia", channel: "WEB", price: 70 }] });
    expect(campaignTag(own, "sofia")).toBe("Cyber Wow −10% · precio ajustado");
    expect(campaignTag(campaign({ name: "Precio especial del chat", discountType: "FINAL", discountValue: 129 }), "jim")).toBe("Precio especial del chat Precio final S/ 129.00");
  });
});
