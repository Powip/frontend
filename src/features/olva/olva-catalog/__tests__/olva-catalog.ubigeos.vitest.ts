import { describe, expect, it } from "vitest";
import { toOlvaUbigeo } from "../mappers/to-olva-ubigeo";
import { buildOlvaUbigeoResponse } from "../test-utils/olva-catalog.fixtures";
import { buildOlvaUbigeoTree } from "../utils/build-olva-ubigeo-tree";
import { findOlvaUbigeoByNames } from "../utils/find-olva-ubigeo-by-names";
import { indexOlvaUbigeosByCode } from "../utils/index-olva-ubigeos-by-code";
import { isKnownOlvaUbigeo } from "../utils/is-known-olva-ubigeo";

const sepahua = toOlvaUbigeo(buildOlvaUbigeoResponse());
const raimondi = toOlvaUbigeo(
  buildOlvaUbigeoResponse({
    ubigeo_code: "250201",
    ubigeo_id: "2045",
    district_code: "01",
    district: "RAIMONDI",
  }),
);
const lima = toOlvaUbigeo(
  buildOlvaUbigeoResponse({
    ubigeo_code: "150101",
    ubigeo_id: "1392",
    department_code: "15",
    province_code: "01",
    district_code: "01",
    department: "LIMA",
    province: "LIMA",
    district: "LIMA",
  }),
);
const ubigeos = [sepahua, lima, raimondi];

describe("toOlvaUbigeo", () => {
  it("translates the wire fields and keeps the id as text", () => {
    expect(sepahua).toEqual({
      code: "250202",
      id: "2046",
      departmentCode: "25",
      provinceCode: "02",
      districtCode: "02",
      department: "UCAYALI",
      province: "ATALAYA",
      district: "SEPAHUA",
    });
  });
});

describe("buildOlvaUbigeoTree", () => {
  it("groups department -> province -> district, sorted by name", () => {
    const tree = buildOlvaUbigeoTree(ubigeos);

    expect(tree.map((department) => department.name)).toEqual(["LIMA", "UCAYALI"]);
    expect(tree[1].provinces).toHaveLength(1);
    expect(tree[1].provinces[0].name).toBe("ATALAYA");
    expect(tree[1].provinces[0].districts.map((district) => district.name)).toEqual([
      "RAIMONDI",
      "SEPAHUA",
    ]);
    expect(tree[1].provinces[0].districts[1].ubigeo.code).toBe("250202");
  });

  it("keeps apart places that share a name but not a code", () => {
    const otherDepartment = toOlvaUbigeo(
      buildOlvaUbigeoResponse({ ubigeo_code: "100101", department_code: "10", province: "LIMA" }),
    );
    const tree = buildOlvaUbigeoTree([lima, otherDepartment]);

    expect(tree).toHaveLength(2);
  });

  it("does not mutate the catalog it receives", () => {
    const copy = [...ubigeos];

    buildOlvaUbigeoTree(ubigeos);

    expect(ubigeos).toEqual(copy);
  });

  it("is empty for an empty catalog", () => {
    expect(buildOlvaUbigeoTree([])).toEqual([]);
  });
});

describe("findOlvaUbigeoByNames", () => {
  it("matches the three names ignoring case and accents", () => {
    expect(
      findOlvaUbigeoByNames(ubigeos, {
        department: "ucayali",
        province: " Atalaya ",
        district: "Sepahúa",
      }),
    ).toBe(sepahua);
  });

  it("returns undefined when a name is missing or does not match", () => {
    expect(
      findOlvaUbigeoByNames(ubigeos, { department: "Ucayali", province: "Atalaya", district: "" }),
    ).toBeUndefined();
    expect(
      findOlvaUbigeoByNames(ubigeos, { department: "Lima", province: "Atalaya", district: "Lima" }),
    ).toBeUndefined();
  });
});

describe("isKnownOlvaUbigeo", () => {
  const index = indexOlvaUbigeosByCode(ubigeos);

  it("knows the codes of the catalog", () => {
    expect(isKnownOlvaUbigeo(index, "250202")).toBe(true);
    expect(isKnownOlvaUbigeo(index, "999999")).toBe(false);
    expect(isKnownOlvaUbigeo(index, "")).toBe(false);
    expect(isKnownOlvaUbigeo(index, undefined)).toBe(false);
  });
});
