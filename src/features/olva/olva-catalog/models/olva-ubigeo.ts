/** A place Olva delivers to, with the 6-digit code that quotes and home deliveries use. */
export interface OlvaUbigeo {
  /** 6-digit INEI code (e.g. "250202"): the department, province and district codes joined. */
  code: string;
  /** Olva's id for the ubigeo (text, like the headquarter's `ubigeoId`). */
  id: string;
  /** 2-digit codes (e.g. "25"). */
  departmentCode: string;
  provinceCode: string;
  districtCode: string;
  /** Names as Olva writes them (e.g. "UCAYALI"). */
  department: string;
  province: string;
  district: string;
}
