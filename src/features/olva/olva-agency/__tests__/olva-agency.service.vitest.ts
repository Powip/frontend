import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildOlvaAgencyResponse,
  buildOlvaNearestAgencyResponse,
} from "../test-utils/olva-agency.fixtures";

const get = vi.hoisted(() => vi.fn());

vi.mock("@/lib/axiosAuth", () => ({ default: { get } }));
vi.mock("@/lib/api", () => ({ API: { integrations: "http://api.test" } }));

import {
  getNearestOlvaAgencies,
  getOlvaAgencies,
  getOlvaAgency,
  getOlvaAgencyDistricts,
  getOlvaAgencyProvinces,
} from "../services/olva-agency.service";

describe("olva-agency service", () => {
  beforeEach(() => get.mockReset());

  it("sends only non-blank filters", async () => {
    get.mockResolvedValue({ data: { results: [buildOlvaAgencyResponse()] } });

    const agencies = await getOlvaAgencies({ q: " centro ", department: "" });

    expect(get).toHaveBeenCalledWith("http://api.test/olva/agencies", { params: { q: "centro" } });
    expect(agencies[0].coordinates).toEqual({ latitude: -12.05, longitude: -77.03 });
  });

  it("maps missing coordinates to null", async () => {
    get.mockResolvedValue({
      data: { results: [buildOlvaAgencyResponse({ latitude: null, longitude: null })] },
    });

    expect((await getOlvaAgencies())[0].coordinates).toBeNull();
  });

  it("sends nearest params as lat/lng/limit", async () => {
    get.mockResolvedValue({ data: { results: [buildOlvaNearestAgencyResponse()] } });

    const [first] = await getNearestOlvaAgencies({ latitude: -12, longitude: -77, limit: 3 });

    expect(get).toHaveBeenCalledWith("http://api.test/olva/agencies/nearest", {
      params: { lat: -12, lng: -77, limit: 3 },
    });
    expect(first.distanceKm).toBe(1.2);
  });

  it("encodes path segments and maps divisions", async () => {
    get.mockResolvedValueOnce({ data: { results: [{ province: "HUÁNUCO", agencies: 4 }] } });
    get.mockResolvedValueOnce({ data: { results: [{ district: "SAN MARTÍN", agencies: 1 }] } });

    expect(await getOlvaAgencyProvinces("MADRE DE DIOS")).toEqual([
      { name: "HUÁNUCO", agencyCount: 4 },
    ]);
    expect(await getOlvaAgencyDistricts("LIMA", "CAÑETE")).toEqual([
      { name: "SAN MARTÍN", agencyCount: 1 },
    ]);
    expect(get.mock.calls[0][0]).toBe(
      "http://api.test/olva/agencies/departments/MADRE%20DE%20DIOS/provinces",
    );
    expect(get.mock.calls[1][0]).toBe(
      "http://api.test/olva/agencies/departments/LIMA/provinces/CA%C3%91ETE/districts",
    );
  });

  it("gets one agency by encoded code", async () => {
    get.mockResolvedValue({ data: buildOlvaAgencyResponse({ code: "A/1" }) });

    expect((await getOlvaAgency("A/1")).code).toBe("A/1");
    expect(get.mock.calls[0][0]).toBe("http://api.test/olva/agencies/A%2F1");
  });
});
