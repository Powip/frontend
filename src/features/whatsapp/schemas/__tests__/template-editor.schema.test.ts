import {
  WHATSAPP_TEMPLATE_CATEGORIES,
  WHATSAPP_TEMPLATE_HEADER_TYPES,
  WHATSAPP_TEMPLATE_USAGES,
} from "../../enums/whatsapp.enums";
import { WHATSAPP_TEMPLATE_USAGE_DEFINITIONS } from "../../constants/whatsapp-template-catalog";
import { createTemplateEditorDefaultValues } from "../template-editor.defaults";
import { type TemplateEditorValues, templateEditorSchema } from "../template-editor.schema";

function validValues(overrides: Partial<TemplateEditorValues> = {}): TemplateEditorValues {
  return {
    ...createTemplateEditorDefaultValues(),
    displayName: "Pedido en camino",
    body: "Hola {{cliente}}, tu pedido *{{orden}}* va con {{courier}} hoy.",
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

  it.each([
    "{{cliente}}, tu pedido va en camino",
    "¡{{cliente}}, tu pedido va en camino",
    "Gracias por comprar en {{tienda}}",
    "Gracias por comprar en {{tienda}}!",
    "Gracias por comprar en {{tienda}}. ",
  ])("rechaza un mensaje que empieza o termina con una variable (%s)", (body) => {
    expect(errorsOf(validValues({ body })).body).toBe(
      "Meta no acepta un mensaje que empiece o termine con una variable. Agrega texto antes o después.",
    );
  });

  it("acepta variables en medio del mensaje aunque haya signos al final", () => {
    expect(
      errorsOf(validValues({ body: "Gracias por comprar en {{tienda}}, te esperamos pronto!" })),
    ).toEqual({});
  });

  it("los textos sugeridos de cada uso pasan la validación", () => {
    for (const definition of WHATSAPP_TEMPLATE_USAGE_DEFINITIONS) {
      if (!definition.suggestion) continue;
      const errors = errorsOf(
        validValues({
          usage: definition.value,
          body: definition.suggestion.body,
          buttonText: definition.suggestion.buttonText,
          headerType: definition.suggestion.headerText
            ? WHATSAPP_TEMPLATE_HEADER_TYPES.TEXT
            : WHATSAPP_TEMPLATE_HEADER_TYPES.NONE,
          headerText: definition.suggestion.headerText ?? "",
        }),
      );
      expect({ usage: definition.value, errors }).toEqual({ usage: definition.value, errors: {} });
    }
  });

  it("exige texto si el encabezado es de texto", () => {
    expect(
      errorsOf(validValues({ headerType: WHATSAPP_TEMPLATE_HEADER_TYPES.TEXT, headerText: " " }))
        .headerText,
    ).toBe("Escribe el encabezado o elige «Ninguno».");
  });

  it.each(["📦 Tu pedido va en camino", "Tu *pedido*", "Línea 1\nLínea 2"])(
    "rechaza emojis, formato o saltos de línea en el encabezado (%s)",
    (headerText) => {
      expect(
        errorsOf(validValues({ headerType: WHATSAPP_TEMPLATE_HEADER_TYPES.TEXT, headerText }))
          .headerText,
      ).toBe(
        "El encabezado no admite emojis, saltos de línea ni formato (*, _, ~). Ponlos en el mensaje.",
      );
    },
  );

  it("acepta un encabezado de texto con tildes y una variable", () => {
    expect(
      errorsOf(
        validValues({
          headerType: WHATSAPP_TEMPLATE_HEADER_TYPES.TEXT,
          headerText: "Tu pedido va en camino, {{cliente}}",
        }),
      ).headerText,
    ).toBeUndefined();
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
          body: "Usa el código VUELVE10 y llévate 10% de descuento, {{cliente}}. ¡Aprovecha!",
        }),
      ),
    ).toEqual({});
  });
});
