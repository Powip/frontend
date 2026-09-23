import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { partnersKeys } from "../keys/partners.keys";
import type { QueueItemResolution, ReviewQueueItem } from "../models/review-queue-item";
import { resolveReviewQueueItem } from "../services/resolve-review-queue-item";

const RESOLUTION_LABELS: Record<QueueItemResolution, string> = {
  pendiente: "Pendiente",
  aprobado: "Aprobado",
  rechazado: "Rechazado",
  bloqueado: "Bloqueado",
  asignado: "Asignado",
  verificado: "Verificado",
};

export function useResolveReviewQueueItem() {
  const queryClient = useQueryClient();

  return useMutation<ReviewQueueItem, Error, { id: string; resolution: QueueItemResolution }>({
    mutationFn: ({ id, resolution }) => resolveReviewQueueItem(id, resolution),

    onSuccess: (item, variables) => {
      queryClient.invalidateQueries({ queryKey: partnersKeys.reviewQueue() });
      toast.success(`${item.businessName}: ${RESOLUTION_LABELS[variables.resolution]}`);
    },

    onError: () => {
      toast.error("No pudimos actualizar el referido. Intenta de nuevo.");
    },
  });
}
