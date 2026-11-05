import type { OlvaPersonResponseDto } from "../dto/olva-person-response.dto";
import type { OlvaPerson } from "../models/olva-person";

export function toOlvaPerson(dto: OlvaPersonResponseDto): OlvaPerson {
  return { ...dto };
}
