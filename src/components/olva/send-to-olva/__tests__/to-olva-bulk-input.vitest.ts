import { describe, expect, it } from "vitest";
import { bulkCreateOlvaShipmentsSchema } from "@/features/olva/olva-shipment/schemas/olva-bulk-shipments.schema";
import { OLVA_DELIVERY_TYPES } from "@/features/olva/shared/constants/olva-enums.constants";
import { buildOrderDetail } from "../test-utils/send-to-olva.fixtures";
import { buildOlvaFormDefaults } from "../utils/build-olva-form-defaults";
import { toOlvaBulkInput } from "../utils/to-olva-bulk-input";

const SENDER_ID = "0b8f3d2a-5c1e-4f6a-9d3b-7e2a1c4b8f90";

const parseLot = (overrides: Record<string, unknown>, senderProfileId?: string) =>
  bulkCreateOlvaShipmentsSchema.parse({
    ...(senderProfileId ? { senderProfileId } : {}),
    items: [
      {
        ...buildOlvaFormDefaults([buildOrderDetail()]).items[0],
        origin: { headquarterId: "12" },
        ...overrides,
      },
    ],
  });

describe("toOlvaBulkInput delivery type", () => {
  it("sends a home delivery to its ubigeo, address and reference, paid online, without agency or PIN", () => {
    const parsed = parseLot({
      deliveryType: OLVA_DELIVERY_TYPES.HOME_DELIVERY,
      whoPays: "ONLINE",
      paymentMethod: "niubiz",
      destination: {
        agencyCode: "",
        ubigeoCode: "250202",
        address: "Jr. Las Getias 170",
        reference: "Frente al parque",
      },
    });
    const [item] = toOlvaBulkInput(parsed).items;

    expect(item.deliveryType).toBe("D");
    expect(item.destination).toEqual({
      ubigeoCode: "250202",
      address: "Jr. Las Getias 170",
      reference: "Frente al parque",
    });
    expect(item.whoPays).toBe("ONLINE");
    expect(item).not.toHaveProperty("pin");
  });

  it("sends a store pickup to its agency only, keeping the PIN, even if the form still holds an address", () => {
    const parsed = parseLot({
      deliveryType: OLVA_DELIVERY_TYPES.STORE_PICKUP,
      pin: "1234",
      destination: {
        agencyCode: "LIM01",
        ubigeoCode: "",
        address: "Av. Larco 123",
        reference: "Esquina",
      },
    });
    const [item] = toOlvaBulkInput(parsed).items;

    expect(item.destination).toEqual({ agencyCode: "LIM01" });
    expect(item).toMatchObject({ deliveryType: "O", pin: "1234" });
  });

  it("rejects a home delivery that was not given a district", () => {
    const result = bulkCreateOlvaShipmentsSchema.safeParse({
      items: [
        {
          ...buildOlvaFormDefaults([buildOrderDetail()]).items[0],
          origin: { headquarterId: "12" },
          deliveryType: OLVA_DELIVERY_TYPES.HOME_DELIVERY,
          whoPays: "ONLINE",
          paymentMethod: "niubiz",
          destination: { agencyCode: "", ubigeoCode: "", address: "Jr. 1", reference: "Parque" },
        },
      ],
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["items", 0, "destination", "ubigeoCode"]);
  });
});

describe("toOlvaBulkInput sender", () => {
  it("omits an unset sender and keeps a chosen one", () => {
    const pickup = { destination: { agencyCode: "LIM01" } };

    expect(toOlvaBulkInput(parseLot(pickup))).not.toHaveProperty("senderProfileId");
    expect(toOlvaBulkInput(parseLot(pickup, SENDER_ID)).senderProfileId).toBe(SENDER_ID);
  });
});
