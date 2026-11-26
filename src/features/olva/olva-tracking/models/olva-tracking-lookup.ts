export interface OlvaTrackingLookup {
  /** 6 to 12 digits. */
  orderNumber: string;
  /** 2-digit issue year; blank or omitted = the current year. */
  orderCode?: string;
}
