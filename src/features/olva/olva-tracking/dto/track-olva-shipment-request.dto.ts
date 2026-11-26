// POST /olva/track (a read: answers 200 and `Cache-Control: no-store`)
export interface TrackOlvaShipmentRequestDto {
  /** 6 to 12 digits. */
  orderNumber: string;
  /** 2-digit issue year. Omitted = Olva assumes the current year. */
  orderCode?: string;
}
