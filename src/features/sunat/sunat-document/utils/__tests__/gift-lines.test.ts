import type { Order } from "@/features/sales/models/order";
import { toCreateSunatDocumentsRequestDto } from "../../mappers/to-create-sunat-documents-request-dto.mapper";
import type { SunatDocument } from "../../models/sunat-document.model";
import { buildCreditNoteRequest } from "../build-credit-note-request";
import { buildSunatDocumentFromSale } from "../build-sunat-document-from-sale";
import { calculateSunatDocumentTotals } from "../calculate-sunat-document-totals";
import { findLinesWithoutValue } from "../find-lines-without-value";
import {
  applyGiftMode,
  GIFT_MODES,
  type GiftMode,
  getAllowedGiftModes,
  getCompanyPaidGiftIgv,
  getGiftNormalUnitPrice,
  getGiftsWithoutPrice,
  toReferenceUnitValue,
} from "../gift-lines";

type SaleItem = {
  sku: string;
  quantity: number;
  unitPrice: number;
  discountAmount?: number;
  isGift?: boolean;
  giftValue?: number | null;
};

/** Venta mínima como la guarda Powip, con precios con IGV (INCLUIDO). */
function sale(items: SaleItem[], extra: Partial<Order> = {}): Order {
  return {
    id: "order-1",
    taxMode: "INCLUIDO",
    shippingTotal: 0,
    discountTotal: 0,
    customer: {
      fullName: "Cliente Prueba",
      documentType: "DNI",
      documentNumber: "12345678",
      address: "Av. Siempre Viva 123",
    },
    items: items.map((item, index) => ({
      id: `item-${index}`,
      productName: item.sku,
      discountAmount: 0,
      ...item,
    })),
    ...extra,
  } as unknown as Order;
}

/** Lo que hace la pantalla al elegir una opción: aplica el modo y recalcula los totales. */
function issue(order: Order, mode: GiftMode) {
  const document = buildSunatDocumentFromSale(order);
  const items = applyGiftMode(document.items, mode);

  return {
    ...document,
    items,
    totals: { ...document.totals, ...calculateSunatDocumentTotals(items) },
  };
}

function requestOf(document: ReturnType<typeof issue>) {
  return toCreateSunatDocumentsRequestDto({ documents: [document] }).documents[0];
}

const polo = { sku: "POLO", quantity: 1, unitPrice: 100 };

describe("regalo marcado en la venta (isGift con giftValue)", () => {
  const order = sale([
    polo,
    { sku: "GORRA", quantity: 1, unitPrice: 0, isGift: true, giftValue: 30 },
  ]);

  it("sin elegir, queda como la venta y bloquea: línea en S/ 0.00", () => {
    const document = issue(order, GIFT_MODES.NONE);

    expect(document.items[1].taxType).toBe("10");
    expect(findLinesWithoutValue(document.items)).toEqual([
      { lineNumber: 2, productName: "GORRA" },
    ]);
  });

  it("regalo de promoción (31): valor referencial = precio normal / 1.18, cobro 0, sin IGV", () => {
    const document = issue(order, GIFT_MODES.PROMOCION);
    const gift = document.items[1];

    expect(gift.taxType).toBe("31");
    expect(gift.unitPrice).toBe(0);
    expect(gift.subtotal).toBe(0);
    expect(gift.discountAmount).toBe(0);
    expect(gift.referenceUnitValue).toBeCloseTo(25.4237, 4);
    expect(getGiftNormalUnitPrice(gift)).toBe(30);
    expect(findLinesWithoutValue(document.items)).toEqual([]);
    expect(getCompanyPaidGiftIgv(document.items)).toBe(0);
    expect(document.totals).toMatchObject({ subtotal: 84.75, taxTotal: 15.25, grandTotal: 100 });
  });

  it("regalo aparte (13): la empresa paga S/ 4.58 de IGV; el cliente paga lo mismo", () => {
    const document = issue(order, GIFT_MODES.APARTE);

    expect(document.items[1].taxType).toBe("13");
    expect(getCompanyPaidGiftIgv(document.items)).toBe(4.58);
    expect(document.totals.grandTotal).toBe(100);
    expect(document.totals.taxTotal).toBe(15.25);
  });

  it("envía referenceUnitValue solo en el regalo y nunca el dato de pantalla giftOrigin", () => {
    const request = requestOf(issue(order, GIFT_MODES.APARTE));

    expect(request.items[0]).not.toHaveProperty("referenceUnitValue");
    expect(request.items[1].referenceUnitValue).toBeCloseTo(25.4237, 4);
    expect(request.items[1]).not.toHaveProperty("giftOrigin");
  });

  it("volver a «no es regalo» restaura la línea y no manda valor referencial", () => {
    const document = issue(order, GIFT_MODES.APARTE);
    const back = applyGiftMode(document.items, GIFT_MODES.NONE);
    const request = toCreateSunatDocumentsRequestDto({ documents: [{ ...document, items: back }] })
      .documents[0];

    expect(back[1].taxType).toBe("10");
    expect(request.items[1]).not.toHaveProperty("referenceUnitValue");
  });

  it("ofrece 31 y 13 cuando hay una compra", () => {
    expect(getAllowedGiftModes(buildSunatDocumentFromSale(order).items)).toEqual(["31", "13"]);
  });
});

describe("línea con precio 0 sin precio normal", () => {
  const order = sale([polo, { sku: "LLAVERO", quantity: 2, unitPrice: 0 }]);

  it("pide el precio normal: nunca se emite con valor referencial 0", () => {
    const document = issue(order, GIFT_MODES.APARTE);

    expect(document.items[1].referenceUnitValue).toBeUndefined();
    expect(getGiftsWithoutPrice(document.items).map((item) => item.sku)).toEqual(["LLAVERO"]);
    expect(findLinesWithoutValue(document.items)).toEqual([
      { lineNumber: 2, productName: "LLAVERO" },
    ]);
  });

  it("con el precio normal escrito (S/ 11.80 c/u) ya se puede emitir", () => {
    const document = issue(order, GIFT_MODES.APARTE);
    document.items[1] = { ...document.items[1], referenceUnitValue: toReferenceUnitValue(11.8) };

    expect(getGiftsWithoutPrice(document.items)).toEqual([]);
    expect(findLinesWithoutValue(document.items)).toEqual([]);
    // 2 × 10.00 = 20.00 de valor; IGV 3.60 lo paga la empresa.
    expect(getCompanyPaidGiftIgv(document.items)).toBe(3.6);
  });
});

describe("línea con precio real y descuento del 100%", () => {
  const order = sale([polo, { sku: "MEDIAS", quantity: 1, unitPrice: 23.6, discountAmount: 23.6 }]);

  it("sin elegir: hoy bloquea igual que antes (3105)", () => {
    const document = issue(order, GIFT_MODES.NONE);

    expect(document.totals.discountTotal).toBe(20);
    expect(findLinesWithoutValue(document.items)).toEqual([
      { lineNumber: 2, productName: "MEDIAS" },
    ]);
  });

  it("como regalo: el precio real es el valor referencial y el descuento no va", () => {
    const document = issue(order, GIFT_MODES.PROMOCION);
    const gift = document.items[1];

    expect(gift.taxType).toBe("31");
    expect(gift.referenceUnitValue).toBeCloseTo(20, 6);
    expect(gift.discountAmount).toBe(0);
    expect(gift.unitPrice).toBe(0);
    expect(document.totals.discountTotal).toBe(0);
    expect(document.totals.grandTotal).toBe(100);
    expect(findLinesWithoutValue(document.items)).toEqual([]);
  });
});

describe("solo regalos (S/ 0.00)", () => {
  const order = sale([{ sku: "GORRA", quantity: 1, unitPrice: 0, isGift: true, giftValue: 30 }]);

  it("solo ofrece regalo aparte (13)", () => {
    expect(getAllowedGiftModes(buildSunatDocumentFromSale(order).items)).toEqual(["13"]);
  });

  it("total 0.00 y la empresa paga el IGV", () => {
    const document = issue(order, GIFT_MODES.APARTE);

    expect(document.totals.grandTotal).toBe(0);
    expect(getCompanyPaidGiftIgv(document.items)).toBe(4.58);
  });
});

describe("envío gratis (línea de envío con descuento igual a su precio)", () => {
  const order = sale([polo], { shippingTotal: 10, discountTotal: 10 } as Partial<Order>);

  it("no es un regalo: no se marca ni cambia con la opción elegida", () => {
    const document = issue(order, GIFT_MODES.APARTE);
    const delivery = document.items.find((item) => item.sku === "DELIVERY");

    expect(delivery?.taxType).toBe("10");
    expect(delivery?.giftOrigin).toBeUndefined();
    expect(getAllowedGiftModes(buildSunatDocumentFromSale(order).items)).toEqual(["31", "13"]);
  });

  it("sigue bloqueado como hoy (línea en S/ 0.00)", () => {
    expect(findLinesWithoutValue(issue(order, GIFT_MODES.NONE).items)).toEqual([
      { lineNumber: 2, productName: "Servicio de entrega" },
    ]);
  });
});

describe("nota de crédito de un comprobante con regalo", () => {
  const issued = issue(
    sale([polo, { sku: "GORRA", quantity: 1, unitPrice: 0, isGift: true, giftValue: 30 }]),
    GIFT_MODES.APARTE,
  );
  const original = {
    id: "doc-1",
    orderId: "order-1",
    taxDocumentType: "03",
    taxDocumentPayload: {
      customer: issued.customer,
      totals: issued.totals,
      items: requestOf(issued).items,
    },
  } as unknown as SunatDocument;

  it("anulación (01) copia el regalo con su valor referencial", () => {
    const request = buildCreditNoteRequest({
      original,
      series: "B001",
      reason: { code: "01", description: "Anulación" },
    });

    expect(request.items[1].taxType).toBe("13");
    expect(request.items[1].referenceUnitValue).toBeCloseTo(25.4237, 4);
    expect(request.totals.grandTotal).toBe(100);
  });

  it("descuento global (04) toma la afectación de la línea cobrada, aunque el regalo vaya primero", () => {
    const giftFirst = {
      ...original,
      taxDocumentPayload: {
        ...original.taxDocumentPayload,
        items: [...original.taxDocumentPayload.items].reverse(),
      },
    } as SunatDocument;
    const request = buildCreditNoteRequest({
      original: giftFirst,
      series: "B001",
      reason: { code: "04", description: "Descuento" },
      amount: 11.8,
    });

    expect(request.items[0].taxType).toBe("10");
    expect(request.totals.grandTotal).toBe(11.8);
  });
});
