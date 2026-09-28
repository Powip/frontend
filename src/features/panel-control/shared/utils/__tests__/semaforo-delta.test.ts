import { METAS_INDICADORES_ESPECIFICACION as METAS } from "../../config/panel-goals.defaults";
import { calcularDelta } from "../delta";
import { evaluarAvance, evaluarSemaforo } from "../semaforo";

describe("evaluarSemaforo", () => {
  it("nunca marca verde si no cumple la meta", () => {
    expect(evaluarSemaforo(0.6, METAS.confirmacion)).toBe("cerca");
    expect(evaluarSemaforo(0.5, METAS.confirmacion)).toBe("bajo");
    expect(evaluarSemaforo(0.65, METAS.confirmacion)).toBe("cumple");
  });

  it("compara porcentajes redondeados a 2 decimales", () => {
    expect(evaluarSemaforo(0.649, METAS.confirmacion)).toBe("cumple");
    expect(evaluarSemaforo(0.644, METAS.confirmacion)).toBe("cerca");
  });

  it("usa tolerancia de 50% en tiempo a 1ª llamada y 20% en retorno", () => {
    expect(evaluarSemaforo(44, METAS.tiempo_primera_llamada)).toBe("cerca");
    expect(evaluarSemaforo(46, METAS.tiempo_primera_llamada)).toBe("bajo");
    expect(evaluarSemaforo(3.3, METAS.retorno_publicidad)).toBe("cerca");
    expect(evaluarSemaforo(3.1, METAS.retorno_publicidad)).toBe("bajo");
  });

  it("con meta 0 acepta hasta 2 como cerca", () => {
    expect(evaluarSemaforo(0, METAS.ventas_sin_guia)).toBe("cumple");
    expect(evaluarSemaforo(2, METAS.ventas_sin_guia)).toBe("cerca");
    expect(evaluarSemaforo(3, METAS.ventas_sin_guia)).toBe("bajo");
  });

  it("sin dato no es verde", () => {
    expect(evaluarSemaforo(null, METAS.confirmacion)).toBe("sin_datos");
    expect(evaluarSemaforo(Number.NaN, METAS.confirmacion)).toBe("sin_datos");
  });

  it("evalúa avance contra meta del periodo", () => {
    expect(evaluarAvance(100, 100)).toBe("cumple");
    expect(evaluarAvance(90, 100)).toBe("cerca");
    expect(evaluarAvance(50, 100)).toBe("bajo");
    expect(evaluarAvance(50, 0)).toBe("sin_datos");
  });
});

describe("calcularDelta", () => {
  it("indica mejora según el sentido de la métrica", () => {
    expect(calcularDelta(110, 100)).toEqual({ variacion: 0.1, tono: "bueno" });
    expect(calcularDelta(110, 100, "menos_es_mejor").tono).toBe("malo");
  });

  it("no compara contra cero ni datos faltantes", () => {
    expect(calcularDelta(10, 0).tono).toBe("sin_dato");
    expect(calcularDelta(null, 10).tono).toBe("sin_dato");
  });

  it("marca como neutro variaciones menores a 0.5%", () => {
    expect(calcularDelta(100.2, 100).tono).toBe("neutro");
  });
});
