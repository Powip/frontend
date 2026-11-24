import { liveLinks } from "../liveLinks";

// FEAT-33 A12: un solo formato de link para el negocio y para cada asesora o creadora.
const storeId = "1042cd44-14dd-47e3-9503-ce24f6090853";

describe("liveLinks", () => {
  test("without the subdomain DNS: …/live/{tienda} and …/live/{tienda}?a=CÓDIGO", () => {
    const links = liveLinks({ origin: "https://www.powip.tech", slug: "kunca", storeId });
    expect(links.publicUrl).toBe("https://www.powip.tech/live/kunca");
    expect(links.advisorUrl("ana-111111")).toBe("https://www.powip.tech/live/kunca?a=ana-111111");
    expect(links.sellerUrl("ana-111111")).toBe("https://www.powip.tech/live/kunca?v=ana-111111");
    expect(links.displayUrl).toBe("www.powip.tech/live/kunca");
  });

  test("with the subdomain configured: {tienda}.powip.lat/live and ?a=CÓDIGO", () => {
    const links = liveLinks({ origin: "https://www.powip.tech", slug: "kunca", storeId, subdomainBase: "powip.lat" });
    expect(links.publicUrl).toBe("https://kunca.powip.lat/live");
    expect(links.advisorUrl("ana-111111")).toBe("https://kunca.powip.lat/live?a=ana-111111");
    expect(links.displayUrl).toBe("kunca.powip.lat/live");
  });

  test("an app served from powip.lat already uses the subdomain", () => {
    expect(liveLinks({ origin: "https://app.powip.lat", slug: "kunca", storeId }).publicUrl).toBe(
      "https://kunca.powip.lat/live",
    );
  });

  test("a store without a catalog name falls back to its id on the app domain", () => {
    const links = liveLinks({ origin: "https://www.powip.tech", slug: "", storeId, subdomainBase: "powip.lat" });
    expect(links.publicUrl).toBe(`https://www.powip.tech/live/${storeId}`);
  });

  test("codes are escaped and nothing is built without an origin", () => {
    const links = liveLinks({ origin: "https://www.powip.tech", slug: "kunca", storeId });
    expect(links.advisorUrl("a b&c")).toBe("https://www.powip.tech/live/kunca?a=a%20b%26c");
    expect(liveLinks({ origin: "", slug: "kunca", storeId }).publicUrl).toBe("");
  });
});
