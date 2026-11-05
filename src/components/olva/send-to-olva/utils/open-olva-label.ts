import type { OlvaShipmentLabel } from "@/features/olva/olva-shipment/models/olva-shipment-label";
import { olvaShipmentLabelToBlob } from "@/features/olva/olva-shipment/utils/olva-shipment-label-to-blob";

const REVOKE_DELAY_MS = 60_000;

/**
 * Opens Olva's PDF label in a new tab. The object URL is released after a minute, once the tab
 * has had time to load it. Returns false when the browser blocked the popup.
 */
export function openOlvaLabel(label: OlvaShipmentLabel): boolean {
  const url = URL.createObjectURL(olvaShipmentLabelToBlob(label));
  // No "noopener": it makes window.open return null even when the tab opened, and this is our own blob
  const opened = window.open(url, "_blank");

  setTimeout(() => URL.revokeObjectURL(url), REVOKE_DELAY_MS);

  return opened !== null;
}
