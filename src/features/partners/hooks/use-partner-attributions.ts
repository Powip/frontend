import { CancelledError, useInfiniteQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { tokenStore } from "@/lib/tokenStore";
import { partnersKeys } from "../keys/partners.keys";
import { getPartnerAttributions } from "../services/get-partner-attributions";

export function usePartnerAttributions(enabled = true) {
  const { auth } = useAuth();
  const userId = auth?.user.id;
  const accessToken = auth?.accessToken;

  return useInfiniteQuery({
    queryKey: partnersKeys.attributions(userId),
    queryFn: async ({ pageParam, signal }) => {
      if (!userId || !accessToken || tokenStore.get() !== accessToken || signal.aborted) {
        throw new CancelledError({ silent: true });
      }
      const page = await getPartnerAttributions(pageParam, accessToken, signal);
      if (tokenStore.get() !== accessToken || signal.aborted) {
        throw new CancelledError({ silent: true });
      }
      return page;
    },
    enabled: Boolean(enabled && userId && accessToken),
    retry: false,
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });
}
