import { PAGINAS_FUERA_DE_MENU, SECCIONES_ADMIN, ubicarPagina } from "../secciones";

describe("menú de Administración", () => {
  it("Caja tiene Flujo de caja, Cuentas por cobrar y pagar y Capital y ROI (Fase 3: con datos en el servidor)", () => {
    const caja = SECCIONES_ADMIN.find((s) => s.id === "caja");
    expect(caja?.paginas.map((p) => p.href)).toEqual([
      "/administracion/flujo",
      "/administracion/cuentas",
      "/administracion/capital",
    ]);
    for (const href of ["/administracion/cuentas", "/administracion/capital"]) {
      const ubicacion = ubicarPagina(href);
      expect(ubicacion?.seccion.id).toBe("caja");
      expect(ubicacion?.enMenu).toBe(true);
    }
  });

  it("no queda ninguna página fuera del menú ni marcada como «solo en este navegador»", () => {
    expect(PAGINAS_FUERA_DE_MENU).toEqual([]);
    const paginas = SECCIONES_ADMIN.flatMap((s) => s.paginas) as Array<Record<string, unknown>>;
    expect(paginas.filter((p) => "soloNavegador" in p)).toEqual([]);
  });

  it("una ruta que no es de Administración no se ubica", () => {
    expect(ubicarPagina("/ventas")).toBeNull();
  });
});
