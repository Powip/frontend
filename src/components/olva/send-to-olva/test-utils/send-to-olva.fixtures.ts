import type { OrderDetail, ShippingGuide } from "@/components/modals/GuideDetailsModal";
import { toOlvaAgency } from "@/features/olva/olva-agency/mappers/to-olva-agency";
import { buildOlvaAgencyResponse } from "@/features/olva/olva-agency/test-utils/olva-agency.fixtures";
import { toOlvaHeadquarter } from "@/features/olva/olva-catalog/mappers/to-olva-headquarter";
import { toOlvaUbigeo } from "@/features/olva/olva-catalog/mappers/to-olva-ubigeo";
import {
  buildOlvaHeadquarterResponse,
  buildOlvaUbigeoResponse,
} from "@/features/olva/olva-catalog/test-utils/olva-catalog.fixtures";
import { toOlvaSenderProfile } from "@/features/olva/olva-sender-profile/mappers/to-olva-sender-profile";
import { buildOlvaSenderProfileResponse } from "@/features/olva/olva-sender-profile/test-utils/olva-sender-profile.fixtures";
import { toOlvaBulkCreateShipmentsResult } from "@/features/olva/olva-shipment/mappers/to-olva-bulk-create-shipments-result";
import { toOlvaShipmentSummary } from "@/features/olva/olva-shipment/mappers/to-olva-shipment-summary";
import {
  buildBulkCreatedItemResponse,
  buildBulkFailedItemResponse,
  buildBulkNotSavedItemResponse,
  buildOlvaShipmentListItemResponse,
} from "@/features/olva/olva-shipment/test-utils/olva-shipment.fixtures";
import type { OlvaShipmentStatus } from "@/features/olva/shared/constants/olva-enums.constants";

export const GUIDE_ID = "guide-1";
export const COMPANY_ID = "company-1";

/** Only what the modal reads is filled in; the rest of the (huge) order shape is irrelevant here. */
export function buildOrderDetail(overrides: Partial<OrderDetail> = {}): OrderDetail {
  return {
    id: "order-1",
    companyId: COMPANY_ID,
    orderNumber: "PED-1001",
    status: "CONFIRMED",
    grandTotal: 120.5,
    customer: {
      fullName: "Juan Pérez",
      phoneNumber: "+51 999 888 777",
      province: "Lima",
      city: "Lima",
      district: "Miraflores",
      address: "Av. Larco 123",
      dni: "12345678",
    },
    payments: [],
    items: [
      { productName: "Polo", sku: "P-1", quantity: 2, unitPrice: 40 },
      { productName: "Gorra", sku: "G-1", quantity: 1, unitPrice: 40.5 },
    ],
    ...overrides,
  } as unknown as OrderDetail;
}

export function buildGuide(overrides: Partial<ShippingGuide> = {}): ShippingGuide {
  return {
    id: GUIDE_ID,
    guideNumber: "G-0001",
    storeId: "store-1",
    courierName: "Olva Courier",
    orderIds: ["order-1"],
    status: "APROBADA",
    ...overrides,
  } as ShippingGuide;
}

export const buildHeadquarter = () => toOlvaHeadquarter(buildOlvaHeadquarterResponse());

/** The ubigeo catalog as the API sends it: Lima's districts the test orders live in, plus one far away. */
export const buildUbigeoResponses = () =>
  [
    { ubigeo_code: "150122", ubigeo_id: "1501", district: "MIRAFLORES" },
    { ubigeo_code: "150131", ubigeo_id: "1502", district: "SAN ISIDRO" },
  ]
    .map((district) =>
      buildOlvaUbigeoResponse({
        ...district,
        department_code: "15",
        province_code: "01",
        district_code: district.ubigeo_code.slice(4),
        department: "LIMA",
        province: "LIMA",
      }),
    )
    .concat(buildOlvaUbigeoResponse());

export const buildUbigeos = () => buildUbigeoResponses().map(toOlvaUbigeo);

export const buildAgency = (overrides: Parameters<typeof buildOlvaAgencyResponse>[0] = {}) =>
  toOlvaAgency(buildOlvaAgencyResponse(overrides));

export const buildSenderProfile = (
  overrides: Parameters<typeof buildOlvaSenderProfileResponse>[0] = {},
) => toOlvaSenderProfile(buildOlvaSenderProfileResponse({ isDefault: true, ...overrides }));

export const buildShipmentSummary = (orderId: string, status: OlvaShipmentStatus = "REGISTERED") =>
  toOlvaShipmentSummary(
    buildOlvaShipmentListItemResponse({
      id: `ship-${orderId}`,
      status,
      externalRef: { orderId, guideId: GUIDE_ID },
    }),
  );

export function buildBulkResult(
  items: { key: string; status: "created" | "failed" | "registered_not_saved"; code?: string }[],
) {
  const results = items.map(({ key, status, code }) => {
    if (status === "created") return buildBulkCreatedItemResponse(key);
    if (status === "registered_not_saved") return buildBulkNotSavedItemResponse(key);

    return buildBulkFailedItemResponse(key, code);
  });

  return toOlvaBulkCreateShipmentsResult({
    summary: {
      total: results.length,
      created: results.filter((result) => result.status === "created").length,
      registeredNotSaved: results.filter((result) => result.status === "registered_not_saved")
        .length,
      failed: results.filter((result) => result.status === "failed").length,
    },
    results,
  });
}
