import { delay, HttpResponse, http } from "msw";
import { buildUbigeoResponses } from "@/components/olva/send-to-olva/test-utils/send-to-olva.fixtures";
import { buildOlvaAgencyResponse } from "@/features/olva/olva-agency/test-utils/olva-agency.fixtures";
import {
  buildOlvaHeadquarterResponse,
  buildOlvaStandardSizesResponse,
} from "@/features/olva/olva-catalog/test-utils/olva-catalog.fixtures";
import { buildOlvaSenderProfileList } from "@/features/olva/olva-sender-profile/test-utils/olva-sender-profile.fixtures";
import type { OlvaBulkShipmentItemResponseDto } from "@/features/olva/olva-shipment/dto/bulk-create-olva-shipments-response.dto";
import {
  buildBulkCreatedItemResponse,
  buildBulkFailedItemResponse,
  buildBulkNotSavedItemResponse,
  buildOlvaShipmentListItemResponse,
} from "@/features/olva/olva-shipment/test-utils/olva-shipment.fixtures";

// Wildcard prefix so it matches whatever NEXT_PUBLIC_API_INTEGRATIONS resolves to
const OLVA = "*/olva";

type BulkResolver = (itemKey: string, index: number) => OlvaBulkShipmentItemResponseDto;

function summarize(results: OlvaBulkShipmentItemResponseDto[]) {
  const count = (status: OlvaBulkShipmentItemResponseDto["status"]) =>
    results.filter((result) => result.status === status).length;

  return {
    total: results.length,
    created: count("created"),
    registeredNotSaved: count("registered_not_saved"),
    failed: count("failed"),
  };
}

/** Answers a lot item by item, so any story can decide what happens to each order. */
function bulkHandler(resolve: BulkResolver) {
  return http.post(`${OLVA}/shipments/bulk`, async ({ request }) => {
    const { items } = (await request.json()) as { items: { itemKey: string }[] };

    await delay(300);

    const results = items.map((item, index) => resolve(item.itemKey, index));

    return HttpResponse.json({ summary: summarize(results), results });
  });
}

const division = (name: string) => ({ name, agencies: 5 });

/** Everything the modal reads before the user does anything: sender, origin, places and prices. */
const referenceData = [
  http.get(`${OLVA}/sender-profiles`, () =>
    HttpResponse.json({ results: buildOlvaSenderProfileList() }),
  ),
  http.get(`${OLVA}/catalog/headquarters`, () =>
    HttpResponse.json({ results: [buildOlvaHeadquarterResponse()] }),
  ),
  http.get(`${OLVA}/catalog/standard-sizes`, () =>
    HttpResponse.json({ results: buildOlvaStandardSizesResponse() }),
  ),
  http.get(`${OLVA}/catalog/ubigeos`, () => HttpResponse.json({ results: buildUbigeoResponses() })),
  http.get(`${OLVA}/catalog/article-categories`, () => HttpResponse.json({ results: [] })),
  http.get(`${OLVA}/agencies/departments/:department/provinces/:province/districts`, () =>
    HttpResponse.json({ results: [{ district: "MIRAFLORES", agencies: 5 }] }),
  ),
  http.get(`${OLVA}/agencies/departments/:department/provinces`, () =>
    HttpResponse.json({ results: [{ province: "LIMA", agencies: 5 }] }),
  ),
  http.get(`${OLVA}/agencies/departments`, () =>
    HttpResponse.json({ results: [{ department: division("LIMA").name, agencies: 5 }] }),
  ),
  http.get(`${OLVA}/agencies/:code`, () => HttpResponse.json(buildOlvaAgencyResponse())),
  http.get(`${OLVA}/agencies`, () => HttpResponse.json({ results: [buildOlvaAgencyResponse()] })),
  // Like Olva's calculator: a parcel (type 2) is refused without its measures
  http.post(`${OLVA}/quotes`, async ({ request }) => {
    const body = (await request.json()) as {
      shipmentType?: number;
      lengthCm?: number;
      widthCm?: number;
      heightCm?: number;
    };
    const missing = body.shipmentType === 2 && !(body.lengthCm && body.widthCm && body.heightCm);

    return missing
      ? HttpResponse.json({ message: "length, width and height are required" }, { status: 422 })
      : HttpResponse.json({ amount: 12.5, currency: "PEN", excessWeightKg: 0, deliveryType: "O" });
  }),
];

const shipmentsPage = (orderIds: string[]) =>
  http.get(`${OLVA}/shipments`, () =>
    HttpResponse.json({
      data: orderIds.map((orderId) =>
        buildOlvaShipmentListItemResponse({
          id: `ship-${orderId}`,
          trackingNumber: `TRK-${orderId}`,
          externalRef: { orderId, guideId: "guide-1" },
        }),
      ),
      meta: { page: 1, limit: 100, total: orderIds.length, totalPages: 1 },
    }),
  );

export const sendToOlvaHandlers = {
  /** A guide with nothing sent yet, and Olva accepting every order. */
  default: [
    ...referenceData,
    shipmentsPage([]),
    bulkHandler((key) => buildBulkCreatedItemResponse(key)),
  ],

  noSender: [
    http.get(`${OLVA}/sender-profiles`, () => HttpResponse.json({ results: [] })),
    ...referenceData,
    shipmentsPage([]),
  ],

  /** Orders of the guide that already hold an active Olva shipment. */
  withShipped: (orderIds: string[]) => [
    ...referenceData,
    shipmentsPage(orderIds),
    bulkHandler((key) => buildBulkCreatedItemResponse(key)),
  ],

  /** The first order is created; the second is rejected by Olva. */
  partialFailure: [
    ...referenceData,
    shipmentsPage([]),
    bulkHandler((key, index) =>
      index === 0 ? buildBulkCreatedItemResponse(key) : buildBulkFailedItemResponse(key),
    ),
  ],

  /** Olva registered the order but it could not be saved here: money may be charged. */
  registeredNotSaved: [
    ...referenceData,
    shipmentsPage([]),
    bulkHandler((key) => buildBulkNotSavedItemResponse(key)),
  ],

  /** The whole call fails (Olva down): nothing was registered, the form stays. */
  wholeCallFails: [
    ...referenceData,
    shipmentsPage([]),
    http.post(`${OLVA}/shipments/bulk`, () =>
      HttpResponse.json(
        {
          statusCode: 503,
          error: "Olva unavailable",
          source: "olva",
          details: { code: "OLVA_UPSTREAM_ERROR" },
        },
        { status: 503 },
      ),
    ),
  ],

  submitting: [
    ...referenceData,
    shipmentsPage([]),
    http.post(`${OLVA}/shipments/bulk`, () => delay("infinite")),
  ],
};
