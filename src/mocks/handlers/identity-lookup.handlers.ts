import { delay, HttpResponse, http } from "msw";
import { IDENTITY_LOOKUP_DOCUMENT_TYPES } from "@/features/identity-lookup/enums/identity-lookup.enums";
import { buildIdentityLookupResponse } from "@/features/identity-lookup/test-utils/identity-lookup.fixtures";

// Wildcard prefix so this matches regardless of what NEXT_PUBLIC_API_SUNAT
// resolves to in a given environment (unset in Storybook/tests).
const IDENTITY_LOOKUP_PATH = "*/api/v1/identity-lookup";

const IDENTITY_LOOKUP_SUCCESS = http.get(IDENTITY_LOOKUP_PATH, async ({ request }) => {
  await delay(300);

  const url = new URL(request.url);
  const documentType =
    url.searchParams.get("documentType") === IDENTITY_LOOKUP_DOCUMENT_TYPES.RUC
      ? IDENTITY_LOOKUP_DOCUMENT_TYPES.RUC
      : IDENTITY_LOOKUP_DOCUMENT_TYPES.DNI;
  const documentNumber = url.searchParams.get("documentNumber") ?? "";

  return HttpResponse.json(buildIdentityLookupResponse({ documentType, documentNumber }));
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
