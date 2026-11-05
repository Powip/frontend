import { OLVA_BULK_ITEM_STATUSES } from "../constants/olva-shipment.constants";
import type { OlvaBulkShipmentItemResponseDto } from "../dto/bulk-create-olva-shipments-response.dto";
import type { OlvaBulkShipmentResult } from "../models/olva-bulk-shipment-result";
import { toOlvaRegisteredInOlva } from "./to-olva-registered-in-olva";
import { toOlvaShipment } from "./to-olva-shipment";
import { toOlvaShipmentLabel } from "./to-olva-shipment-label";

/**
 * One item of the lot answer -> the union narrowed by `status`. The backend guarantees which
 * field comes with which status; an answer that breaks it is a contract bug, so it fails loudly
 * instead of inventing a result (the item might have been registered).
 */
export function toOlvaBulkShipmentResult(
  dto: OlvaBulkShipmentItemResponseDto,
): OlvaBulkShipmentResult {
  const label = dto.label ? toOlvaShipmentLabel(dto.label) : null;

  switch (dto.status) {
    case OLVA_BULK_ITEM_STATUSES.CREATED: {
      if (!dto.shipment) throw new Error(`Lote inválido: "${dto.itemKey}" creado sin envío`);

      return {
        status: "created",
        itemKey: dto.itemKey,
        shipment: toOlvaShipment(dto.shipment),
        label,
      };
    }

    case OLVA_BULK_ITEM_STATUSES.REGISTERED_NOT_SAVED: {
      if (!dto.registeredInOlva) {
        throw new Error(`Lote inválido: "${dto.itemKey}" registrado sin datos de Olva`);
      }

      return {
        status: "registered_not_saved",
        itemKey: dto.itemKey,
        registeredInOlva: toOlvaRegisteredInOlva(dto.registeredInOlva),
        label,
      };
    }

    default: {
      if (!dto.error) throw new Error(`Lote inválido: "${dto.itemKey}" falló sin error`);

      return {
        status: "failed",
        itemKey: dto.itemKey,
        error: { ...dto.error },
        existingShipment: dto.shipment ? toOlvaShipment(dto.shipment) : null,
      };
    }
  }
}
