import type {
  OlvaAgencyResponseDto,
  OlvaNearestAgencyResponseDto,
} from "../dto/olva-agency-response.dto";

export function buildOlvaAgencyResponse(
  overrides: Partial<OlvaAgencyResponseDto> = {},
): OlvaAgencyResponseDto {
  return {
    code: "LIM01",
    name: "Agencia Lima Centro",
    type: "AGENCIA",
    department: "LIMA",
    province: "LIMA",
    district: "CERCADO DE LIMA",
    address: "Jr. de la Unión 100",
    ubigeo: "150101",
    isPartner: false,
    phone: null,
    schedule: {
      monday: { open: "08:00", close: "18:00" },
      saturday: { open: null, close: null },
    },
    latitude: -12.05,
    longitude: -77.03,
    headquarterCode: "LIM",
    headquarterId: 12,
    ...overrides,
  };
}

export function buildOlvaNearestAgencyResponse(
  overrides: Partial<OlvaNearestAgencyResponseDto> = {},
): OlvaNearestAgencyResponseDto {
  return { ...buildOlvaAgencyResponse(), distanceKm: 1.2, ...overrides };
}
