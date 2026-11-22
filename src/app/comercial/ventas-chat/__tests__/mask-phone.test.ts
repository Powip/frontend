import { contactLabel, maskPhone, showPhone } from "@/components/ventas-chat/format";

describe("teléfono enmascarado", () => {
  it("oculta el centro y deja 3 + 3 dígitos", () => {
    expect(maskPhone("951234245")).toBe("951 *** 245");
  });

  it("separa el código de país", () => {
    expect(maskPhone("+51 951 234 245")).toBe("+51 951 *** 245");
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
