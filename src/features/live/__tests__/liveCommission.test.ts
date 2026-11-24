import { agreementError, agreementExample, agreementText } from "../liveCommission";

/** FEAT-33 C1: textos y ejemplo del acuerdo, con el mismo cálculo que ms-ventas. */
const product = { name: "Vestido Lino", regularPrice: 199, livePrice: 178 };

test("10% of a S/ 178 live sale is S/ 17.80", () => {
  expect(agreementExample({ type: "PERCENT", percent: 10 }, product)).toBe(
    "Si vende 1 Vestido Lino a S/ 178.00 gana S/ 17.80.",
  );
});

test("reseller: earns the difference with her price, never negative", () => {
  expect(agreementExample({ type: "RESELLER", percent: 30 }, product)).toBe(
    "Ella tiene Vestido Lino a S/ 139.30: si lo vende a S/ 199.00 gana S/ 59.70; a precio live (S/ 178.00) gana S/ 38.70.",
  );
  expect(agreementExample({ type: "RESELLER", percent: 5 }, { ...product, livePrice: 150 })).toContain(
    "a precio live (S/ 150.00) gana S/ 0.00",
  );
});

test("texts of each kind of agreement", () => {
  expect(agreementText({ type: "PER_UNIT", amount: 5 })).toBe("S/ 5.00 por prenda");
  expect(agreementText({ type: "RESELLER", percent: 30 }, true)).toBe("Revendedora (30% bajo tienda)");
  const volume = {
    type: "VOLUME" as const,
    period: "MONTH" as const,
    tiers: [
      { from: 0, percent: 8 },
      { from: 20, percent: 10 },
    ],
  };
  expect(agreementText(volume)).toBe("Por volumen: 0–19 prendas 8% · 20+ prendas 10% (por mes)");
  expect(agreementText(volume, true)).toBe("Por volumen (8% · 10%)");
  expect(agreementExample(volume, product)).toBe("Al llegar a 20 prendas en el mes su % sube a 10%.");
});

test("same validation messages as the backend", () => {
  expect(agreementError({ type: "PERCENT", percent: Number.NaN })).toBe("El porcentaje va de 0.1 a 100.");
  expect(agreementError({ type: "VOLUME", period: "LIVE", tiers: [{ from: 0, percent: 8 }, { from: 0, percent: 9 }] })).toBe(
    "Cada escala empieza en más prendas que la anterior.",
  );
  expect(agreementError({ type: "PER_UNIT", amount: 2.5 })).toBe("");
});
