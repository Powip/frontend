import type { AsesorOpcion } from "../models/asesor-opcion.model";
import { asesoresParaDesplegable } from "../utils/asesores-desplegable";

const asesor = (id: string, inactiva?: boolean): AsesorOpcion => ({
  id,
  nombre: `Asesora ${id}`,
  email: null,
  inactiva,
});

describe("asesoresParaDesplegable", () => {
  const todas = [asesor("a", false), asesor("b", true), asesor("c"), asesor("d", true)];

  it("oculta a quien lleva más de 90 días sin actividad", () => {
    expect(asesoresParaDesplegable(todas, {}).map((a) => a.id)).toEqual(["a", "c"]);
  });

  it("una inactiva que ya está seleccionada se queda visible (no se pierde el filtro activo)", () => {
    expect(asesoresParaDesplegable(todas, { seleccionadaId: "b" }).map((a) => a.id)).toEqual([
      "a",
      "b",
      "c",
    ]);
  });

  it("quien no trae la marca (nunca tuvo pedidos, o la fuente no la envía) se muestra", () => {
    expect(asesoresParaDesplegable([asesor("c")], {}).map((a) => a.id)).toEqual(["c"]);
  });

  it("saca a la asesora fija del rol, que el selector ya muestra aparte", () => {
    expect(asesoresParaDesplegable(todas, { fijaId: "a" }).map((a) => a.id)).toEqual(["c"]);
  });

  it("no modifica la lista original", () => {
    const copia = [...todas];
    asesoresParaDesplegable(todas, {});
    expect(todas).toEqual(copia);
  });
});
