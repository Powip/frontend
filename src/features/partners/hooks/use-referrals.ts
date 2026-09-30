import { useInfiniteQuery } from "@tanstack/react-query";
import { partnersKeys } from "../keys/partners.keys";
import { getReferrals } from "../services/get-referrals";

export function useReferrals() {
  return useInfiniteQuery({
    queryKey: partnersKeys.referrals(),
    queryFn: ({ pageParam }) => getReferrals(pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });
}
