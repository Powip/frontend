import type {
  BulkCreateOlvaShipmentsResponseDto,
  OlvaBulkShipmentItemResponseDto,
} from "../dto/bulk-create-olva-shipments-response.dto";
import type {
  CreateOlvaShipmentResponseDto,
  OlvaShipmentListItemResponseDto,
  OlvaShipmentResponseDto,
} from "../dto/olva-shipment-response.dto";
import type { BulkOlvaShipmentItemInput } from "../models/bulk-create-olva-shipments-input";
import type { CreateOlvaShipmentInput } from "../models/create-olva-shipment-input";

export function buildOlvaShipmentListItemResponse(
  overrides: Partial<OlvaShipmentListItemResponseDto> = {},
): OlvaShipmentListItemResponseDto {
  return {
    id: "0b1f6a52-5d0e-4c8b-9c5e-3a1d2e4f5a6b",
    internalId: "INT-1",
    trackingNumber: "123456789012",
    registrationNumber: "REG-1",
    status: "REGISTERED",
    cost: 12.5,
    igv: 2.25,
    senderEmail: "tienda@example.com",
    senderProfileId: null,
    senderDocumentNumber: "20123456789",
    recipientEmail: "cliente@example.com",
    whoPays: "ONLINE",
    deliveryType: "D",
    externalRef: { orderId: "PED-1001", guideId: null },
    createdAt: "2026-10-20T15:00:00.000Z",
    updatedAt: "2026-10-21T10:30:00.000Z",
    ...overrides,
  };
}

export function buildOlvaShipmentResponse(
  overrides: Partial<OlvaShipmentResponseDto> = {},
): OlvaShipmentResponseDto {
  return {
    ...buildOlvaShipmentListItemResponse(),
    securityPin: "1234",
    payment: null,
    ...overrides,
  };
}

export function buildCreateOlvaShipmentResponse(
  overrides: Partial<CreateOlvaShipmentResponseDto> = {},
): CreateOlvaShipmentResponseDto {
  return {
    ...buildOlvaShipmentResponse(),
    label: { filename: "guia.pdf", mimeType: "application/pdf", pdfBase64: "JVBERg==" },
    ...overrides,
  };
}

const RECIPIENT_INPUT = {
  documentNumber: "12345678",
  documentType: "dni",
  fullName: "Juan Pérez",
  phone: "999888777",
  email: "",
} as const;

/** A store pickup, paid online with a card. */
export function buildCreateOlvaShipmentInput(
  overrides: Partial<CreateOlvaShipmentInput> = {},
): CreateOlvaShipmentInput {
  return {
    recipient: { ...RECIPIENT_INPUT },
    origin: { headquarterId: "12", address: "  " },
    destination: { agencyCode: "LIM01" },
    externalRef: { orderId: "PED-1001", guideId: "" },
    package: { weightKg: 1.5, description: "", declaredValue: 80 },
    whoPays: "ONLINE",
    deliveryType: "O",
    paymentMethod: "niubiz",
    ...overrides,
  } as CreateOlvaShipmentInput;
}

/** A home delivery: a ubigeo from the catalog instead of an agency, always paid online. */
export function buildCreateOlvaHomeDeliveryInput(
  overrides: Partial<CreateOlvaShipmentInput> = {},
): CreateOlvaShipmentInput {
  return {
    recipient: { ...RECIPIENT_INPUT },
    origin: { headquarterId: "12", address: "  " },
    destination: {
      ubigeoCode: "250202",
      address: "Av. Siempre Viva 742",
      reference: "Frente al parque",
    },
    externalRef: { orderId: "PED-1001", guideId: "" },
    package: { weightKg: 1.5, description: "", declaredValue: 80 },
    whoPays: "ONLINE",
    deliveryType: "D",
    paymentMethod: "niubiz",
    ...overrides,
  } as CreateOlvaShipmentInput;
}

export function buildBulkOlvaShipmentItemInput(
  itemKey: string,
  overrides: Partial<BulkOlvaShipmentItemInput> = {},
): BulkOlvaShipmentItemInput {
  return {
    ...buildCreateOlvaShipmentInput({ externalRef: { orderId: itemKey } }),
    itemKey,
    ...overrides,
  } as BulkOlvaShipmentItemInput;
}

const LABEL = { filename: "guia.pdf", mimeType: "application/pdf", pdfBase64: "JVBERg==" };

export function buildBulkCreatedItemResponse(itemKey: string): OlvaBulkShipmentItemResponseDto {
  return {
    itemKey,
    status: "created",
    shipment: buildOlvaShipmentResponse({
      id: `id-${itemKey}`,
      externalRef: { orderId: itemKey, guideId: null },
    }),
    label: LABEL,
    registeredInOlva: null,
    error: null,
  };
}

export function buildBulkNotSavedItemResponse(itemKey: string): OlvaBulkShipmentItemResponseDto {
  return {
    itemKey,
    status: "registered_not_saved",
    shipment: null,
    label: LABEL,
    registeredInOlva: {
      id: "olva-9",
      registrationNumber: "REG-9",
      trackingNumber: "999999999999",
      status: "PENDING_PAYMENT",
      cost: 10,
      igv: null,
      payment: {
        method: "niubiz",
        sessionKey: "session-1",
        merchantId: "merchant-1",
        checkoutScriptUrl: "https://checkout.test/niubiz.js",
        expiresAt: "2026-10-30T00:00:00.000Z",
      },
    },
    error: { code: "SHIPMENT_NOT_PERSISTED", message: "No se pudo guardar" },
  };
}

export function buildBulkFailedItemResponse(
  itemKey: string,
  code = "SHIPMENT_REJECTED_BY_OLVA",
  shipment: OlvaShipmentResponseDto | null = null,
): OlvaBulkShipmentItemResponseDto {
  return {
    itemKey,
    status: "failed",
    shipment,
    label: null,
    registeredInOlva: null,
    error: { code, message: "Rechazado" },
  };
}

export function buildBulkCreateShipmentsResponse(
  results: OlvaBulkShipmentItemResponseDto[],
): BulkCreateOlvaShipmentsResponseDto {
  const count = (status: string) => results.filter((r) => r.status === status).length;

  return {
    summary: {
      total: results.length,
      created: count("created"),
      registeredNotSaved: count("registered_not_saved"),
      failed: count("failed"),
    },
    results,
  };
}
