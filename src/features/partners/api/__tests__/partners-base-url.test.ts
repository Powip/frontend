const ORIGINAL_PARTNERS_URL = process.env.NEXT_PUBLIC_API_PARTNERS;

function loadPartnersBaseUrl(value: string | undefined): string {
  if (value === undefined) {
    delete process.env.NEXT_PUBLIC_API_PARTNERS;
  } else {
    process.env.NEXT_PUBLIC_API_PARTNERS = value;
  }

  let partners = "";
  jest.isolateModules(() => {
    partners = require("@/lib/api").API.partners;
  });
  return partners;
}

afterAll(() => {
  if (ORIGINAL_PARTNERS_URL === undefined) {
    delete process.env.NEXT_PUBLIC_API_PARTNERS;
  } else {
    process.env.NEXT_PUBLIC_API_PARTNERS = ORIGINAL_PARTNERS_URL;
  }
});

describe("API.partners", () => {
  it("usa NEXT_PUBLIC_API_PARTNERS sin cambios cuando no tiene barra final", () => {
    expect(
      loadPartnersBaseUrl("https://api-gateway-java-production.up.railway.app/v1/partners"),
    ).toBe("https://api-gateway-java-production.up.railway.app/v1/partners");
  });

  it("elimina las barras finales para no generar rutas con doble barra", () => {
    expect(
      loadPartnersBaseUrl("https://api-gateway-java-production.up.railway.app/v1/partners//"),
    ).toBe("https://api-gateway-java-production.up.railway.app/v1/partners");
  });

  it("queda vacía si la variable no está configurada", () => {
    expect(loadPartnersBaseUrl(undefined)).toBe("");
  });
});
