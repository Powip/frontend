import { grupos } from "../../resumen/resumen-grupos";
import { textoAlcance } from "../utils/alcance-grupo";

const PERIODO = "1 – 28 oct";

describe("textoAlcance de los grupos de Operaciones", () => {
  it("la cola, las etapas y los envíos conservan su texto de siempre", () => {
    expect(textoAlcance(grupos.actual("cola_operativa", "Cola"), PERIODO)).toEqual({
      periodo: "Estado actual (no depende del periodo)",
      descripcion: "Estado actual: no depende del periodo; respeta tienda, canal y demás filtros.",
    });
    expect(
      textoAlcance(grupos.de("etapa_lenta", "Lentos", { etapa: "ciclo_total" }), PERIODO),
    ).toEqual({
      periodo: PERIODO,
      descripcion: `Periodo ${PERIODO}.`,
    });
    expect(textoAlcance(grupos.despachadosDia("2026-10-12"), PERIODO).periodo).toMatch(
      /Despachados el/,
    );
  });

  it("reservados avisa que solo respeta la tienda del stock y que lista las tiendas del producto", () => {
    const texto = textoAlcance(
      grupos.actual("reservados", "Polo · reservado", { producto: "var-1" }),
      PERIODO,
    );
    expect(texto.periodo).toBe("Estado actual (no depende del periodo)");
    expect(texto.descripcion).toMatch(/solo respeta la tienda/i);
    expect(texto.descripcion).toMatch(/tienda donde está el stock/i);
    expect(texto.descripcion).toMatch(/todas las tiendas/i);
    expect(texto.descripcion).not.toMatch(/canal y demás filtros/);
  });

  it("por_liquidar_actual dice que mira los últimos 365 días y no los 60 de la cobranza", () => {
    const texto = textoAlcance(
      grupos.actual("por_liquidar_actual", "Entregado sin liquidar", {}, "pedir_liquidacion"),
      PERIODO,
    );
    expect(texto.descripcion).toMatch(/365 días/);
    expect(texto.descripcion).toMatch(/courier/);
    expect(texto.descripcion).not.toMatch(/\b60\b/);
  });

  it("sin grupo usa el periodo", () => {
    expect(textoAlcance(null, PERIODO)).toEqual({
      periodo: PERIODO,
      descripcion: `Periodo ${PERIODO}.`,
    });
  });
});

describe("textoAlcance de los grupos de Finanzas", () => {
  it("movimientos_caja dice que cuenta por fecha del dinero y que la cantidad cuadra, no el importe", () => {
    const texto = textoAlcance(
      grupos.caja("Cobro por contraentrega", { concepto: "liquidacion_courier" }),
      PERIODO,
    );
    expect(texto.periodo).toBe(`${PERIODO} por fecha del dinero`);
    expect(texto.descripcion).toMatch(/fecha del dinero/);
    expect(texto.descripcion).toMatch(/cantidad de pedidos/i);
    expect(texto.descripcion).toMatch(/puede diferir/i);
    expect(texto.descripcion).not.toMatch(/fecha de liquidaci[óo]n/i);
  });

  it("por_cobrar_actual conserva el texto de estado actual", () => {
    expect(
      textoAlcance(grupos.actual("por_cobrar_actual", "En curso por cobrar"), PERIODO).periodo,
    ).toBe("Estado actual (no depende del periodo)");
  });
});
