import { delay, HttpResponse, http } from "msw";
import type { InitializeSunatDocumentSequenceRequestDto } from "@/features/sunat/sunat-document-sequence/dto/initialize-sunat-document-sequence-request.dto";
import type { SetDefaultSunatDocumentSequenceRequestDto } from "@/features/sunat/sunat-document-sequence/dto/set-default-sunat-document-sequence-request.dto";
import {
  buildSunatDocumentSequenceList,
  buildSunatDocumentSequenceResponse,
} from "@/features/sunat/sunat-document-sequence/test-utils/sunat-document-sequence.fixtures";

// Wildcard prefix so this matches regardless of what NEXT_PUBLIC_API_SUNAT
// resolves to in a given environment (unset in Storybook/tests).
const SEQUENCES_PATH = "*/api/v1/sunat-document-sequences";
const SEQUENCES_COMPANY_PATH = "*/api/v1/sunat-document-sequences/company";
const SEQUENCES_DEFAULT_PATH = "*/api/v1/sunat-document-sequences/default";
const SEQUENCES_INITIALIZE_PATH = "*/api/v1/sunat-document-sequences/initialize";

function notFoundResponse() {
  return HttpResponse.json(
    {
      statusCode: 404,
      code: "SUNAT_DOCUMENT_SEQUENCE_NOT_FOUND",
      message: "SUNAT document sequence not found.",
    },
    { status: 404 },
  );
}

/** Mixed state by default (see buildSunatDocumentSequenceList). */
const MIXED_LIST = http.get(SEQUENCES_COMPANY_PATH, async () => {
  await delay(300);

  return HttpResponse.json(buildSunatDocumentSequenceList());
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

const SET_DEFAULT_SUCCESS = http.patch<never, SetDefaultSunatDocumentSequenceRequestDto>(
  SEQUENCES_DEFAULT_PATH,
  async ({ request }) => {
    const body = await request.json();

    await delay(300);

    return HttpResponse.json(
      buildSunatDocumentSequenceResponse({
        taxDocumentType: body.taxDocumentType,
        series: body.series,
        nextCorrelative: 3,
        isDefault: true,
      }),
    );
  },
);

const SET_DEFAULT_NOT_FOUND = http.patch(SEQUENCES_DEFAULT_PATH, async () => {
  await delay(300);

  return notFoundResponse();
});

const DELETE_SUCCESS = http.delete(SEQUENCES_PATH, async () => {
  await delay(300);

  return new HttpResponse(null, { status: 204 });
});

const DELETE_NOT_FOUND = http.delete(SEQUENCES_PATH, async () => {
  await delay(300);

  return notFoundResponse();
});

const INITIALIZE_SUCCESS = http.post<never, InitializeSunatDocumentSequenceRequestDto>(
  SEQUENCES_INITIALIZE_PATH,
  async ({ request }) => {
    const body = await request.json();

    await delay(300);

    return HttpResponse.json(
      buildSunatDocumentSequenceResponse({
        taxDocumentType: body.taxDocumentType,
        series: body.series,
        nextCorrelative: body.lastCorrelative + 1,
        isDefault: false,
      }),
      { status: 201 },
    );
  },
);

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
