import type { OlvaUbigeo } from "./olva-ubigeo";

/** A district, the level that has the 6-digit code a home delivery needs. */
export interface OlvaUbigeoDistrictNode {
  name: string;
  ubigeo: OlvaUbigeo;
}

export interface OlvaUbigeoProvinceNode {
  name: string;
  /** Sorted by name. */
  districts: OlvaUbigeoDistrictNode[];
}

export interface OlvaUbigeoDepartmentNode {
  name: string;
  /** Sorted by name. */
  provinces: OlvaUbigeoProvinceNode[];
}

/** The ubigeo catalog as department -> province -> district, to pick a destination step by step. */
export type OlvaUbigeoTree = OlvaUbigeoDepartmentNode[];
