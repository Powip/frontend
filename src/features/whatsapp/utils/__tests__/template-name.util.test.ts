import { TEMPLATE_TECHNICAL_NAME_MAX_LENGTH, toTemplateTechnicalName } from "../template-name.util";

describe("toTemplateTechnicalName", () => {
  it.each([
    ["Pedido en camino", "pedido_en_camino"],
    ["Guía creada", "guia_creada"],
    ["  ¡Llévate tu Pedido!  ", "llevate_tu_pedido"],
    ["Disponible en agencia (Shalom)", "disponible_en_agencia_shalom"],
    ["Ñandú 2026", "nandu_2026"],
    ["pedido__entregado", "pedido_entregado"],
  ])("convierte %p en %p", (input, expected) => {
    expect(toTemplateTechnicalName(input)).toBe(expected);
  });

  it("devuelve vacío si no hay caracteres válidos", () => {
    expect(toTemplateTechnicalName("¿¡ !?")).toBe("");
  });

  it("respeta el largo máximo sin terminar en guion bajo", () => {
    const result = toTemplateTechnicalName(
      `${"a".repeat(TEMPLATE_TECHNICAL_NAME_MAX_LENGTH - 1)} b`,
    );
    expect(result.length).toBeLessThanOrEqual(TEMPLATE_TECHNICAL_NAME_MAX_LENGTH);
    expect(result.endsWith("_")).toBe(false);
  });
});
