import { whatsappLink } from "../whatsapp-link";

describe("whatsappLink", () => {
  it("arma el enlace con el texto codificado", () => {
    const texto = "Pedido ñandú: ¿está listo? a&b\nGracias áé";
    const url = whatsappLink({ telefono: "987654321", texto });
    expect(url).toBe(`https://wa.me/51987654321?text=${encodeURIComponent(texto)}`);
    expect(url).toContain("%0A");
    expect(url).toContain("%26");
    expect(url).toContain("%3F");
    expect(decodeURIComponent(url.split("text=")[1])).toBe(texto);
  });

  it("teléfono con espacios o guiones y 9 dígitos lleva prefijo 51", () => {
    expect(whatsappLink({ telefono: "987 654-321", texto: "x" })).toBe(
      "https://wa.me/51987654321?text=x",
    );
  });

  it("respeta un número que ya trae el código de país", () => {
    expect(whatsappLink({ telefono: "+51 987 654 321", texto: "x" })).toBe(
      "https://wa.me/51987654321?text=x",
    );
  });

  it("teléfono vacío, nulo o inválido va sin número", () => {
    for (const telefono of [undefined, null, "", "  ", "abc", "12345"]) {
      expect(whatsappLink({ telefono, texto: "hola" })).toBe("https://wa.me/?text=hola");
    }
  });
});
