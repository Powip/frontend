import { describe, expect, it, vi } from "vitest";
import { toOlvaStandardSize } from "@/features/olva/olva-catalog/mappers/to-olva-standard-size";
import type { OlvaHeadquarter } from "@/features/olva/olva-catalog/models/olva-headquarter";
import { buildOlvaStandardSizesResponse } from "@/features/olva/olva-catalog/test-utils/olva-catalog.fixtures";
import { bulkCreateOlvaShipmentsSchema } from "@/features/olva/olva-shipment/schemas/olva-bulk-shipments.schema";
import { isOlvaCourier } from "@/utils/courierNormalizer";
import {
  buildBulkResult,
  buildOrderDetail,
  buildShipmentSummary,
} from "../test-utils/send-to-olva.fixtures";
import { buildOlvaFormDefaults } from "../utils/build-olva-form-defaults";
import { buildOlvaPackageDescription } from "../utils/build-olva-package-description";
import { buildOlvaQuoteInput, getOlvaDestinationUbigeo } from "../utils/build-olva-quote-input";
import { buildOlvaTrackingWhatsAppUrl } from "../utils/build-olva-tracking-whatsapp-url";
import { buildSendToOlvaSchema } from "../utils/build-send-to-olva-schema";
import { deriveOlvaLotPayer, hasOlvaPayerForEveryRow } from "../utils/derive-olva-lot-payer";
import { findOlvaDivisionName } from "../utils/find-olva-division-name";
import { getOlvaActiveShipmentsByOrder } from "../utils/get-olva-active-shipments-by-order";
import { getOlvaDocumentType } from "../utils/get-olva-document-type";
import { getOlvaResultsCost } from "../utils/get-olva-results-cost";
import { getOlvaUnresolvedItemKeys } from "../utils/get-olva-unresolved-item-keys";
import { mergeOlvaBulkResults } from "../utils/merge-olva-bulk-results";
import { normalizeOlvaPhone } from "../utils/normalize-olva-phone";
import {
  getDefaultOlvaHomePaymentMethod,
  getOlvaOnlinePaymentMethods,
  isOlvaPaymentMethodAvailable,
} from "../utils/olva-payment-methods";
import { orderToOlvaFormItem } from "../utils/order-to-olva-form-item";
import { planOlvaDeliveryTypeSwitch } from "../utils/plan-olva-delivery-type-switch";
import { toOlvaBulkInput } from "../utils/to-olva-bulk-input";

// Online payment is switched off by default; these tests cover the online helpers, so turn it on
vi.mock("../constants/send-to-olva.constants", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../constants/send-to-olva.constants")>()),
  SEND_TO_OLVA_ONLINE_PAYMENT_AVAILABLE: true,
}));

describe("orderToOlvaFormItem", () => {
  it("preloads the recipient, address, package and order reference from the order", () => {
    const item = orderToOlvaFormItem(buildOrderDetail(), { guideId: "g-1", headquarterId: "12" });

    expect(item).toMatchObject({
      itemKey: "order-1",
      recipient: {
        documentType: "dni",
        documentNumber: "12345678",
        fullName: "Juan Pérez",
        phone: "999888777",
      },
      origin: { headquarterId: "12" },
      destination: { agencyCode: "", address: "Av. Larco 123" },
      package: { weightKg: "1", declaredValue: "120.5", description: "2x Polo, 1x Gorra" },
      deliveryType: "O",
      externalRef: { orderId: "order-1", guideId: "g-1" },
    });
  });

  it("leaves blanks as empty text so the inputs stay controlled", () => {
    const item = orderToOlvaFormItem(
      buildOrderDetail({ grandTotal: 0, customer: { fullName: "Ana", phoneNumber: "" } as never }),
    );

    expect(item.package.declaredValue).toBe("");
    expect(item.recipient.documentNumber).toBe("");
    expect(item.destination.address).toBe("");
  });
});

describe("buildOlvaFormDefaults", () => {
  it("builds a lot of at most 25 orders", () => {
    const orders = Array.from({ length: 30 }, (_, i) => buildOrderDetail({ id: `o-${i}` }));

    expect(buildOlvaFormDefaults(orders).items).toHaveLength(25);
  });

  it("produces rows the lot schema accepts once the user fills what cannot be guessed", () => {
    const defaults = buildOlvaFormDefaults([buildOrderDetail()], { guideId: "g-1" });
    const [item] = defaults.items;

    const parsed = bulkCreateOlvaShipmentsSchema.safeParse({
      items: [
        {
          ...item,
          origin: { headquarterId: "12" },
          destination: { ...item.destination, agencyCode: "LIM01" },
          whoPays: "STORE",
        },
      ],
    });

    expect(parsed.success).toBe(true);
    expect(parsed.data?.items[0]).toMatchObject({
      itemKey: "order-1",
      package: { weightKg: 1, declaredValue: 120.5 },
      externalRef: { orderId: "order-1", guideId: "g-1" },
    });
  });

  it("is rejected until an agency is chosen", () => {
    const defaults = buildOlvaFormDefaults([buildOrderDetail()]);
    const parsed = bulkCreateOlvaShipmentsSchema.safeParse(defaults);

    expect(parsed.success).toBe(false);
  });
});

describe("recipient helpers", () => {
  it("tells a RUC from a DNI by its length", () => {
    expect(getOlvaDocumentType("20123456789")).toBe("ruc");
    expect(getOlvaDocumentType("12345678")).toBe("dni");
    expect(getOlvaDocumentType(undefined)).toBe("dni");
  });

  it("drops the Peruvian country code from a phone", () => {
    expect(normalizeOlvaPhone("+51 999 888 777")).toBe("999888777");
    expect(normalizeOlvaPhone("999888777")).toBe("999888777");
    expect(normalizeOlvaPhone(null)).toBe("");
  });

  it("describes the package from the order items and cuts long lists", () => {
    expect(buildOlvaPackageDescription([{ quantity: 2, productName: "Polo" }])).toBe("2x Polo");

    const many = Array.from({ length: 40 }, (_, i) => ({
      quantity: 1,
      productName: `Producto ${i}`,
    }));
    const text = buildOlvaPackageDescription(many);

    expect(text.length).toBeLessThanOrEqual(150);
    expect(text.endsWith("…")).toBe(true);
  });
});

describe("findOlvaDivisionName", () => {
  const divisions = [
    { name: "LIMA", agencyCount: 10 },
    { name: "ÁNCASH", agencyCount: 3 },
    { name: "LIMA METROPOLITANA", agencyCount: 5 },
  ];

  it("matches ignoring case and accents", () => {
    expect(findOlvaDivisionName(["ancash"], divisions)).toBe("ÁNCASH");
  });

  it("prefers an exact match over a containment one", () => {
    expect(findOlvaDivisionName(["Lima"], divisions)).toBe("LIMA");
  });

  it("tries the next candidate and returns blank when nothing matches", () => {
    expect(findOlvaDivisionName([undefined, "Ancash"], divisions)).toBe("ÁNCASH");
    expect(findOlvaDivisionName(["Cusco"], divisions)).toBe("");
  });
});

describe("buildOlvaQuoteInput", () => {
  const headquarter = { ubigeoCode: "150122" };
  const destinationUbigeo = "150101";
  const box = { lengthCm: 20, widthCm: 15, heightCm: 10 };
  const envelope = { lengthCm: null, widthCm: null, heightCm: null };

  it("builds the request for a parcel with the measures of its size", () => {
    expect(
      buildOlvaQuoteInput({
        headquarter,
        destinationUbigeo,
        deliveryType: "D",
        weightKg: "1.5",
        size: box,
      }),
    ).toEqual({
      originUbigeo: "150122",
      destinationUbigeo: "150101",
      deliveryType: "D",
      shipmentType: 2,
      weightKg: 1.5,
      lengthCm: 20,
      widthCm: 15,
      heightCm: 10,
    });
  });

  it("prices the envelope as a document, without measures", () => {
    const input = buildOlvaQuoteInput({
      headquarter,
      destinationUbigeo,
      deliveryType: "O",
      weightKg: 0.2,
      size: envelope,
    });

    expect(input).toEqual({
      originUbigeo: "150122",
      destinationUbigeo: "150101",
      deliveryType: "O",
      shipmentType: 1,
      weightKg: 0.2,
    });
  });

  it.each([
    ["no headquarter", { headquarter: undefined, destinationUbigeo, weightKg: 1, size: box }],
    ["no destination", { headquarter, destinationUbigeo: undefined, weightKg: 1, size: box }],
    ["no size", { headquarter, destinationUbigeo, weightKg: 1, size: undefined }],
    ["blank weight", { headquarter, destinationUbigeo, weightKg: "", size: box }],
    ["zero weight", { headquarter, destinationUbigeo, weightKg: 0, size: box }],
    [
      "a size with only some measures",
      { headquarter, destinationUbigeo, weightKg: 1, size: { ...box, heightCm: null } },
    ],
  ])("is idle with %s", (_name, params) => {
    expect(buildOlvaQuoteInput({ deliveryType: "O", ...params })).toBeNull();
  });
});

describe("getOlvaDestinationUbigeo", () => {
  const agency = { ubigeo: "150101" };

  it("prices a home delivery from the district the user picked, ignoring any agency", () => {
    expect(getOlvaDestinationUbigeo({ deliveryType: "D", ubigeoCode: "250202", agency })).toBe(
      "250202",
    );
  });

  it("prices a store pickup from the agency's own ubigeo", () => {
    expect(getOlvaDestinationUbigeo({ deliveryType: "O", ubigeoCode: "250202", agency })).toBe(
      "150101",
    );
  });

  it("stays unknown while the district is missing or incomplete", () => {
    expect(getOlvaDestinationUbigeo({ deliveryType: "D", ubigeoCode: "", agency })).toBeUndefined();
    expect(
      getOlvaDestinationUbigeo({ deliveryType: "D", ubigeoCode: "2502", agency }),
    ).toBeUndefined();
  });

  it("stays unknown for a pickup without its agency", () => {
    expect(
      getOlvaDestinationUbigeo({ deliveryType: "O", ubigeoCode: undefined, agency: undefined }),
    ).toBeUndefined();
  });
});

describe("deriveOlvaLotPayer / hasOlvaPayerForEveryRow", () => {
  const pickup = { deliveryType: "O", whoPays: "DESTINATION" } as const;
  const home = { deliveryType: "D", whoPays: "ONLINE", paymentMethod: "niubiz" } as const;

  it("reads the payer from the first pickup row, skipping home deliveries", () => {
    expect(deriveOlvaLotPayer([home, pickup])).toEqual({
      index: 1,
      whoPays: "DESTINATION",
      paymentMethod: undefined,
    });
  });

  it("has no lot payer when every row is a home delivery", () => {
    expect(deriveOlvaLotPayer([home, home])).toBeUndefined();
    expect(deriveOlvaLotPayer([])).toBeUndefined();
  });

  it("only asks pickups for a payer: home rows bring their own", () => {
    expect(hasOlvaPayerForEveryRow([home, { deliveryType: "O" }])).toBe(false);
    expect(hasOlvaPayerForEveryRow([home, pickup])).toBe(true);
    expect(hasOlvaPayerForEveryRow([home])).toBe(true);
  });
});

describe("planOlvaDeliveryTypeSwitch", () => {
  const base = {
    lotPayer: { whoPays: "DESTINATION", paymentMethod: undefined },
    homePaymentMethod: "niubiz",
    currentAddress: "",
    customerAddress: "Av. Larco 123",
  } as const;

  const resetValue = (plan: ReturnType<typeof planOlvaDeliveryTypeSwitch>, field: string) =>
    plan.resets.find((reset) => reset.field === field)?.value;

  it("to home: drops agency and PIN, pays online with the default method and brings the address back", () => {
    const plan = planOlvaDeliveryTypeSwitch({ ...base, next: "D" });

    expect(resetValue(plan, "pin")).toBe("");
    expect(resetValue(plan, "destination.agencyCode")).toBe("");
    expect(resetValue(plan, "whoPays")).toBe("ONLINE");
    expect(resetValue(plan, "paymentMethod")).toBe("niubiz");
    expect(resetValue(plan, "destination.address")).toBe("Av. Larco 123");
  });

  it("to home: keeps an address the user already typed", () => {
    const plan = planOlvaDeliveryTypeSwitch({ ...base, next: "D", currentAddress: "Jr. Lima 1" });

    expect(plan.resets.some((reset) => reset.field === "destination.address")).toBe(false);
  });

  it("to pickup: drops the ubigeo and takes the lot payer again", () => {
    const plan = planOlvaDeliveryTypeSwitch({ ...base, next: "O" });

    expect(resetValue(plan, "destination.ubigeoCode")).toBe("");
    expect(resetValue(plan, "whoPays")).toBe("DESTINATION");
    expect(resetValue(plan, "paymentMethod")).toBeUndefined();
    expect(plan.clearErrors).toContain("destination.ubigeoCode");
  });
});

describe("Olva payment methods", () => {
  const headquarter: Pick<OlvaHeadquarter, "paymentModalities"> = {
    paymentModalities: [
      {
        code: "ONLINE",
        title: "Pago en línea",
        description: "",
        sortOrder: 1,
        requiresPaymentMethod: true,
        paymentMethods: [
          { code: "pagoefectivo", title: "PagoEfectivo", methodId: 1 },
          { code: "niubiz", title: "Tarjeta", methodId: 2 },
        ],
      },
    ],
  };

  it("does not offer PagoEfectivo while its provider is down", () => {
    expect(getOlvaOnlinePaymentMethods(headquarter).map((method) => method.code)).toEqual([
      "niubiz",
    ]);
    expect(isOlvaPaymentMethodAvailable("pagoefectivo")).toBe(false);
  });

  it("starts a home delivery on the only usable method", () => {
    expect(getDefaultOlvaHomePaymentMethod(headquarter)).toBe("niubiz");
    expect(getDefaultOlvaHomePaymentMethod(undefined)).toBeUndefined();
  });
});

describe("buildSendToOlvaSchema", () => {
  const sizes = buildOlvaStandardSizesResponse().map(toOlvaStandardSize);

  const lotWith = (pkg: { sizeId?: string; weightKg: string }) => {
    const [item] = buildOlvaFormDefaults([buildOrderDetail()], { guideId: "g-1" }).items;

    return {
      items: [
        {
          ...item,
          origin: { headquarterId: "12" },
          destination: { ...item.destination, agencyCode: "LIM01" },
          package: { ...item.package, ...pkg },
          whoPays: "STORE",
        },
      ],
    };
  };

  it("accepts a weight that fits the size (or any size, on automatic)", () => {
    const schema = buildSendToOlvaSchema(sizes);

    expect(schema.safeParse(lotWith({ sizeId: "small", weightKg: "2" })).success).toBe(true);
    expect(schema.safeParse(lotWith({ sizeId: "", weightKg: "1" })).success).toBe(true);
  });

  it("points at the weight field when it is above the size maximum", () => {
    const parsed = buildSendToOlvaSchema(sizes).safeParse(
      lotWith({ sizeId: "extra-small", weightKg: "1" }),
    );

    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues[0]).toMatchObject({
      path: ["items", 0, "package", "weightKg"],
      message: expect.stringContaining("XXS admite hasta 0.5 kg"),
    });
  });

  it("rejects a weight no size supports", () => {
    const parsed = buildSendToOlvaSchema(sizes).safeParse(lotWith({ sizeId: "", weightKg: "6" }));

    expect(parsed.error?.issues[0]?.message).toBe("Olva admite hasta 5 kg por paquete.");
  });

  it("lets Olva decide when the size catalog did not load", () => {
    const parsed = buildSendToOlvaSchema([]).safeParse(
      lotWith({ sizeId: "extra-small", weightKg: "9" }),
    );

    expect(parsed.success).toBe(true);
  });
});

describe("lot results", () => {
  it("keeps one result per order across retries, the newest winning", () => {
    const first = buildBulkResult([
      { key: "a", status: "created" },
      { key: "b", status: "failed" },
    ]).results;
    const retry = buildBulkResult([{ key: "b", status: "created" }]).results;
    const merged = mergeOlvaBulkResults(first, retry);

    expect(merged.map((result) => [result.itemKey, result.status])).toEqual([
      ["a", "created"],
      ["b", "created"],
    ]);
  });

  it("keeps in the form only what can still be sent", () => {
    const { results } = buildBulkResult([
      { key: "created", status: "created" },
      { key: "notSaved", status: "registered_not_saved" },
      { key: "taken", status: "failed", code: "SHIPMENT_ALREADY_EXISTS" },
      { key: "rejected", status: "failed" },
    ]);

    expect(
      getOlvaUnresolvedItemKeys(["created", "notSaved", "taken", "rejected", "unsent"], results),
    ).toEqual(["rejected", "unsent"]);
  });

  it("adds up the real cost of what Olva registered", () => {
    const { results } = buildBulkResult([
      { key: "a", status: "created" },
      { key: "b", status: "registered_not_saved" },
      { key: "c", status: "failed" },
    ]);

    // created: 12.5, registered_not_saved: 10, failed: nothing
    expect(getOlvaResultsCost(results)).toBe(22.5);
  });

  it("sends the form as it is, without an unset sender", () => {
    const parsed = bulkCreateOlvaShipmentsSchema.parse({
      items: [
        {
          ...buildOlvaFormDefaults([buildOrderDetail()]).items[0],
          origin: { headquarterId: "12" },
          destination: { agencyCode: "LIM01", address: "" },
        },
      ],
    });

    expect(toOlvaBulkInput(parsed)).not.toHaveProperty("senderProfileId");
    expect(
      toOlvaBulkInput({ ...parsed, senderProfileId: "8c4f1b8e-0d3a-4c3e-9d57-2f1d6a1b7c11" }),
    ).toHaveProperty("senderProfileId");
  });
});

describe("getOlvaActiveShipmentsByOrder", () => {
  it("holds orders by their active shipment and releases the ones that no longer hold it", () => {
    const active = buildShipmentSummary("a");
    const released = buildShipmentSummary("b", "REJECTED");
    const map = getOlvaActiveShipmentsByOrder([active, released]);

    expect([...map.keys()]).toEqual(["a"]);
  });
});

describe("tracking message", () => {
  it("builds a WhatsApp link with the order, tracking number and public tracking page", () => {
    const url = buildOlvaTrackingWhatsAppUrl({
      customerName: "Juan",
      customerPhone: "999888777",
      orderNumber: "PED-1",
      trackingNumber: "123",
      landingUrl: "https://tienda.test",
    });
    const text = decodeURIComponent(new URL(url as string).searchParams.get("text") as string);

    expect(url).toContain("phone=51999888777");
    expect(text).toContain("PED-1");
    expect(text).toContain("123");
    expect(text).toContain("https://tienda.test/rastreo/PED-1");
  });

  it("has no link without a valid mobile", () => {
    expect(
      buildOlvaTrackingWhatsAppUrl({ customerPhone: "54325632", orderNumber: "PED-1" }),
    ).toBeNull();
  });
});

describe("isOlvaCourier", () => {
  it.each(["Olva Courier", "olva courier", " OLVA courier"])("recognizes %s", (name) => {
    expect(isOlvaCourier(name)).toBe(true);
  });

  it.each(["Shalom", "", null, undefined])("does not take %s for Olva", (name) => {
    expect(isOlvaCourier(name)).toBe(false);
  });
});
