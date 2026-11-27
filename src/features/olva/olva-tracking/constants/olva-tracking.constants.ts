const SECOND_MS = 1000;
const MINUTE_MS = 60 * SECOND_MS;

/** Same limit as the backend (MAX_TRACK_SHIPMENTS_BATCH_SIZE). */
export const OLVA_TRACKING_BATCH_MAX_SIZE = 50;

export const OLVA_ORDER_NUMBER_MIN_LENGTH = 6;
export const OLVA_ORDER_NUMBER_MAX_LENGTH = 12;
/** The issue year, 2 digits ("26"). Olva assumes the current year when it is not sent. */
export const OLVA_ORDER_CODE_LENGTH = 2;

/** A guide changes state through the day (served `no-store`), so it goes stale quickly. */
export const OLVA_TRACKING_STALE_TIME_MS = MINUTE_MS;
/** While a shipment is on its way, it is re-read now and then to show the new events. */
export const OLVA_TRACKING_REFETCH_INTERVAL_MS = 5 * MINUTE_MS;
/** Tracking holds personal data: it leaves memory soon after the screen is gone. */
export const OLVA_TRACKING_GC_TIME_MS = 5 * MINUTE_MS;
