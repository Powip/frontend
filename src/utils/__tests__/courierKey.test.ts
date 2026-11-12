import { courierOptions, matchCourierOption, normalizeCourierKey } from "../courierKey";

describe("normalizeCourierKey", () => {
  it.each(["Olva Courier", "OLVA", "OLVA_COURIER", "OLVA COURIER", "Olva ", "Olva", " olva  courier ", "olva_ courier"])(
    "trata «%s» como el courier Olva",
    (raw) => expect(normalizeCourierKey(raw)).toBe("olva"),
  );

  it("no mezcla couriers distintos", () => {
    expect(normalizeCourierKey("Indriver 1")).not.toBe(normalizeCourierKey("Indriver 2"));
    expect(normalizeCourierKey("Olva")).not.toBe(normalizeCourierKey("Shalom"));
  });

  it("solo quita «courier» si es el último término y queda algo antes", () => {
    expect(normalizeCourierKey("Courier")).toBe("courier");
    expect(normalizeCourierKey("Courier Express")).toBe("courier express");
  });

  it("devuelve vacío para valores vacíos o nulos", () => {
    expect(normalizeCourierKey(null)).toBe("");
    expect(normalizeCourierKey(undefined)).toBe("");
    expect(normalizeCourierKey("  _ ")).toBe("");
  });
});

describe("courierOptions", () => {
  const olva = ["Olva Courier", "OLVA", "OLVA_COURIER", "OLVA COURIER", "Olva ", "Olva"];

  it("deja una sola opción por courier, sin espacios sobrantes y ordenadas", () => {
    expect(courierOptions([...olva, "SHALOM", "Shalom ", "Indriver 2", "Indriver 1"])).toEqual([
      "Indriver 1", "Indriver 2", "Olva", "Shalom",
    ]);
  });

  it("prefiere el nombre configurado del courier cuando coincide", () => {
    expect(courierOptions(olva, ["Olva Courier"])).toEqual(["Olva Courier"]);
    expect(courierOptions(["OLVA", "Shalom"], ["Olva Courier", "Shalom"])).toEqual(["Olva Courier", "Shalom"]);
  });

  it("sin nombre configurado elige la grafía más legible, sin depender del orden", () => {
    expect(courierOptions(["OLVA_COURIER", "OLVA", "Olva "])).toEqual(["Olva"]);
    expect(courierOptions(["Olva ", "OLVA", "OLVA_COURIER"])).toEqual(["Olva"]);
    expect(courierOptions(["Olva Courier", "Olva"])).toEqual(["Olva"]);
  });

  it("ignora vacíos y conserva el nombre configurado aunque aún no tenga pedidos", () => {
    expect(courierOptions(["", "  ", "_"], ["Shalom"])).toEqual(["Shalom"]);
  });
});

describe("matchCourierOption", () => {
  it("devuelve la opción equivalente al valor elegido aunque cambie la grafía", () => {
    expect(matchCourierOption(["Olva Courier", "Shalom"], "OLVA")).toBe("Olva Courier");
  });

  it("devuelve vacío si no hay valor y el mismo valor si ninguna opción coincide", () => {
    expect(matchCourierOption(["Shalom"], "")).toBe("");
    expect(matchCourierOption(["Shalom"], "Olva")).toBe("Olva");
  });
});
