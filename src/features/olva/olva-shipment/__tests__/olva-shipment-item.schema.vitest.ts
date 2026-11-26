import { describe, expect, it } from "vitest";
import { createOlvaShipmentSchema } from "../schemas/olva-shipment.schema";

const valid = {
  recipient: {
    documentType: "dni",
    documentNumber: "12345678",
    fullName: "Juan Pérez",
    phone: "999888777",
  },
  origin: { headquarterId: "12" },
  destination: { agencyCode: "LIM01" },
  package: { weightKg: "1.5", declaredValue: "80" },
  whoPays: "STORE",
  externalRef: { orderId: " PED-1 ", guideId: "" },
};

const messagesOf = (input: unknown) =>
  createOlvaShipmentSchema.safeParse(input).error?.issues.map((i) => i.message) ?? [];

describe("shipment item rules (mirror of the backend)", () => {
  it("accepts a valid shipment and cleans the order reference", () => {
    const { data, success } = createOlvaShipmentSchema.safeParse(valid);

    expect(success).toBe(true);
    expect(data?.package.declaredValue).toBe(80);
    expect(data?.externalRef).toEqual({ orderId: "PED-1", guideId: undefined });
  });

  it("drops the order reference when its id is blank", () => {
    const { data } = createOlvaShipmentSchema.safeParse({
      ...valid,
      externalRef: { orderId: " ", guideId: "G1" },
    });

    expect(data?.externalRef).toBeUndefined();
  });

  it("requires a declared value above zero", () => {
    expect(messagesOf({ ...valid, package: { weightKg: "1", declaredValue: "" } })).toContain(
      "El valor declarado es obligatorio",
    );
    expect(messagesOf({ ...valid, package: { weightKg: "1", declaredValue: "0" } })).toContain(
      "El valor declarado debe ser mayor a 0",
    );
  });

  it("only registers packages", () => {
    expect(messagesOf({ ...valid, package: { ...valid.package, shipmentType: "1" } })).toContain(
      "Olva solo registra paquetes (tipo 2)",
    );
    expect(
      createOlvaShipmentSchema.safeParse({
        ...valid,
        package: { ...valid.package, shipmentType: "2" },
      }).success,
    ).toBe(true);
  });

  it("ONLINE needs a payment method; any other mode forbids it", () => {
    expect(messagesOf({ ...valid, whoPays: "ONLINE" })).toEqual(["Elige un método de pago"]);
    expect(
      createOlvaShipmentSchema.safeParse({ ...valid, whoPays: "ONLINE", paymentMethod: "niubiz" })
        .success,
    ).toBe(true);
    expect(messagesOf({ ...valid, whoPays: "STORE", paymentMethod: "niubiz" })).toEqual([
      "El método de pago solo aplica cuando se paga en línea",
    ]);
  });

  it("store pickup needs an agency and takes no ubigeo", () => {
    expect(messagesOf({ ...valid, destination: {} })).toEqual(["Elige la agencia de destino"]);
    expect(
      messagesOf({ ...valid, destination: { agencyCode: "LIM01", ubigeoCode: "250202" } }),
    ).toEqual(["El ubigeo solo aplica a la entrega a domicilio"]);
  });

  describe("home delivery", () => {
    const home = {
      ...valid,
      deliveryType: "D",
      whoPays: "ONLINE",
      paymentMethod: "niubiz",
      destination: {
        ubigeoCode: "250202",
        address: "Av. 1",
        reference: "Frente al parque",
      },
    };

    it("accepts a valid one and narrows it to the home fields", () => {
      const { data, success } = createOlvaShipmentSchema.safeParse(home);

      expect(success).toBe(true);
      expect(data?.deliveryType).toBe("D");
      expect(data?.destination).toEqual({
        ubigeoCode: "250202",
        address: "Av. 1",
        reference: "Frente al parque",
      });
      expect(data?.whoPays).toBe("ONLINE");
      expect(data?.paymentMethod).toBe("niubiz");
      expect(data?.pin).toBeUndefined();
    });

    it("needs a ubigeo, an address and a reference of at least 3 characters", () => {
      expect(messagesOf({ ...home, destination: {} })).toEqual([
        "Elige el distrito de destino para la entrega a domicilio",
        "La dirección de destino es obligatoria para entrega a domicilio",
        "La referencia es obligatoria para entrega a domicilio (mínimo 3 caracteres)",
      ]);
      expect(
        messagesOf({ ...home, destination: { ...home.destination, reference: "ab" } }),
      ).toEqual(["La referencia es obligatoria para entrega a domicilio (mínimo 3 caracteres)"]);
    });

    it("needs the ubigeo to have exactly 6 digits", () => {
      for (const ubigeoCode of ["25020", "2502022", "25020a"]) {
        expect(messagesOf({ ...home, destination: { ...home.destination, ubigeoCode } })).toEqual([
          "El ubigeo debe tener exactamente 6 dígitos",
        ]);
      }
    });

    it("takes no agency", () => {
      expect(
        messagesOf({ ...home, destination: { ...home.destination, agencyCode: "LIM01" } }),
      ).toEqual(["La agencia solo aplica al recojo en tienda"]);
    });

    it("is only registered paid online, with a payment method", () => {
      expect(messagesOf({ ...home, whoPays: "STORE", paymentMethod: undefined })).toEqual([
        "La entrega a domicilio solo se registra pagada en línea",
      ]);
      expect(messagesOf({ ...home, whoPays: undefined, paymentMethod: undefined })).toEqual([
        "La entrega a domicilio solo se registra pagada en línea",
      ]);
      expect(messagesOf({ ...home, paymentMethod: undefined })).toEqual([
        "Elige un método de pago",
      ]);
    });

    it("takes no PIN", () => {
      expect(messagesOf({ ...home, pin: "1234" })).toEqual([
        "El PIN solo aplica al recojo en tienda",
      ]);
    });
  });

  it("caps the declared value when the destination pays", () => {
    const over = {
      ...valid,
      whoPays: "DESTINATION",
      package: { weightKg: "1", declaredValue: "1501" },
    };

    expect(messagesOf(over)).toEqual([
      "El valor declarado no puede superar 1500 cuando paga el destinatario",
    ]);
    expect(
      createOlvaShipmentSchema.safeParse({
        ...over,
        package: { weightKg: "1", declaredValue: "1500" },
      }).success,
    ).toBe(true);
  });
});
