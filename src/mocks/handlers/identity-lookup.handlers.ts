import { delay, HttpResponse, http } from "msw";

// Wildcard prefix so this matches regardless of what NEXT_PUBLIC_API_SUNAT
// resolves to in a given environment (unset in Storybook/tests).
const IDENTITY_LOOKUP_PATH = "*/api/v1/identity-lookup";

/**
 * Success handler returning the same shapes confirmed live against the
 * real backend during development: BEJARANO MALUQUISH MARCO POLO
 * (DNI 44070820) and POWIP TECHNOLOGY S.A.C. (RUC 20616141971).
 */
const success = http.get(IDENTITY_LOOKUP_PATH, async ({ request }) => {
  const url = new URL(request.url);
  const documentType = url.searchParams.get("documentType");
  const documentNumber = url.searchParams.get("documentNumber");

  await delay(400);

  if (documentType === "RUC") {
    return HttpResponse.json({
      documentType: "RUC",
      documentNumber,
      fullName: "POWIP TECHNOLOGY S.A.C.",
      tradeName: null,
      status: "ACTIVO",
      condition: "NO HALLADO",
      address: "AV. VENEZUELA NRO 625 URB. CHACRA COLORADA",
      ubigeo: "150105",
      district: "BREÑA",
      province: "LIMA",
      department: "LIMA",
      fetchedAt: new Date().toISOString(),
    });
  }

  return HttpResponse.json({
    documentType: "DNI",
    documentNumber,
    fullName: "BEJARANO MALUQUISH MARCO POLO",
    tradeName: null,
    status: null,
    condition: null,
    address: null,
    ubigeo: null,
    district: null,
    province: null,
    department: null,
    fetchedAt: new Date().toISOString(),
  });
});

const notFound = http.get(IDENTITY_LOOKUP_PATH, async () => {
  await delay(400);

  return HttpResponse.json(
    {
      statusCode: 404,
      code: "IDENTITY_NOT_FOUND",
      message: "No data found for the given document.",
    },
    { status: 404 },
  );
});

const rateLimited = http.get(IDENTITY_LOOKUP_PATH, async () => {
  await delay(400);

  return HttpResponse.json(
    {
      statusCode: 429,
      code: "IDENTITY_LOOKUP_RATE_LIMITED",
      message: "The identity lookup provider rate limit was exceeded.",
    },
    { status: 429 },
  );
});

const providerUnavailable = http.get(IDENTITY_LOOKUP_PATH, async () => {
  await delay(400);

  return HttpResponse.json(
    {
      statusCode: 502,
      code: "IDENTITY_LOOKUP_PROVIDER_UNAVAILABLE",
      message: "The identity lookup provider is temporarily unavailable.",
    },
    { status: 502 },
  );
});

// Never resolves - useful for a permanent "loading" story.
const pending = http.get(IDENTITY_LOOKUP_PATH, () => delay("infinite"));

export const identityLookupHandlers = {
  success,
  notFound,
  rateLimited,
  providerUnavailable,
  pending,
};
