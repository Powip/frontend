import { contactLabel, crearPedidoUrl, maskPhone, showPhone } from "@/components/ventas-chat/format";
import { telHref, toLocalPhone } from "@/lib/crmPhone";

describe("teléfono enmascarado", () => {
  it("oculta el centro y deja 3 + 3 dígitos", () => {
    expect(maskPhone("951234245")).toBe("951 *** 245");
  });

  it("separa el código de país", () => {
    expect(maskPhone("+51 951 234 245")).toBe("+51 951 *** 245");
  });

  it("un teléfono que ya llegó oculto se queda igual", () => {
    expect(maskPhone("+51 951 *** 245")).toBe("+51 951 *** 245");
    expect(showPhone("951 *** 245", true)).toBe("951 *** 245");
  });

  it("un teléfono oculto no sirve para llamar, buscar ni vender", () => {
    expect(telHref("+51 951 *** 245")).toBeNull();
    expect(toLocalPhone("+51 951 *** 245")).toBe("");
    const url = crearPedidoUrl({ id: "c1", channel: "whatsapp", contactPhone: "+51 951 *** 245" });
    expect(new URLSearchParams(url.split("?")[1]).has("crmPhone")).toBe(false);
  });

  it("números muy cortos se ocultan del todo", () => {
    expect(maskPhone("12345")).toBe("***");
  });

  it("showPhone solo enmascara si se pide", () => {
    expect(showPhone("51951234245", false)).toBe("51951234245");
    expect(showPhone("51951234245", true)).toBe("+51 951 *** 245");
    expect(showPhone(null, true)).toBeNull();
  });

  it("contactLabel usa el nombre y, sin nombre, el teléfono oculto", () => {
    expect(contactLabel({ contactName: "Ana", contactPhone: "51951234245" }, true)).toBe("Ana");
    expect(contactLabel({ contactName: null, contactPhone: "51951234245" }, true)).toBe("+51 951 *** 245");
    expect(contactLabel({ contactName: null, contactPhone: "51951234245" })).toBe("51951234245");
  });
});
