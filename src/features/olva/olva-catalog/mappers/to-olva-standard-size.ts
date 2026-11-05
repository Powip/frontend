import type { OlvaStandardSizeResponseDto } from "../dto/list-olva-standard-sizes-response.dto";
import type { OlvaStandardSize } from "../models/olva-standard-size";

export function toOlvaStandardSize(dto: OlvaStandardSizeResponseDto): OlvaStandardSize {
  return {
    id: dto.sizeId,
    label: dto.label,
    lengthCm: dto.lengthCm,
    widthCm: dto.widthCm,
    heightCm: dto.heightCm,
    maxWeightKg: dto.maxWeightKg,
  };
}
