import { canalesEnDatos, claveCanal, grupoCanal, nombreCanal } from "../canales";

describe("canales", () => {
  it("agrupa las grafías de TikTok Live y Mercado Libre", () => {
    for (const raw of ["LIVE TIKTOK", "TIKTOK LIVE", "TIKTOK_LIVE", "Tiktok Live"]) {
      expect(claveCanal(raw)).toBe("TIKTOK_LIVE");
    }
    expect(claveCanal("Mercado Libre")).toBe("MERCADOLIBRE");
    expect(claveCanal("MERCADOLIBRE")).toBe("MERCADOLIBRE");
    expect(claveCanal("SHOPIFY")).toBe("WEB");
    expect(claveCanal("  ")).toBe("SIN_CANAL");
    expect(claveCanal(null)).toBe("SIN_CANAL");
  });

  it("nombra los canales conocidos y los nuevos", () => {
    expect(nombreCanal("TIKTOK_LIVE")).toBe("TikTok Live");
    expect(nombreCanal("WEB")).toBe("Web / Shopify");
    expect(nombreCanal("LIVE_DE_VERANO")).toBe("Live De Verano");
    expect(grupoCanal("FALABELLA")).toBe("marketplace");
    expect(grupoCanal("WHATSAPP")).toBe("directo");
  });

  it("lista los canales de los datos con la grafía más usada primero", () => {
    const canales = canalesEnDatos([
      { salesChannel: "LIVE TIKTOK" },
      { salesChannel: "LIVE TIKTOK" },
      { salesChannel: "TIKTOK_LIVE" },
      { salesChannel: "WHATSAPP" },
      { salesChannel: null },
    ]);
    expect(canales[0]).toEqual({
      clave: "TIKTOK_LIVE",
      nombre: "TikTok Live",
      grupo: "directo",
      grafias: ["LIVE TIKTOK", "TIKTOK_LIVE"],
      pedidos: 3,
    });
    expect(canales.map((c) => c.clave)).toEqual(["TIKTOK_LIVE", "SIN_CANAL", "WHATSAPP"]);
  });
});
