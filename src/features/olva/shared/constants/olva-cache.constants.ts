const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;

/**
 * Catalog and agency directory: the same for every company and they change rarely. ms-integrations
 * answers them with `Cache-Control: private, max-age=3600`, so the client keeps them just as long.
 */
export const OLVA_REFERENCE_DATA_STALE_TIME_MS = HOUR_MS;

/** A quote only depends on its inputs, but tariffs can change, so it is not kept for long. */
export const OLVA_QUOTE_STALE_TIME_MS = MINUTE_MS;

/** Person lookups return personal data (answered `no-store`): keep them briefly, in memory only. */
export const OLVA_PERSON_STALE_TIME_MS = 5 * MINUTE_MS;
export const OLVA_PERSON_GC_TIME_MS = 5 * MINUTE_MS;
