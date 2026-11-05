import { queryOptions, skipToken } from "@tanstack/react-query";
import {
  OLVA_PERSON_GC_TIME_MS,
  OLVA_PERSON_STALE_TIME_MS,
} from "../../shared/constants/olva-cache.constants";
import { shouldRetryOlvaRequest } from "../../shared/utils/should-retry-olva-request";
import { olvaPersonKeys } from "../keys/olva-person.keys";
import type { OlvaPersonLookup } from "../models/olva-person-lookup";
import { getOlvaPerson } from "../services/olva-person.service";
import { isValidOlvaDocumentNumber } from "../utils/is-valid-olva-document-number";

const EMPTY_LOOKUP: OlvaPersonLookup = { documentType: "dni", documentNumber: "" };

export const olvaPersonQueries = {
  /** Idle for `null` or a malformed number: no request is spent on input that cannot match. */
  lookup: (lookup: OlvaPersonLookup | null) =>
    queryOptions({
      queryKey: olvaPersonKeys.lookup(lookup ?? EMPTY_LOOKUP),
      queryFn:
        lookup && isValidOlvaDocumentNumber(lookup.documentType, lookup.documentNumber)
          ? () => getOlvaPerson(lookup)
          : skipToken,
      // Personal data: short-lived and dropped from memory soon after the form is gone
      staleTime: OLVA_PERSON_STALE_TIME_MS,
      gcTime: OLVA_PERSON_GC_TIME_MS,
      // A 404 is a normal answer ("not found"), never worth retrying
      retry: shouldRetryOlvaRequest,
    }),
};
