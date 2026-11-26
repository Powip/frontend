import { hayMetas, metaVentasMensual, normalizarMetas } from "../metasStorage";

describe("metas sin valores por defecto", () => {
  it("lo no cargado es null", () => {
    expect(normalizarMetas(undefined)).toEqual({ ventasAnual: null, profitAnual: null, margenObjetivoPct: null });
    expect(normalizarMetas({ ventasAnual: 0, profitAnual: -5, margenObjetivoPct: null })).toEqual({
      ventasAnual: null,
      profitAnual: null,
      margenObjetivoPct: null,
    });
  });

  it("los 500.000 / 85.000 / 20 % que guardaba el hook viejo cuentan como sin meta", () => {
    expect(hayMetas(normalizarMetas({ ventasAnual: 500000, profitAnual: 85000, margenObjetivoPct: 20 }))).toBe(false);
    expect(normalizarMetas({ ventasAnual: 500000, profitAnual: 90000, margenObjetivoPct: 20 }).ventasAnual).toBe(500000);
  });

  it("meta mensual = anual ÷ 12", () => {
    expect(metaVentasMensual(normalizarMetas({ ventasAnual: 120000 }))).toBe(10000);
    expect(metaVentasMensual(normalizarMetas({}))).toBeNull();
  });
});
