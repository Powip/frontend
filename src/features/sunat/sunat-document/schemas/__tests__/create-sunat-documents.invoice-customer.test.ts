import { createSunatDocumentsSchema } from "../create-sunat-documents.schema";

function invoice(customer: Record<string, unknown>) {
  return {
    documents: [
      {
        orderId: "order-1",
        taxDocumentType: "01",
        series: "F001",
        customer: { name: "EMPRESA S.A.C.", address: "Av. 1", countryCode: "PE", ...customer },
        totals: {
          currency: "PEN",
          subtotal: 100,
          discountTotal: 0,
          shippingTotal: 0,
          taxTotal: 18,
          grandTotal: 118,
        },
        items: [
          {
            sku: "SKU-1",
            productName: "Producto",
            quantity: 1,
            unitPrice: 100,
            subtotal: 100,
            discountAmount: 0,
            unitCode: "NIU",
            taxType: "10",
          },
        ],
      },
    ],
  };
}

function messages(customer: Record<string, unknown>): string[] {
  const result = createSunatDocumentsSchema.safeParse(invoice(customer));

  return result.success ? [] : result.error.issues.map((issue) => issue.message);
}

describe("createSunatDocumentsSchema — cliente de una factura", () => {
  it("acepta un cliente con RUC de 11 dígitos", () => {
    expect(messages({ identityDocumentType: "6", identityDocumentNumber: "20100070970" })).toEqual(
      [],
    );
  });

  it("rechaza una factura con cliente identificado por DNI (SUNAT la rechazaría con 2801)", () => {
    expect(messages({ identityDocumentType: "1", identityDocumentNumber: "45332211" })).toContain(
      "La factura requiere el RUC del cliente",
    );
  });

  it("rechaza un RUC que no tiene 11 dígitos", () => {
    expect(messages({ identityDocumentType: "6", identityDocumentNumber: "45332211" })).toContain(
      "El RUC debe tener 11 dígitos",
    );
  });
});
