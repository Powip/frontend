import { COLOR_SIN_CANAL, colorCanal } from "../../shared/utils/canal-color";
import { clasificarStock } from "../utils/clasificar-stock";

describe("clasificarStock (§4 y §6.4)", () => {
  it("clasifica por disponible y cobertura de 30 días", () => {
    expect(clasificarStock(-2, 0, 10).estado).toBe("error_datos");
    expect(clasificarStock(5, 5, 30).estado).toBe("agotado");
    expect(clasificarStock(6, 0, 30)).toMatchObject({
      estado: "critico",
      coberturaDias: 6,
      disponible: 6,
    });
    expect(clasificarStock(10, 0, 30).estado).toBe("bajo");
    expect(clasificarStock(40, 0, 30).estado).toBe("ok");
    expect(clasificarStock(100, 0, 30).estado).toBe("sobrestock");
  });

  it("sin ventas la cobertura es desconocida, no cero", () => {
    expect(clasificarStock(10, 0, 0)).toMatchObject({ coberturaDias: null, estado: "ok" });
  });
});

describe("colorCanal", () => {
  it("es estable por id y usa la ficha si trae color", () => {
    expect(colorCanal("canal-1")).toBe(colorCanal("canal-1"));
    expect(colorCanal("canal-1", "#123456")).toBe("#123456");
    expect(colorCanal(null)).toBe(COLOR_SIN_CANAL);
  });
});
