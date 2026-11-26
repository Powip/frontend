"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { crmError } from "@/services/crmService";
import {
  addObjectionLibrary,
  getAuditD,
  getObjectionStatsD,
  getTeamBoard,
  updateObjectionD,
} from "@/services/crmBlockDService";
import { getAudit } from "@/services/crmTeamService";
import type { ObjectionFamily } from "@/types/crmBlockD";

export const blockDKeys = {
  board: (storeId: string) => ["crm", "team", "board", storeId] as const,
  objectionStats: (days: number, storeId: string) => ["crm", "content", "objection-stats-d", days, storeId] as const,
  audit: (storeId: string) => ["crm", "audit", "d", storeId] as const,
};

const onError = (err: unknown) => toast.error(crmError(err).message);

/** Tablero de Equipo (supervisor o administrador). Se refresca cada 30 s. */
export function useTeamBoard(storeId = "", enabled = true) {
  return useQuery({
    queryKey: blockDKeys.board(storeId),
    queryFn: () => getTeamBoard(storeId || undefined),
    enabled,
    retry: false,
    refetchInterval: 30_000,
  });
}

export function useObjectionStatsD(days = 30, storeId = "", enabled = true) {
  return useQuery({
    queryKey: blockDKeys.objectionStats(days, storeId),
    queryFn: () => getObjectionStatsD(days, storeId || undefined),
    enabled,
    retry: false,
  });
}

export function useObjectionBlockDActions() {
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: ["crm", "content"] });
  const library = useMutation({
    mutationFn: addObjectionLibrary,
    onSuccess: (r) => {
      toast.success(r.added ? `Se agregaron ${r.added} respuestas de la metodología` : "Ya tienes todas las respuestas de la metodología");
      refresh();
    },
    onError,
  });
  const update = useMutation({
    mutationFn: ({ id, ...input }: { id: string; family?: ObjectionFamily; businessAction?: string; actionDone?: boolean }) =>
      updateObjectionD(id, input),
    onSuccess: refresh,
    onError,
  });
  return { library, update };
}

export function useAuditD(storeId = "", enabled = true) {
  return useQuery({ queryKey: blockDKeys.audit(storeId), queryFn: () => getAuditD(storeId || undefined), retry: false, enabled });
}

/** Auditoría de antes: solo se pide si la del bloque D no responde. */
export function useAuditFallback(enabled: boolean) {
  return useQuery({ queryKey: ["crm", "audit"] as const, queryFn: getAudit, retry: false, enabled });
}
