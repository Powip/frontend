import { WHATSAPP_TEMPLATE_USAGES } from "../../enums/whatsapp.enums";
import { hasMalformedVariableTokens } from "../template-render.util";
import {
  getAllowedTemplateVariableKeys,
  insertTextAtSelection,
  toVariableToken,
} from "../template-variables.util";

describe("insertTextAtSelection", () => {
  it("inserta en la posición del cursor y deja el cursor después", () => {
    expect(insertTextAtSelection("Hola , tu pedido", 5, 5, "{{cliente}}")).toEqual({
      value: "Hola {{cliente}}, tu pedido",
      selectionStart: 16,
      selectionEnd: 16,
    });
  });

  it("reemplaza el texto seleccionado", () => {
    expect(insertTextAtSelection("Hola NOMBRE!", 5, 11, "{{cliente}}").value).toBe(
      "Hola {{cliente}}!",
    );
  });

  it("agrega al final si no hay selección conocida", () => {
    expect(insertTextAtSelection("Hola ", null, undefined, "{{cliente}}")).toEqual({
      value: "Hola {{cliente}}",
      selectionStart: 16,
      selectionEnd: 16,
    });
  });

  it("corrige posiciones fuera de rango o invertidas", () => {
    expect(insertTextAtSelection("abc", 10, 2, "X").value).toBe("abcX");
    expect(insertTextAtSelection("abc", -3, -1, "X").value).toBe("Xabc");
  });
});

describe("variables por uso", () => {
  it("solo Comprobante emitido admite tipo y serie del comprobante", () => {
    expect(getAllowedTemplateVariableKeys(WHATSAPP_TEMPLATE_USAGES.INVOICE_ISSUED)).toEqual(
      expect.arrayContaining(["tipo_comprobante", "serie_numero", "cliente"]),
    );
    expect(getAllowedTemplateVariableKeys(WHATSAPP_TEMPLATE_USAGES.IN_TRANSIT)).not.toContain(
      "serie_numero",
    );
  });

  it("arma el token de la variable", () => {
    expect(toVariableToken("link_rastreo")).toBe("{{link_rastreo}}");
  });
});

describe("hasMalformedVariableTokens", () => {
  it.each([
    ["Hola {{cliente}}", false],
    ["Hola {{cliente}", true],
    ["Hola cliente}}", true],
    ["Hola {{ }}", true],
    ["Hola {{cli ente}}", true],
    ["Sin variables", false],
  ])("%p → %p", (text, expected) => {
    expect(hasMalformedVariableTokens(text)).toBe(expected);
  });
});
