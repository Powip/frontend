import { decodeHtmlEntities } from "@/features/sunat/sunat-document/utils/decode-html-entities";

describe("decodeHtmlEntities", () => {
  it("decodifica entidades numéricas decimales y hexadecimales", () => {
    expect(decodeHtmlEntities("informaci&#243;n")).toBe("información");
    expect(decodeHtmlEntities("informaci&#xF3;n")).toBe("información");
    expect(decodeHtmlEntities("informaci&#xf3;n")).toBe("información");
  });

  it("decodifica las entidades nombradas comunes", () => {
    expect(decodeHtmlEntities("&amp; &lt; &gt; &quot; &apos; &#39;")).toBe("& < > \" ' '");
    expect(decodeHtmlEntities("a&nbsp;b")).toBe("a b");
  });

  it("deja tal cual las entidades desconocidas o inválidas", () => {
    expect(decodeHtmlEntities("&foo; &#99999999;")).toBe("&foo; &#99999999;");
  });

  it("no toca un texto sin entidades", () => {
    expect(decodeHtmlEntities("1033 - El comprobante")).toBe("1033 - El comprobante");
  });
});
