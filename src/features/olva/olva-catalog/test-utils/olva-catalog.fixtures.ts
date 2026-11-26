import type { OlvaHeadquarterResponseDto } from "../dto/list-olva-headquarters-response.dto";
import type { OlvaStandardSizeResponseDto } from "../dto/list-olva-standard-sizes-response.dto";
import type { OlvaUbigeoResponseDto } from "../dto/list-olva-ubigeos-response.dto";

export function buildOlvaHeadquarterResponse(
  overrides: Partial<OlvaHeadquarterResponseDto> = {},
): OlvaHeadquarterResponseDto {
  return {
    headquarterId: "12",
    headquarterName: "Olva Courier Miraflores",
    name: "Miraflores",
    address: "Av. Larco 123",
    department: "LIMA",
    province: "LIMA",
    district: "MIRAFLORES",
    ubigeoCode: "150122",
    ubigeoId: "1234",
    showInsuranceOption: true,
    showDeclarationOption: false,
    paymentModalities: [
      {
        code: "STORE",
        title: "Pago en tienda",
        description: "Pagas al entregar",
        sortOrder: 3,
        requiresPaymentMethod: false,
        paymentMethods: [],
      },
      {
        code: "ONLINE",
        title: "Pago online",
        description: "Pagas ahora",
        sortOrder: 1,
        requiresPaymentMethod: true,
        paymentMethods: [{ code: "niubiz", title: "Tarjeta", methodId: 7 }],
      },
    ],
    ...overrides,
  };
}

export function buildOlvaStandardSizeResponse(
  overrides: Partial<OlvaStandardSizeResponseDto> = {},
): OlvaStandardSizeResponseDto {
  return {
    sizeId: "extra-small",
    label: "XXS",
    lengthCm: 20,
    widthCm: 15,
    heightCm: 10,
    maxWeightKg: 0.5,
    ...overrides,
  };
}

/** The catalog as Olva sends it: the envelope first (no measures), then boxes by size. */
export function buildOlvaStandardSizesResponse(): OlvaStandardSizeResponseDto[] {
  return [
    buildOlvaStandardSizeResponse({
      sizeId: "letter",
      label: "Sobre",
      lengthCm: null,
      widthCm: null,
      heightCm: null,
      maxWeightKg: 0.5,
    }),
    buildOlvaStandardSizeResponse(),
    buildOlvaStandardSizeResponse({
      sizeId: "small",
      label: "S",
      lengthCm: 30,
      widthCm: 20,
      heightCm: 15,
      maxWeightKg: 2,
    }),
    buildOlvaStandardSizeResponse({
      sizeId: "middle",
      label: "M",
      lengthCm: 40,
      widthCm: 30,
      heightCm: 20,
      maxWeightKg: 5,
    }),
  ];
}

/** A ubigeo as the API sends it (Sepahua, Atalaya, Ucayali). */
export function buildOlvaUbigeoResponse(
  overrides: Partial<OlvaUbigeoResponseDto> = {},
): OlvaUbigeoResponseDto {
  return {
    ubigeo_code: "250202",
    ubigeo_id: "2046",
    department_code: "25",
    province_code: "02",
    district_code: "02",
    department: "UCAYALI",
    province: "ATALAYA",
    district: "SEPAHUA",
    ...overrides,
  };
}
