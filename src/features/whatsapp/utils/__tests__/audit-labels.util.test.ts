import { auditActionLabel, auditUserLabel } from "../audit-format.util";

describe("registro de cambios: acción y usuario", () => {
  it("muestra la acción en español y nunca el código en inglés", () => {
    expect(auditActionLabel("update")).toBe("editó");
    expect(auditActionLabel("test_send")).toBe("envió una prueba");
    expect(auditActionLabel("assisted_mark-sent")).toBe("marcó como enviado");
    expect(auditActionLabel("algo_nuevo")).toBe("hizo un cambio");
    expect(auditActionLabel("reconectó")).toBe("reconectó");
  });

  it("pone el nombre primero y el correo solo como dato secundario", () => {
    expect(auditUserLabel({ name: "Ana Pérez", email: "ana@tienda.pe" })).toEqual({
      name: "Ana Pérez",
      email: "ana@tienda.pe",
    });
  });

  it("registros antiguos con solo el correo no lo repiten", () => {
    expect(auditUserLabel({ name: "ana@tienda.pe", email: null })).toEqual({
      name: "ana@tienda.pe",
      email: null,
    });
  });

  it("sin usuario dice «Usuario sin informar»", () => {
    expect(auditUserLabel(null)).toEqual({ name: "Usuario sin informar", email: null });
  });
});
