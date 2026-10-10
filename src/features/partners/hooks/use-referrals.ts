import { useInfiniteQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { partnersKeys } from "../keys/partners.keys";
import { getReferrals } from "../services/get-referrals";

export function useReferrals() {
  const { auth } = useAuth();
  const userId = auth?.user.id;

  return useInfiniteQuery({
    queryKey: partnersKeys.referrals(undefined, userId),
    queryFn: ({ pageParam }) => getReferrals(pageParam),
    enabled: Boolean(userId && auth?.accessToken),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });
}
