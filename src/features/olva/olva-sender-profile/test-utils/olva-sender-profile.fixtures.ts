import type { OlvaSenderProfileResponseDto } from "../dto/olva-sender-profile-response.dto";

// Plain data builders with no MSW import, so unit tests (jsdom) and Storybook handlers share them

export function buildOlvaSenderProfileResponse(
  overrides: Partial<OlvaSenderProfileResponseDto> = {},
): OlvaSenderProfileResponseDto {
  return {
    id: "sender-profile-001",
    label: "Almacén principal",
    ruc: "20616141971",
    email: "remitente@empresa.com",
    firstNames: "Maria Fernanda",
    lastName: "Quispe Rojas",
    phone: null,
    businessName: "Comercial Los Andes S.A.C.",
    isDefault: false,
    createdAt: "2026-10-01T15:00:00.000Z",
    updatedAt: "2026-10-01T15:00:00.000Z",
    ...overrides,
  };
}

/** One default profile plus one incomplete, non-default profile. */
export function buildOlvaSenderProfileList(): OlvaSenderProfileResponseDto[] {
  return [
    buildOlvaSenderProfileResponse({ isDefault: true }),
    buildOlvaSenderProfileResponse({
      id: "sender-profile-002",
      label: "Tienda Miraflores",
      ruc: "20123456786",
      businessName: null,
      firstNames: null,
      lastName: null,
    }),
  ];
}
