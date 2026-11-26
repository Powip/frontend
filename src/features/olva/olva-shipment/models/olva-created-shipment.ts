import type { OlvaShipment } from "./olva-shipment";
import type { OlvaShipmentLabel } from "./olva-shipment-label";

export interface OlvaCreatedShipment extends OlvaShipment {
  /** Only present right after creation. Later, ask for it with `useOlvaShipmentLabel`. */
  label?: OlvaShipmentLabel;
}
