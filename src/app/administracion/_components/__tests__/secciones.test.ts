import { PAGINAS_FUERA_DE_MENU, SECCIONES_ADMIN, ubicarPagina } from "../secciones";

describe("menú de Administración", () => {
  it("Capital y ROI está en el menú, dentro de Caja, marcada como datos solo del navegador", () => {
    const caja = SECCIONES_ADMIN.find((s) => s.id === "caja");
    expect(caja?.paginas.map((p) => p.href)).toEqual(["/administracion/flujo", "/administracion/capital"]);

    const ubicacion = ubicarPagina("/administracion/capital");
    expect(ubicacion?.seccion.id).toBe("caja");
    expect(ubicacion?.enMenu).toBe(true);
    expect(ubicacion?.pagina.soloNavegador).toBe(true);
  });

  it("Cuentas sigue fuera del menú", () => {
    expect(PAGINAS_FUERA_DE_MENU.map((p) => p.href)).toEqual(["/administracion/cuentas"]);
    expect(ubicarPagina("/administracion/cuentas")?.enMenu).toBe(false);
  });

  it("ninguna otra página del menú está marcada como solo del navegador", () => {
    const marcadas = SECCIONES_ADMIN.flatMap((s) => s.paginas)
      .filter((p) => p.soloNavegador)
      .map((p) => p.href);
    expect(marcadas).toEqual(["/administracion/capital"]);
  });
});
