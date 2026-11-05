import { type UseMutationResult, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { olvaSenderProfileKeys } from "../keys/olva-sender-profile.keys";
import { archiveOlvaSenderProfile } from "../services/olva-sender-profile.service";
import { getOlvaSenderProfileErrorMessage } from "../utils/olva-sender-profile-error.util";

/**
 * Archives a sender profile; it does not erase it, so shipments already filed under it keep
 * pointing at it. The default profile cannot be archived (SENDER_PROFILE_CANNOT_ARCHIVE_DEFAULT).
 */
export function useArchiveOlvaSenderProfile(): UseMutationResult<void, Error, string> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: archiveOlvaSenderProfile,

    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({
        queryKey: olvaSenderProfileKeys.lists(),
      });

      queryClient.removeQueries({
        queryKey: olvaSenderProfileKeys.detail(id),
      });

      toast.success("Remitente archivado correctamente.");
    },

    onError: (error: Error) => {
      toast.error(getOlvaSenderProfileErrorMessage(error));
    },
  });
}
