import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createQueryClientWrapper } from "../../shared/test-utils/create-query-client-wrapper";

const post = vi.hoisted(() => vi.fn());

vi.mock("@/lib/axiosAuth", () => ({ default: { post } }));
vi.mock("@/lib/api", () => ({ API: { integrations: "http://api.test" } }));

import { useOlvaQuote } from "../hooks/use-olva-quote";
import { toCalculateOlvaQuoteRequestDto } from "../mappers/to-calculate-olva-quote-request.dto";
import { olvaQuoteSchema } from "../schemas/olva-quote.schema";
import { formatOlvaAmount } from "../utils/format-olva-amount";

const input = {
  originUbigeo: "150101",
  destinationUbigeo: "040101",
  deliveryType: "D",
  shipmentType: 2,
  weightKg: 1.5,
} as const;

describe("olva-quote", () => {
  beforeEach(() => post.mockReset());

  it("maps the input to the request DTO with partnerRate defaulting to false", () => {
    expect(toCalculateOlvaQuoteRequestDto(input)).toEqual({
      origin: "150101",
      destination: "040101",
      deliveryType: "D",
      shipmentType: 2,
      weightKg: 1.5,
      partnerRate: false,
    });
  });

  it("sends the package measures to the backend when there are some", () => {
    expect(
      toCalculateOlvaQuoteRequestDto({ ...input, lengthCm: 20, widthCm: 15, heightCm: 10 }),
    ).toEqual({
      origin: "150101",
      destination: "040101",
      deliveryType: "D",
      shipmentType: 2,
      weightKg: 1.5,
      lengthCm: 20,
      widthCm: 15,
      heightCm: 10,
      partnerRate: false,
    });
    expect(toCalculateOlvaQuoteRequestDto(input)).not.toHaveProperty("lengthCm");
  });

  it("schema asks a parcel for its measures, but not a document", () => {
    const base = {
      originUbigeo: "150101",
      destinationUbigeo: "040101",
      deliveryType: "O",
      weightKg: "0.5",
    };
    const parcel = olvaQuoteSchema.safeParse({ ...base, shipmentType: "2" });
    const sized = olvaQuoteSchema.safeParse({
      ...base,
      shipmentType: "2",
      lengthCm: "20",
      widthCm: "15",
      heightCm: "10",
    });
    const blank = olvaQuoteSchema.safeParse({
      ...base,
      shipmentType: "2",
      lengthCm: "",
      widthCm: "15",
      heightCm: "10",
    });
    const document = olvaQuoteSchema.safeParse({ ...base, shipmentType: "1" });

    expect(parcel.error?.issues.map((i) => i.path[0])).toEqual(["lengthCm", "widthCm", "heightCm"]);
    expect(sized.data).toMatchObject({ lengthCm: 20, widthCm: 15, heightCm: 10 });
    expect(blank.error?.issues.map((i) => i.path[0])).toEqual(["lengthCm"]);
    expect(document.success).toBe(true);
  });

  it("schema coerces text inputs and enforces the rules", () => {
    const ok = olvaQuoteSchema.safeParse({
      originUbigeo: "150101",
      destinationUbigeo: "040101",
      deliveryType: "O",
      shipmentType: "2",
      weightKg: "0.5",
      lengthCm: "20",
      widthCm: "15",
      heightCm: "10",
    });
    const bad = olvaQuoteSchema.safeParse({
      originUbigeo: "1501",
      destinationUbigeo: "040101",
      deliveryType: "X",
      shipmentType: "3",
      weightKg: "0",
    });

    expect(ok.data).toMatchObject({ shipmentType: 2, weightKg: 0.5, partnerRate: false });
    expect(bad.success).toBe(false);
    expect(bad.error?.issues.map((i) => i.path[0]).sort()).toEqual([
      "deliveryType",
      "originUbigeo",
      "shipmentType",
      "weightKg",
    ]);
  });

  it("formats amounts in soles", () => {
    expect(formatOlvaAmount(12.5, "PEN")).toMatch(/S\/\s?12\.50/);
  });

  it("hook is idle for null and posts the DTO otherwise", async () => {
    post.mockResolvedValue({
      data: { amount: 12.5, currency: "PEN", excessWeightKg: 0, deliveryType: "D" },
    });
    const { wrapper } = createQueryClientWrapper();

    const idle = renderHook(() => useOlvaQuote(null), { wrapper });
    expect(idle.result.current.fetchStatus).toBe("idle");
    expect(post).not.toHaveBeenCalled();

    const { result } = renderHook(() => useOlvaQuote(input), { wrapper });
    await waitFor(() => expect(result.current.data?.amount).toBe(12.5));
    expect(post.mock.calls[0][0]).toBe("http://api.test/olva/quotes");
    expect(post.mock.calls[0][1]).toMatchObject({ origin: "150101", partnerRate: false });
  });
});
