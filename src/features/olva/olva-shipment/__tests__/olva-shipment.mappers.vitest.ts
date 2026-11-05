import { describe, expect, it } from "vitest";
import { toCreateOlvaShipmentRequestDto } from "../mappers/to-create-olva-shipment-request.dto";
import { toListOlvaShipmentsQueryDto } from "../mappers/to-list-olva-shipments-query.dto";
import { toOlvaCreatedShipment } from "../mappers/to-olva-created-shipment";
import { toOlvaShipment } from "../mappers/to-olva-shipment";
import { toOlvaShipmentsPage } from "../mappers/to-olva-shipments-page";
import type { CreateOlvaShipmentInput } from "../models/create-olva-shipment-input";
import {
  buildCreateOlvaHomeDeliveryInput,
  buildCreateOlvaShipmentInput,
  buildCreateOlvaShipmentResponse,
  buildOlvaShipmentListItemResponse,
  buildOlvaShipmentResponse,
} from "../test-utils/olva-shipment.fixtures";

const buildHomeDestination = () => ({
  ubigeoCode: "250202",
  address: "Av. Siempre Viva 742",
  reference: "Frente al parque",
});

describe("olva-shipment mappers", () => {
  it("drops blank and undefined optionals from the request body", () => {
    const dto = toCreateOlvaShipmentRequestDto(buildCreateOlvaShipmentInput());

    expect(dto).toEqual({
      whoPays: "ONLINE",
      deliveryType: "O",
      paymentMethod: "niubiz",
      recipient: {
        documentNumber: "12345678",
        documentType: "dni",
        fullName: "Juan Pérez",
        phone: "999888777",
      },
      origin: { headquarterId: "12" },
      destination: { agencyCode: "LIM01" },
      package: { weightKg: 1.5, declaredValue: 80 },
      externalRef: { orderId: "PED-1001" },
    });
    expect(dto).not.toHaveProperty("sender");
  });

  it("sends a home delivery to its ubigeo, address and reference, with no agency or PIN", () => {
    const dto = toCreateOlvaShipmentRequestDto(buildCreateOlvaHomeDeliveryInput());

    expect(dto).toEqual({
      whoPays: "ONLINE",
      deliveryType: "D",
      paymentMethod: "niubiz",
      recipient: {
        documentNumber: "12345678",
        documentType: "dni",
        fullName: "Juan Pérez",
        phone: "999888777",
      },
      origin: { headquarterId: "12" },
      destination: {
        ubigeoCode: "250202",
        address: "Av. Siempre Viva 742",
        reference: "Frente al parque",
      },
      package: { weightKg: 1.5, declaredValue: 80 },
      externalRef: { orderId: "PED-1001" },
    });
    expect(dto).not.toHaveProperty("pin");
    expect(dto.destination).not.toHaveProperty("agencyCode");
  });

  it("never copies the fields of the other delivery type, even if the form still holds them", () => {
    const stalePickup = {
      ...buildCreateOlvaShipmentInput(),
      destination: {
        agencyCode: "LIM01",
        ubigeoCode: "250202",
        address: "Av. 1",
        reference: "abc",
      },
    } as unknown as CreateOlvaShipmentInput;
    const staleHome = {
      ...buildCreateOlvaHomeDeliveryInput(),
      pin: "1234",
      destination: { ...buildHomeDestination(), agencyCode: "LIM01" },
    } as unknown as CreateOlvaShipmentInput;

    expect(toCreateOlvaShipmentRequestDto(stalePickup).destination).toEqual({
      agencyCode: "LIM01",
    });
    expect(toCreateOlvaShipmentRequestDto(staleHome).destination).toEqual(buildHomeDestination());
    expect(toCreateOlvaShipmentRequestDto(staleHome)).not.toHaveProperty("pin");
  });

  it("keeps the PIN and the pay mode of a store pickup", () => {
    const dto = toCreateOlvaShipmentRequestDto(
      buildCreateOlvaShipmentInput({ whoPays: "STORE", paymentMethod: undefined, pin: " 1234 " }),
    );

    expect(dto.pin).toBe("1234");
    expect(dto.whoPays).toBe("STORE");
    expect(dto).not.toHaveProperty("paymentMethod");
  });

  it("keeps each payment variant with its own fields", () => {
    const niubiz = toOlvaShipment(
      buildOlvaShipmentResponse({
        payment: {
          method: "niubiz",
          sessionKey: "session-1",
          merchantId: "merchant-1",
          checkoutScriptUrl: "https://checkout.test/niubiz.js",
          expiresAt: "2026-10-22T00:00:00.000Z",
        },
      }),
    );
    const pagoEfectivo = toOlvaShipment(
      buildOlvaShipmentResponse({
        payment: { method: "pagoefectivo", cipCode: "123", qrImage: "data:image/png;base64,AA==" },
      }),
    );

    expect(niubiz.payment).toEqual({
      method: "niubiz",
      sessionKey: "session-1",
      merchantId: "merchant-1",
      checkoutScriptUrl: "https://checkout.test/niubiz.js",
      expiresAt: new Date("2026-10-22T00:00:00.000Z"),
    });
    expect(pagoEfectivo.payment).toEqual({
      method: "pagoefectivo",
      cipCode: "123",
      qrImage: "data:image/png;base64,AA==",
    });
  });

  it("keeps false booleans and zero-like values that are meaningful", () => {
    const dto = toCreateOlvaShipmentRequestDto(
      buildCreateOlvaShipmentInput({
        confirm: false,
        package: { weightKg: 1, declaredValue: 50, insuranceAccepted: false },
      }),
    );

    expect(dto.confirm).toBe(false);
    expect(dto.package.insuranceAccepted).toBe(false);
  });

  it("converts ISO dates to Date and maps the payment", () => {
    const shipment = toOlvaShipment(
      buildOlvaShipmentResponse({
        payment: {
          method: "pagoefectivo",
          cipCode: "123",
          expiresAt: "2026-10-22T00:00:00.000Z",
          paid: false,
        },
      }),
    );

    expect(shipment.createdAt).toEqual(new Date("2026-10-20T15:00:00.000Z"));
    expect(shipment.payment?.expiresAt).toEqual(new Date("2026-10-22T00:00:00.000Z"));
    expect(shipment.payment?.checkedAt).toBeUndefined();
    expect(shipment.payment?.paid).toBe(false);
  });

  it("keeps the label only on a created shipment", () => {
    expect(toOlvaCreatedShipment(buildCreateOlvaShipmentResponse()).label?.filename).toBe(
      "guia.pdf",
    );
    expect(
      toOlvaCreatedShipment(buildCreateOlvaShipmentResponse({ label: undefined })),
    ).not.toHaveProperty("label");
  });

  it("maps the page: `data` -> `items`", () => {
    const page = toOlvaShipmentsPage({
      data: [buildOlvaShipmentListItemResponse()],
      meta: { page: 2, limit: 20, total: 21, totalPages: 2 },
    });

    expect(page.items).toHaveLength(1);
    expect(page.items[0]).not.toHaveProperty("securityPin");
    expect(page).toMatchObject({ page: 2, limit: 20, total: 21, totalPages: 2 });
  });

  it("builds the list query without blank filters, order and guide included", () => {
    expect(
      toListOlvaShipmentsQueryDto({
        page: 1,
        q: "  ",
        status: "DELIVERED",
        orderId: " PED-1 ",
        guideId: "",
      }),
    ).toEqual({ page: 1, status: "DELIVERED", orderId: "PED-1" });
  });

  it("maps the order reference, null when there is none", () => {
    expect(toOlvaShipment(buildOlvaShipmentResponse()).externalRef).toEqual({
      orderId: "PED-1001",
      guideId: null,
    });
    expect(
      toOlvaShipmentsPage({
        data: [buildOlvaShipmentListItemResponse({ externalRef: null })],
        meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
      }).items[0].externalRef,
    ).toBeNull();
  });

  it("sends no externalRef without an order id", () => {
    const dto = toCreateOlvaShipmentRequestDto(
      buildCreateOlvaShipmentInput({ externalRef: { orderId: "  ", guideId: "G1" } }),
    );

    expect(dto).not.toHaveProperty("externalRef");
  });
});
