/** @jest-environment node */
// Un script cuya ruta contiene «publicidad» lo cortan los bloqueadores de anuncios
// (la página de Meta Ads quedaba en «Cargando...» en producción).
const nextConfig = require("../../next.config");

const build = (chunkName: string, options = { isServer: false, dev: false }) => {
  const config = nextConfig.webpack(
    { output: { filename: "static/chunks/[name]-[contenthash].js" } },
    options,
  );
  const { filename } = config.output;
  return typeof filename === "function" ? filename({ chunk: { name: chunkName } }) : filename;
};

describe("nombres de los archivos del navegador", () => {
  it.each([
    "app/configuracion/integraciones/publicidad/page",
    "app/configuracion/integraciones/publicidad/callback/page",
    "app/publicidad/layout",
    "app/publicidad/anuncios/page",
  ])("%s no sale con «publicidad»", (name) => {
    expect(build(name)).toBe(
      `static/chunks/${name.replace("publicidad", "pbl")}-[contenthash].js`,
    );
  });

  it("no cambia las demás páginas", () => {
    expect(build("app/ventas/page")).toBe("static/chunks/app/ventas/page-[contenthash].js");
  });

  it.each([
    { isServer: true, dev: false },
    { isServer: false, dev: true },
  ])("no toca el servidor ni el modo desarrollo (%o)", (options) => {
    expect(build("app/publicidad/page", options)).toBe("static/chunks/[name]-[contenthash].js");
  });
});
