import { delay, HttpResponse, http } from "msw";
import { IDENTITY_LOOKUP_DOCUMENT_TYPES } from "@/features/identity-lookup/enums/identity-lookup.enums";

// Wildcard prefix so this matches regardless of what NEXT_PUBLIC_API_SUNAT
// resolves to in a given environment (unset in Storybook/tests).
const IDENTITY_LOOKUP_PATH = "*/api/v1/identity-lookup";

function buildIdentityLookupResponse(documentType: string, documentNumber: string) {
  if (documentType === IDENTITY_LOOKUP_DOCUMENT_TYPES.RUC) {
    return {
      documentType,
      documentNumber,
      fullName: "Comercial Los Andes S.A.C.",
      tradeName: "Los Andes",
      status: "ACTIVO",
      condition: "HABIDO",
      address: "AV. JAVIER PRADO ESTE 1234",
      ubigeo: "150101",
      district: "LIMA",
      province: "LIMA",
      department: "LIMA",
      fetchedAt: new Date().toISOString(),
    };
  }

  return {
    documentType,
    documentNumber,
    fullName: "MARIA FERNANDA QUISPE ROJAS",
    tradeName: null,
    status: null,
    condition: null,
    address: null,
    ubigeo: null,
    district: null,
    province: null,
    department: null,
    fetchedAt: new Date().toISOString(),
  };
}

const IDENTITY_LOOKUP_SUCCESS = http.get(IDENTITY_LOOKUP_PATH, async ({ request }) => {
  await delay(300);

  const url = new URL(request.url);
  const documentType = url.searchParams.get("documentType") ?? IDENTITY_LOOKUP_DOCUMENT_TYPES.DNI;
  const documentNumber = url.searchParams.get("documentNumber") ?? "";

  return HttpResponse.json(buildIdentityLookupResponse(documentType, documentNumber));
});

const IDENTITY_LOOKUP_PENDING = http.get(IDENTITY_LOOKUP_PATH, () => delay("infinite"));

const IDENTITY_LOOKUP_NOT_FOUND = http.get(IDENTITY_LOOKUP_PATH, async () => {
  await delay(300);

  return HttpResponse.json(
    {
      statusCode: 404,
      code: "IDENTITY_NOT_FOUND",
      message: "No se encontraron datos para ese documento.",
    },
    { status: 404 },
  );
});

const IDENTITY_LOOKUP_RATE_LIMITED = http.get(IDENTITY_LOOKUP_PATH, async () => {
  await delay(300);

  return HttpResponse.json(
    {
      statusCode: 429,
      code: "IDENTITY_LOOKUP_RATE_LIMITED",
      message: "El servicio de verificación está saturado por el momento.",
    },
    { status: 429 },
  );
});

const IDENTITY_LOOKUP_PROVIDER_UNAVAILABLE = http.get(IDENTITY_LOOKUP_PATH, async () => {
  await delay(300);

  return HttpResponse.json(
    {
      statusCode: 503,
      code: "IDENTITY_LOOKUP_PROVIDER_UNAVAILABLE",
      message: "El servicio de verificación RENIEC/SUNAT no está disponible en este momento.",
    },
    { status: 503 },
  );
});

export const identityLookupHandlers = {
  success: IDENTITY_LOOKUP_SUCCESS,
  pending: IDENTITY_LOOKUP_PENDING,
  notFound: IDENTITY_LOOKUP_NOT_FOUND,
  rateLimited: IDENTITY_LOOKUP_RATE_LIMITED,
  providerUnavailable: IDENTITY_LOOKUP_PROVIDER_UNAVAILABLE,
};

// Wildcard prefix so this matches regardless of what NEXT_PUBLIC_API_SUNAT
// resolves to in a given environment (unset in Storybook/tests) - same
// approach as identityLookupHandlers above.
const SEQUENCES_PATH = "*/api/v1/sunat-document-sequences";
const SEQUENCES_COMPANY_PATH = "*/api/v1/sunat-document-sequences/company";
const SEQUENCES_DEFAULT_PATH = "*/api/v1/sunat-document-sequences/default";
const SEQUENCES_INITIALIZE_PATH = "*/api/v1/sunat-document-sequences/initialize";

const COMPANY_ID = "company-001";
const RUC_ISSUER = "20616141971";

function buildSequence(overrides: {
  taxDocumentType: string;
  series: string;
  nextCorrelative: number;
  isDefault: boolean;
}) {
  return {
    companyId: COMPANY_ID,
    rucIssuer: RUC_ISSUER,
    ...overrides,
  };
}

/**
 * A realistic mixed state: Factura (F001) and Boleta (B001) configured and
 * defaulted, Nota de crédito (FC01) configured but NOT default (so the
 * "Marcar" action has something to do), and Nota de débito left completely
 * unconfigured (so the "No configurado" empty state renders too).
 */
const MIXED_LIST = http.get(SEQUENCES_COMPANY_PATH, async () => {
  await delay(300);

  return HttpResponse.json([
    buildSequence({ taxDocumentType: "01", series: "F001", nextCorrelative: 43, isDefault: true }),
    buildSequence({ taxDocumentType: "03", series: "B001", nextCorrelative: 118, isDefault: true }),
    buildSequence({
      taxDocumentType: "07",
      series: "FC01",
      nextCorrelative: 3,
      isDefault: false,
    }),
  ]);
});

const EMPTY_LIST = http.get(SEQUENCES_COMPANY_PATH, async () => {
  await delay(300);

  return HttpResponse.json([]);
});

const LIST_ERROR = http.get(SEQUENCES_COMPANY_PATH, async () => {
  await delay(300);

  return HttpResponse.json(
    { statusCode: 500, code: "INTERNAL_ERROR", message: "Unexpected error." },
    { status: 500 },
  );
});

const LIST_PENDING = http.get(SEQUENCES_COMPANY_PATH, () => delay("infinite"));

const SET_DEFAULT_SUCCESS = http.patch(SEQUENCES_DEFAULT_PATH, async ({ request }) => {
  const body = (await request.json()) as { taxDocumentType: string; series: string };

  await delay(300);

  return HttpResponse.json(
    buildSequence({
      taxDocumentType: body.taxDocumentType,
      series: body.series,
      nextCorrelative: 3,
      isDefault: true,
    }),
  );
});

const SET_DEFAULT_NOT_FOUND = http.patch(SEQUENCES_DEFAULT_PATH, async () => {
  await delay(300);

  return HttpResponse.json(
    {
      statusCode: 404,
      code: "SUNAT_DOCUMENT_SEQUENCE_NOT_FOUND",
      message: "SUNAT document sequence not found.",
    },
    { status: 404 },
  );
});

const DELETE_SUCCESS = http.delete(SEQUENCES_PATH, async () => {
  await delay(300);

  return new HttpResponse(null, { status: 204 });
});

const DELETE_NOT_FOUND = http.delete(SEQUENCES_PATH, async () => {
  await delay(300);

  return HttpResponse.json(
    {
      statusCode: 404,
      code: "SUNAT_DOCUMENT_SEQUENCE_NOT_FOUND",
      message: "SUNAT document sequence not found.",
    },
    { status: 404 },
  );
});

const INITIALIZE_SUCCESS = http.post(SEQUENCES_INITIALIZE_PATH, async ({ request }) => {
  const body = (await request.json()) as {
    taxDocumentType: string;
    series: string;
    lastCorrelative: number;
  };

  await delay(300);

  return HttpResponse.json(
    buildSequence({
      taxDocumentType: body.taxDocumentType,
      series: body.series,
      nextCorrelative: body.lastCorrelative + 1,
      isDefault: false,
    }),
    { status: 201 },
  );
});

export const sunatDocumentSequenceHandlers = {
  mixedList: MIXED_LIST,
  emptyList: EMPTY_LIST,
  listError: LIST_ERROR,
  listPending: LIST_PENDING,
  setDefaultSuccess: SET_DEFAULT_SUCCESS,
  setDefaultNotFound: SET_DEFAULT_NOT_FOUND,
  deleteSuccess: DELETE_SUCCESS,
  deleteNotFound: DELETE_NOT_FOUND,
  initializeSuccess: INITIALIZE_SUCCESS,
};
