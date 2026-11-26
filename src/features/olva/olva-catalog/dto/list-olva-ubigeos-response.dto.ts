// GET /olva/catalog/ubigeos -> 200 { results }
// Wire format as Olva names it (snake_case); `toOlvaUbigeo` translates it to the model.
export interface OlvaUbigeoResponseDto {
  /** 6-digit ubigeo (e.g. "250202"): what quotes and home-delivery shipments take. */
  ubigeo_code: string;
  /** Olva's id for the same ubigeo, as text (e.g. "2046"). */
  ubigeo_id: string;
  /** 2-digit INEI codes (e.g. "25", "02", "02"); they compose `ubigeo_code`. */
  department_code: string;
  province_code: string;
  district_code: string;
  /** e.g. "UCAYALI" */
  department: string;
  /** e.g. "ATALAYA" */
  province: string;
  /** e.g. "SEPAHUA" */
  district: string;
}

export interface ListOlvaUbigeosResponseDto {
  results: OlvaUbigeoResponseDto[];
}
