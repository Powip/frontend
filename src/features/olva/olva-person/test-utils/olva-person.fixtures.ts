import type { OlvaPersonResponseDto } from "../dto/olva-person-response.dto";

export function buildOlvaPersonResponse(
  overrides: Partial<OlvaPersonResponseDto> = {},
): OlvaPersonResponseDto {
  return {
    documentNumber: "12345678",
    documentType: "dni",
    fullName: "PEREZ GOMEZ JUAN",
    firstNames: "JUAN",
    lastNamePaternal: "PEREZ",
    lastNameMaternal: "GOMEZ",
    phone: null,
    contributorStatus: null,
    existsInOlva: true,
    ...overrides,
  };
}
