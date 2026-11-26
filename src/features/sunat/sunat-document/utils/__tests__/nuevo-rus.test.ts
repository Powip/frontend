import type { Order } from "@/features/sales/models/order";
import { SUNAT_DOCUMENT_TYPES } from "../../enums/sunat-document.enums";
import { buildSunatDocumentFromSale } from "../build-sunat-document-from-sale";
import {
  GIFT_MODES,
  getAllowedGiftModes,
  getCompanyPaidGiftIgv,
  getGiftNormalUnitPrice,
  toReferenceUnitValue,
} from "../gift-lines";
import { NUEVO_RUS_TAX_TYPE } from "../nuevo-rus";

type SaleItem = {
  sku: string;
  quantity: number;
  unitPrice: number;
  discountAmount?: number;
  isGift?: boolean;
  giftValue?: number;
};

function sale(params: {
  items: SaleItem[];
  shippingTotal?: number;
  discountTotal?: number;
  documentType?: "DNI" | "RUC";
}): Order {
  return {
    id: "order-nrus",
    taxMode: "INCLUIDO",
    shippingTotal: params.shippingTotal ?? 0,
    discountTotal: params.discountTotal ?? 0,
    customer: {
      fullName: "Cliente Prueba",
      documentType: params.documentType ?? "DNI",
      documentNumber: params.documentType === "RUC" ? "20123456789" : "12345678",
      address: "Av. Siempre Viva 123",
    },
    items: params.items.map((item, index) => ({
      id: `item-${index}`,
      productName: `Producto ${index + 1}`,
      discountAmount: 0,
      ...item,
    })),
  } as unknown as Order;
}

const NRUS = { taxRegime: "NUEVO_RUS" } as const;

describe("buildSunatDocumentFromSale — emisor en Nuevo RUS", () => {
  it("usa el código único de Nuevo RUS (20, NO VERIFICADO)", () => {
    expect(NUEVO_RUS_TAX_TYPE).toBe("20");
  });

  it("boleta sin IGV: el precio va completo y el total es lo que pagó el cliente", () => {
    const document = buildSunatDocumentFromSale(
      sale({ items: [{ sku: "A", quantity: 1, unitPrice: 59 }] }),
      NRUS,
    );

    expect(document.taxDocumentType).toBe(SUNAT_DOCUMENT_TYPES.SALES_RECEIPT);
    expect(document.items[0]).toMatchObject({ taxType: "20", unitPrice: 59, subtotal: 59 });
    expect(document.totals).toMatchObject({ subtotal: 59, taxTotal: 0, grandTotal: 59 });
  });

  it("cliente con RUC: sigue siendo boleta (Nuevo RUS no emite facturas)", () => {
    const document = buildSunatDocumentFromSale(
      sale({ items: [{ sku: "A", quantity: 2, unitPrice: 50 }], documentType: "RUC" }),
      NRUS,
    );

    expect(document.taxDocumentType).toBe(SUNAT_DOCUMENT_TYPES.SALES_RECEIPT);
    expect(document.series).toBe("B001");
    expect(document.totals.grandTotal).toBe(100);
    expect(document.totals.taxTotal).toBe(0);
  });

  it("descuento y envío con cobro: sin IGV y el total no cambia", () => {
    const document = buildSunatDocumentFromSale(
      sale({
        items: [{ sku: "A", quantity: 1, unitPrice: 100, discountAmount: 10 }],
        shippingTotal: 13,
        discountTotal: 10,
      }),
      NRUS,
    );

    expect(document.items.map((item) => item.taxType)).toEqual(["20", "20"]);
    expect(document.items[0].discountAmount).toBe(10);
    expect(document.items[1]).toMatchObject({ sku: "DELIVERY", unitPrice: 13 });
    expect(document.totals).toMatchObject({ taxTotal: 0, grandTotal: 103 });
  });

  it("envío gratis: no va en la boleta, igual que hoy", () => {
    const document = buildSunatDocumentFromSale(
      sale({
        items: [{ sku: "A", quantity: 1, unitPrice: 100 }],
        shippingTotal: 13,
        discountTotal: 13,
      }),
      NRUS,
    );

    expect(document.items.map((item) => item.sku)).toEqual(["A"]);
    expect(document.totals).toMatchObject({ taxTotal: 0, grandTotal: 100 });
  });

  it("regalo: su valor referencial es el precio normal, sin quitar IGV", () => {
    const document = buildSunatDocumentFromSale(
      sale({
        items: [
          { sku: "A", quantity: 1, unitPrice: 59 },
          { sku: "REGALO", quantity: 2, unitPrice: 0, isGift: true, giftValue: 20 },
        ],
      }),
      NRUS,
    );

    expect(document.items[1].referenceUnitValue).toBe(10);
  });

  it("régimen general sigue igual: factura con IGV para cliente con RUC", () => {
    const document = buildSunatDocumentFromSale(
      sale({ items: [{ sku: "A", quantity: 1, unitPrice: 118 }], documentType: "RUC" }),
      { taxRegime: "GENERAL" },
    );

    expect(document.taxDocumentType).toBe(SUNAT_DOCUMENT_TYPES.INVOICE);
    expect(document.items[0].taxType).toBe("10");
    expect(document.totals).toMatchObject({ subtotal: 100, taxTotal: 18, grandTotal: 118 });
  });
});

describe("regalos — emisor en Nuevo RUS", () => {
  const gift = {
    sku: "R",
    productName: "Regalo",
    quantity: 1,
    unitPrice: 0,
    subtotal: 0,
    discountAmount: 0,
    unitCode: "NIU",
    taxType: "10",
    giftOrigin: { unitPrice: 0, discountAmount: 0, taxType: "10" },
  } as never;
  const product = { ...(gift as object), sku: "A", giftOrigin: undefined } as never;

  it("solo permite regalo de promoción (31); el 13 lleva IGV", () => {
    expect(getAllowedGiftModes([product, gift], "NUEVO_RUS")).toEqual([GIFT_MODES.PROMOCION]);
    expect(getAllowedGiftModes([product, gift])).toEqual([GIFT_MODES.PROMOCION, GIFT_MODES.APARTE]);
  });

  it("un comprobante solo de regalos no tiene opción (31 necesita una compra)", () => {
    expect(getAllowedGiftModes([gift], "NUEVO_RUS")).toEqual([]);
  });

  it("precio normal = valor referencial (sin 18%)", () => {
    expect(toReferenceUnitValue(25, "NUEVO_RUS")).toBe(25);
    expect(getGiftNormalUnitPrice({ referenceUnitValue: 25 }, "NUEVO_RUS")).toBe(25);
    expect(getGiftNormalUnitPrice({ referenceUnitValue: 25 })).toBe(29.5);
  });

  it("no hay IGV que pague la empresa", () => {
    const aparte = { ...(gift as object), taxType: "13", referenceUnitValue: 10 } as never;
    expect(getCompanyPaidGiftIgv([aparte], "NUEVO_RUS")).toBe(0);
  });
});
