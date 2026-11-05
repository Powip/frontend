// GET /olva/catalog/standard-sizes -> 200 { results }
export interface OlvaStandardSizeResponseDto {
  /** What POST /shipments takes as `package.sizeId`, for example "letter" or "extra-small". */
  sizeId: string;
  label: string;
  lengthCm: number | null;
  widthCm: number | null;
  heightCm: number | null;
  maxWeightKg: number;
}

export interface ListOlvaStandardSizesResponseDto {
  results: OlvaStandardSizeResponseDto[];
}
