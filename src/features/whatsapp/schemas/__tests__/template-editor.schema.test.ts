import {
  WHATSAPP_TEMPLATE_CATEGORIES,
  WHATSAPP_TEMPLATE_HEADER_TYPES,
  WHATSAPP_TEMPLATE_USAGES,
} from "../../enums/whatsapp.enums";
import { createTemplateEditorDefaultValues } from "../template-editor.defaults";
import { type TemplateEditorValues, templateEditorSchema } from "../template-editor.schema";

function validValues(overrides: Partial<TemplateEditorValues> = {}): TemplateEditorValues {
  return {
    ...createTemplateEditorDefaultValues(),
    displayName: "Pedido en camino",
    body: "Hola {{cliente}}, tu pedido *{{orden}}* va con {{courier}}.",
    ...overrides,
  };
}

function errorsOf(values: TemplateEditorValues): Record<string, string> {
  const result = templateEditorSchema.safeParse(values);
  if (result.success) return {};
  return Object.fromEntries(
    result.error.issues.map((issue) => [issue.path.join("."), issue.message]),
  );
}

describe("templateEditorSchema", () => {
  it("acepta una plantilla válida", () => {
    expect(errorsOf(validValues())).toEqual({});
  });

  it("los valores por defecto de una plantilla nueva piden nombre y mensaje", () => {
    expect(errorsOf(createTemplateEditorDefaultValues())).toEqual({
      displayName: "Escribe un nombre interno.",
      body: "Escribe el mensaje.",
    });
  });

  it("exige que el nombre produzca un nombre técnico", () => {
    expect(errorsOf(validValues({ displayName: "¿¡ !?" })).displayName).toBe(
      "Usa al menos una letra o un número.",
    );
  });

  it("valida el largo del mensaje, encabezado, pie y botón", () => {
    const errors = errorsOf(
      validValues({
        body: "a".repeat(1025),
        headerType: WHATSAPP_TEMPLATE_HEADER_TYPES.TEXT,
        headerText: "b".repeat(61),
        footer: "c".repeat(61),
        buttonText: "d".repeat(26),
      }),
    );
    expect(errors).toEqual({
      body: "Máximo 1024 caracteres.",
      headerText: "Máximo 60 caracteres.",
      footer: "Máximo 60 caracteres.",
      buttonText: "Máximo 25 caracteres.",
    });
  });

  it("rechaza variables fuera del catálogo del uso y llaves mal formadas", () => {
    expect(errorsOf(validValues({ body: "Tu {{serie_numero}} llegó" })).body).toBe(
      "{{serie_numero}} no está disponible para «Pedido en camino».",
    );
    expect(
      errorsOf(
        validValues({
          usage: WHATSAPP_TEMPLATE_USAGES.INVOICE_ISSUED,
          body: "Tu {{serie_numero}} llegó",
        }),
      ),
    ).toEqual({});
    expect(errorsOf(validValues({ body: "Hola {{cliente}" })).body).toMatch(/Revisa las llaves/);
  });

  it("limita el encabezado a una variable y prohíbe variables en pie y botón", () => {
    const errors = errorsOf(
      validValues({
        headerType: WHATSAPP_TEMPLATE_HEADER_TYPES.TEXT,
        headerText: "{{cliente}} {{orden}}",
        footer: "Hola {{cliente}}",
        buttonText: "Ver {{orden}}",
      }),
    );
    expect(errors).toEqual({
      headerText: "El encabezado admite una sola variable.",
      footer: "El pie no admite variables.",
      buttonText: "El texto del botón no admite variables.",
    });
  });

  it("exige texto si el encabezado es de texto", () => {
    expect(
      errorsOf(validValues({ headerType: WHATSAPP_TEMPLATE_HEADER_TYPES.TEXT, headerText: " " }))
        .headerText,
    ).toBe("Escribe el encabezado o elige «Ninguno».");
  });

  it("permite el encabezado PDF solo para Comprobante emitido", () => {
    expect(
      errorsOf(validValues({ headerType: WHATSAPP_TEMPLATE_HEADER_TYPES.DOCUMENT })).headerType,
    ).toBe("El encabezado PDF solo está disponible para «Comprobante emitido».");
    expect(
      errorsOf(
        validValues({
          usage: WHATSAPP_TEMPLATE_USAGES.INVOICE_ISSUED,
          headerType: WHATSAPP_TEMPLATE_HEADER_TYPES.DOCUMENT,
        }),
      ),
    ).toEqual({});
  });

  it("valida la versión B y el mínimo de envíos solo con A/B activo", () => {
    expect(errorsOf(validValues({ bodyB: "", abMinSendsPerVariant: "x" }))).toEqual({});
    expect(
      errorsOf(validValues({ abEnabled: true, bodyB: "", abMinSendsPerVariant: "0" })),
    ).toEqual({
      bodyB: "Escribe el mensaje de la versión B.",
      abMinSendsPerVariant: "Escribe un número entero entre 1 y 100,000.",
    });
    expect(
      errorsOf(
        validValues({ abEnabled: true, bodyB: "Hola {{cliente}}", abMinSendsPerVariant: "2.5" }),
      ).abMinSendsPerVariant,
    ).toBeDefined();
  });

  it("no bloquea por lenguaje promocional", () => {
    expect(
      errorsOf(
        validValues({
          category: WHATSAPP_TEMPLATE_CATEGORIES.UTILITY,
          body: "Usa el código VUELVE10 y llévate 10% de descuento, {{cliente}}",
        }),
      ),
    ).toEqual({});
  });
});
