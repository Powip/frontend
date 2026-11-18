/**
 * @jest-environment node
 */
import {
  greEmissionBlockReason,
  greErrorMessage,
  greFormFromOrder,
  greFormFromTransfer,
  greFormProblems,
  greFormToRequest,
  greLastErrorText,
  isGreEligibleOrderStatus,
  isGreEligibleTransferStatus,
  type GreFormState,
} from "../gre-form";

// FEAT-24 H12 — lógica pura de la guía de remisión: precarga desde el pedido y
// desde el traslado, las reglas SUNAT antes de tomar número y los mensajes.

const TODAY = "2026-11-18";

const order = {
  orderNumber: "ORD-1001",
  customer: {
    fullName: "María Pérez",
    documentType: "DNI",
    documentNumber: "45678912",
    city: "Lima",
    province: "Lima",
    district: "Miraflores",
    address: "Av. Larco 123",
  },
  items: [
    { sku: "POLO-M", productName: "Polo", attributes: { talla: "M" }, quantity: 2 },
    { sku: "GORRA", productName: "Gorra", quantity: 0 },
  ],
};

const centralWarehouse = { name: "Central", ubigeo: "150101", address: "Jr. Puno 890", sunatEstablishmentCode: "0001" };
const southWarehouse = { name: "Tienda Sur", ubigeo: "150141", address: "Av. Benavides 500", sunatEstablishmentCode: "0002" };

function readySaleForm(): GreFormState {
  const { form } = greFormFromOrder(order, centralWarehouse, TODAY);
  return {
    ...form,
    sunatProfileId: "p-1",
    grossWeightKg: "1.5",
    destination: { ...form.destination, ubigeo: "150122" },
    carrier: { ruc: "20100070970", name: "Olva Courier S.A.C.", mtcRegistrationNumber: "" },
  };
}

describe("precarga", () => {
  it("motivo 01: destinatario, llegada e ítems NIU del pedido; partida = ficha del almacén", () => {
    const { form, destinationNames } = greFormFromOrder(order, centralWarehouse, TODAY);
    expect(form.transferReason).toBe("01");
    expect(form.externalReference).toBe("ORD-1001");
    expect(form.recipient).toEqual({ documentType: "1", documentNumber: "45678912", name: "María Pérez" });
    expect(form.origin).toEqual({ ubigeo: "150101", address: "Jr. Puno 890", establishmentCode: "0001" });
    expect(form.destination).toEqual({ ubigeo: "", address: "Av. Larco 123", establishmentCode: "" });
    expect(destinationNames).toEqual({ department: "Lima", province: "Lima", district: "Miraflores" });
    expect(form.items).toHaveLength(1);
    expect(form.items[0]).toMatchObject({ quantity: 2, code: "POLO-M" });
    expect(form.items[0].description).toContain("Polo");
  });

  it("un RUC del cliente pasa a tipo 6 y un ubigeo inválido del almacén queda vacío", () => {
    const { form } = greFormFromOrder(
      { ...order, customer: { ...order.customer, documentType: null, documentNumber: "20601234567" } },
      { ...centralWarehouse, ubigeo: "15" },
      TODAY,
    );
    expect(form.recipient.documentType).toBe("6");
    expect(form.origin.ubigeo).toBe("");
  });

  it("motivo 04: partida y llegada de las fichas de los dos almacenes, ítems de las líneas enviadas", () => {
    const form = greFormFromTransfer(
      { number: "TR-0001", lines: [{ sku: "POLO", productName: "Polo", quantitySent: 2 }, { sku: "X", productName: "X", quantitySent: 0 }] },
      centralWarehouse,
      southWarehouse,
      TODAY,
    );
    expect(form.transferReason).toBe("04");
    expect(form.externalReference).toBe("TR-0001");
    expect(form.origin.establishmentCode).toBe("0001");
    expect(form.destination).toEqual({ ubigeo: "150141", address: "Av. Benavides 500", establishmentCode: "0002" });
    expect(form.items).toEqual([{ description: "Polo", quantity: 2, code: "POLO" }]);
  });
});

describe("reglas antes de emitir", () => {
  it("un formulario completo de venta con transporte público no tiene problemas", () => {
    expect(greFormProblems(readySaleForm(), { today: TODAY, issuerRuc: "20111111111" })).toEqual({});
  });

  it("sin ubigeo de llegada no se emite", () => {
    const form = readySaleForm();
    form.destination.ubigeo = "";
    expect(greFormProblems(form, { today: TODAY, issuerRuc: null })["destination.ubigeo"]).toMatch(/departamento, provincia y distrito/);
  });

  it("transporte público: RUC del transportista de 11 dígitos, distinto del emisor, y razón social", () => {
    const form = readySaleForm();
    form.carrier = { ruc: "2010", name: "", mtcRegistrationNumber: "" };
    let problems = greFormProblems(form, { today: TODAY, issuerRuc: "20111111111" });
    expect(problems["carrier.ruc"]).toMatch(/11 dígitos/);
    expect(problems["carrier.name"]).toBeDefined();

    form.carrier = { ruc: "20111111111", name: "Yo mismo", mtcRegistrationNumber: "" };
    problems = greFormProblems(form, { today: TODAY, issuerRuc: "20111111111" });
    expect(problems["carrier.ruc"]).toMatch(/transporte privado/);
  });

  it("transporte privado: placa, conductor con DNI y licencia", () => {
    const form: GreFormState = { ...readySaleForm(), transportMode: "02" };
    const problems = greFormProblems(form, { today: TODAY, issuerRuc: null });
    expect(problems["vehicle.plate"]).toMatch(/placa/i);
    expect(problems["drivers.0.identityDocumentNumber"]).toBeDefined();
    expect(problems["drivers.0.firstName"]).toBeDefined();
    expect(problems["drivers.0.familyName"]).toBeDefined();
    expect(problems["drivers.0.licenseNumber"]).toMatch(/licencia/i);
    expect(problems["carrier.ruc"]).toBeUndefined();

    const filled: GreFormState = {
      ...form,
      vehicle: { plate: "abc-123" },
      driver: { documentType: "1", documentNumber: "12345678", firstName: "Juan", familyName: "Quispe", licenseNumber: "q12345678" },
    };
    expect(greFormProblems(filled, { today: TODAY, issuerRuc: null })).toEqual({});
    const request = greFormToRequest(filled);
    expect(request.vehicle).toEqual({ plate: "ABC123" });
    expect(request.drivers?.[0]).toMatchObject({ identityDocumentNumber: "12345678", licenseNumber: "Q12345678" });
    expect(request.carrier).toBeUndefined();
  });

  it("peso, bultos, fecha y destinatario", () => {
    const form: GreFormState = {
      ...readySaleForm(),
      grossWeightKg: "1.2345",
      packageCount: "0",
      transferStartDate: "2026-11-17",
      recipient: { documentType: "6", documentNumber: "20111111111", name: "" },
    };
    const problems = greFormProblems(form, { today: TODAY, issuerRuc: "20111111111" });
    expect(problems.grossWeightKg).toMatch(/3 decimales/);
    expect(problems.packageCount).toBeDefined();
    expect(problems.transferStartDate).toMatch(/anterior a hoy/);
    expect(problems["recipient.identityDocumentNumber"]).toMatch(/propio RUC/);
    expect(problems["recipient.name"]).toBeDefined();
  });

  it("motivo 04 exige el código de establecimiento en los dos puntos y llegada distinta de partida", () => {
    const form: GreFormState = {
      ...greFormFromTransfer({ number: "TR-1", lines: [{ productName: "Polo", quantitySent: 1 }] }, centralWarehouse, { ...centralWarehouse, sunatEstablishmentCode: "" }, TODAY),
      sunatProfileId: "p-1",
      grossWeightKg: "2",
      transportMode: "02",
      vehicle: { plate: "ABC123" },
      driver: { documentType: "1", documentNumber: "12345678", firstName: "Juan", familyName: "Quispe", licenseNumber: "Q12345678" },
    };
    const problems = greFormProblems(form, { today: TODAY, issuerRuc: null });
    expect(problems["destination.establishmentCode"]).toMatch(/ficha del almacén/);
    expect(problems.destination).toMatch(/mismo que el de partida/);
    expect(problems["recipient.identityDocumentNumber"]).toBeUndefined();
  });

  it("el cuerpo de una venta lleva destinatario, transportista e ítems NIU", () => {
    const request = greFormToRequest(readySaleForm());
    expect(request).toMatchObject({
      sunatProfileId: "p-1",
      externalReference: "ORD-1001",
      transferReason: "01",
      transportMode: "01",
      grossWeightKg: 1.5,
      packageCount: 1,
      recipient: { identityDocumentType: "1", identityDocumentNumber: "45678912", name: "María Pérez" },
      origin: { ubigeo: "150101", address: "Jr. Puno 890", establishmentCode: "0001" },
      destination: { ubigeo: "150122", address: "Av. Larco 123" },
      carrier: { ruc: "20100070970", name: "Olva Courier S.A.C." },
    });
    expect(request.items[0]).toMatchObject({ unitCode: "NIU", quantity: 2, code: "POLO-M" });
  });
});

describe("habilitación y mensajes", () => {
  const profile = { sunatProfileId: "p-1", configured: true, isActive: true };

  it("sin conexión con SUNAT no se emite (modo de pruebas, empresa piloto)", () => {
    expect(greEmissionBlockReason({ sunatConnection: "NOT_CONFIGURED", enabledForCompany: true, profiles: [profile] })).toMatch(/empresa piloto/);
  });

  it("con SUNAT producción, una empresa no habilitada no emite aunque tenga credenciales", () => {
    expect(greEmissionBlockReason({ sunatConnection: "SUNAT_PRODUCTION", enabledForCompany: false, profiles: [profile] })).toBe(
      "La guía de remisión electrónica todavía no está habilitada para tu empresa.",
    );
  });

  it("sin credenciales GRE no se emite; con un simulador o con SUNAT y credenciales sí", () => {
    expect(greEmissionBlockReason({ sunatConnection: "SUNAT_PRODUCTION", enabledForCompany: true, profiles: [{ ...profile, configured: false }] })).toMatch(
      /credenciales GRE/,
    );
    expect(greEmissionBlockReason({ sunatConnection: "OTHER", enabledForCompany: true, profiles: [profile] })).toBeNull();
    expect(greEmissionBlockReason({ sunatConnection: "SUNAT_PRODUCTION", enabledForCompany: true, profiles: [profile] })).toBeNull();
  });

  it("traduce los errores de ms-sunat", () => {
    const error = (status: number, data: unknown) => ({ response: { status, data } });
    expect(greErrorMessage(error(409, { code: "GRE_CREDENTIALS_NOT_CONFIGURED" }))).toMatch(/credenciales GRE/);
    expect(greErrorMessage(error(403, { code: "GRE_NO_HABILITADA" }))).toBe("La guía de remisión electrónica todavía no está habilitada para tu empresa.");
    expect(greErrorMessage(error(400, { code: "DESPATCH_ADVICE_RULE_VIOLATION", message: "Invalid: carrier.ruc: bad; vehicle.plate: bad" }))).toBe(
      "SUNAT no aceptaría la guía. Revisa: RUC del transportista, Placa.",
    );
    expect(greErrorMessage(error(400, { message: "Validation failed", errors: [{ path: ["destination", "ubigeo"] }] }))).toMatch(/^Revisa estos datos:/);
    expect(greErrorMessage({})).toMatch(/No hubo respuesta/);
  });

  it("explica el último error de envío", () => {
    expect(greLastErrorText("SUNAT_GRE_AUTH_BASE_URL is not configured")).toMatch(/modo de pruebas/);
    expect(greLastErrorText("invalid_client")).toMatch(/credenciales GRE/);
    expect(greLastErrorText("connect ETIMEDOUT 1.2.3.4:443")).toMatch(/SUNAT no respondió/);
    expect(greLastErrorText(null)).toBeNull();
  });

  it("estados que pueden llevar guía", () => {
    expect(isGreEligibleOrderStatus("PREPARADO")).toBe(true);
    expect(isGreEligibleOrderStatus("PENDIENTE")).toBe(false);
    expect(isGreEligibleOrderStatus("ENTREGADO")).toBe(false);
    expect(isGreEligibleTransferStatus("borrador")).toBe(true);
    expect(isGreEligibleTransferStatus("en_camino")).toBe(true);
    expect(isGreEligibleTransferStatus("recibido")).toBe(false);
  });
});
