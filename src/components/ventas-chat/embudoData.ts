import { useQuery } from "@tanstack/react-query";
import axiosAuth from "@/lib/axiosAuth";
import { API } from "@/lib/api";
import { crmKeys } from "@/lib/crmSse";
import { getBoard } from "@/services/crmService";
import type { AssignedFilter, Board, BoardColumn, Conversation, StageKind } from "@/types/crm";

/** Columna con el monto de la etapa (mockup 152): suma de la última cotización de cada chat. */
export type EmbudoColumn = BoardColumn & {
  amount?: number;
  conversations: Array<Conversation & { dealValue?: number | null }>;
};
export type EmbudoBoardData = Omit<Board, "columns"> & { columns: EmbudoColumn[] };

/** Etapas que mueve el sistema (pago aprobado y entrega del courier), no la vendedora. */
export function isAutoStage(kind: StageKind): boolean {
  return kind === "won";
}

/**
 * Tablero del embudo con filtro opcional por vendedora. Sin vendedora usa la
 * misma clave que `useMoveCard`, así el arrastre sigue siendo optimista.
 */
export function useEmbudoBoard(
  pipelineId: string | null,
  assigned: AssignedFilter,
  storeId?: string,
  sellerId?: string,
) {
  const base = crmKeys.board(pipelineId ?? "", assigned, storeId);
  return useQuery({
    queryKey: sellerId ? [...base, "seller", sellerId] : base,
    queryFn: async (): Promise<EmbudoBoardData> => {
      if (!sellerId) return (await getBoard(pipelineId!, assigned, storeId)) as EmbudoBoardData;
      const params: Record<string, string> = { assigned: "all", userId: sellerId };
      if (storeId) params.storeId = storeId;
      return (await axiosAuth.get<EmbudoBoardData>(`${API.crm}/crm/pipelines/${encodeURIComponent(pipelineId!)}/board`, { params })).data;
    },
    enabled: !!pipelineId,
    retry: false,
    placeholderData: (prev) => prev,
  });
}
