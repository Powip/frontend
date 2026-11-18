import type { Order } from "@/features/sales/models/order";
import { buildSunatDocumentFromSale } from "../../utils/build-sunat-document-from-sale";
import { toCreateSunatDocumentsRequestDto } from "../to-create-sunat-documents-request-dto.mapper";

const sale = {
  id: "order-1",
  taxMode: "INCLUIDO",
  shippingTotal: 0,
  discountTotal: 0,
  customer: {
    fullName: "Cliente",
    documentType: "DNI",
    documentNumber: "12345678",
    address: "Av. 1",
  },
  items: [
    {
      id: "i1",
      sku: "SKU-1",
      productName: "Producto",
      quantity: 1,
      unitPrice: 118,
      discountAmount: 0,
    },
  ],
} as unknown as Order;

describe("toCreateSunatDocumentsRequestDto — RUC emisor", () => {
  it("envía el RUC elegido", () => {
    const document = { ...buildSunatDocumentFromSale(sale), sunatProfileId: "profile-2" };

    const dto = toCreateSunatDocumentsRequestDto({ documents: [document] });

    expect(dto.documents[0].sunatProfileId).toBe("profile-2");
  });

  it("sin RUC elegido no envía el campo (el backend usa el predeterminado)", () => {
    const dto = toCreateSunatDocumentsRequestDto({ documents: [buildSunatDocumentFromSale(sale)] });

    expect(dto.documents[0]).not.toHaveProperty("sunatProfileId");
  });
});
