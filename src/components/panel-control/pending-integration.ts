import { toast } from "sonner";
import { PANEL_CONTRACTS } from "@/features/panel-control/shared/data/panel-contracts";
import type { PanelContractId } from "@/features/panel-control/shared/models/panel-contract.model";

export function notifyPendingIntegration(accion: string, contractId: PanelContractId): void {
  const descriptor = PANEL_CONTRACTS[contractId];
  toast.info(`${accion}: pendiente de integración`, {
    description: `Requiere ${descriptor.metodo} ${descriptor.endpoint}. No se realizó ningún cambio.`,
  });
}
