import { beforeEach, describe, expect, it, vi } from "vitest";

const get = vi.hoisted(() => vi.fn());

vi.mock("@/lib/axiosAuth", () => ({ default: { get } }));
vi.mock("@/lib/api", () => ({ API: { integrations: "http://api.test" } }));

import { getOlvaStandardSizes, getOlvaUbigeos } from "../services/olva-catalog.service";
import { buildOlvaUbigeoResponse } from "../test-utils/olva-catalog.fixtures";

describe("olva-catalog service", () => {
  beforeEach(() => get.mockReset());

  it("calls the catalog endpoints and maps the results", async () => {
    get.mockResolvedValueOnce({
      data: {
        results: [
          {
            sizeId: "small",
            label: "S",
            lengthCm: 10,
            widthCm: 10,
            heightCm: null,
            maxWeightKg: 2,
          },
        ],
      },
    });
    get.mockResolvedValueOnce({ data: { results: [buildOlvaUbigeoResponse()] } });

    expect(await getOlvaStandardSizes()).toEqual([
      { id: "small", label: "S", lengthCm: 10, widthCm: 10, heightCm: null, maxWeightKg: 2 },
    ]);
    expect(await getOlvaUbigeos()).toEqual([
      {
        code: "250202",
        id: "2046",
        departmentCode: "25",
        provinceCode: "02",
        districtCode: "02",
        department: "UCAYALI",
        province: "ATALAYA",
        district: "SEPAHUA",
      },
    ]);
    expect(get.mock.calls[0][0]).toBe("http://api.test/olva/catalog/standard-sizes");
    expect(get.mock.calls[1][0]).toBe("http://api.test/olva/catalog/ubigeos");
  });
});
