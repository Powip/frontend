import {
  extractTemplateVariables,
  findUnknownTemplateVariables,
  renderTemplatePlainText,
  renderTemplateSegments,
} from "../template-render.util";

describe("renderTemplateSegments", () => {
  it("reemplaza variables conocidas y marca las que no tienen valor", () => {
    const segments = renderTemplateSegments("Hola {{cliente}}, tu agencia es {{agencia}}.", {
      cliente: "Carlos",
      agencia: "",
    });
    expect(segments).toEqual([
      { type: "text", text: "Hola ", bold: false, italic: false },
      { type: "variable", name: "cliente", value: "Carlos", bold: false, italic: false },
      { type: "text", text: ", tu agencia es ", bold: false, italic: false },
      { type: "variable", name: "agencia", value: null, bold: false, italic: false },
      { type: "text", text: ".", bold: false, italic: false },
    ]);
  });

  it("aplica negrita y cursiva sin romper variables con guion bajo", () => {
    const segments = renderTemplateSegments(
      "Tu pedido *{{orden}}* llega el _{{fecha_entrega}}_ vía {{link_rastreo}}",
      { orden: "ORD-1", fecha_entrega: "jueves", link_rastreo: "powip.lat/r/X" },
    );
    expect(segments).toEqual([
      { type: "text", text: "Tu pedido ", bold: false, italic: false },
      { type: "variable", name: "orden", value: "ORD-1", bold: true, italic: false },
      { type: "text", text: " llega el ", bold: false, italic: false },
      { type: "variable", name: "fecha_entrega", value: "jueves", bold: false, italic: true },
      { type: "text", text: " vía ", bold: false, italic: false },
      {
        type: "variable",
        name: "link_rastreo",
        value: "powip.lat/r/X",
        bold: false,
        italic: false,
      },
    ]);
  });

  it("anida cursiva dentro de negrita", () => {
    expect(renderTemplateSegments("*hola _mundo_*")).toEqual([
      { type: "text", text: "hola ", bold: true, italic: false },
      { type: "text", text: "mundo", bold: true, italic: true },
    ]);
  });

  it("no interpreta HTML ni marcadores internos", () => {
    const segments = renderTemplateSegments('<img src=x onerror="alert(1)"> 0 <b>x</b>');
    expect(segments).toEqual([
      {
        type: "text",
        text: '<img src=x onerror="alert(1)"> 0 <b>x</b>',
        bold: false,
        italic: false,
      },
    ]);
  });

  it("deja literales los asteriscos sin cierre y los saltos de línea", () => {
    expect(renderTemplatePlainText("Precio *S/ 10\nfin*")).toBe("Precio *S/ 10\nfin*");
  });

  it("el texto plano conserva variables sin valor como marcador", () => {
    expect(renderTemplatePlainText("Hola {{cliente}} de {{tienda}}", { cliente: "Ana" })).toBe(
      "Hola Ana de {{tienda}}",
    );
  });
});

describe("variables de plantilla", () => {
  it("extrae nombres únicos en orden de aparición", () => {
    expect(extractTemplateVariables("{{cliente}} {{orden}} {{ cliente }}")).toEqual([
      "cliente",
      "orden",
    ]);
  });

  it("detecta variables fuera del catálogo permitido", () => {
    expect(findUnknownTemplateVariables("{{cliente}} {{cupon}}", ["cliente", "orden"])).toEqual([
      "cupon",
    ]);
  });
});
