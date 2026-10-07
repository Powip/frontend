import { useInfiniteQuery } from "@tanstack/react-query";
import { partnersKeys } from "../keys/partners.keys";
import { getHttpStatus } from "../mappers/to-partner-identity-from-error";
import { getAdminApplications } from "../services/get-admin-applications";

export function shouldRetryPartnersQuery(failureCount: number, error: Error): boolean {
  const status = getHttpStatus(error);
  const isTransient = status === null || status >= 500;

  return isTransient && failureCount < 1;
}

export function useAdminApplications(status: string | null) {
  return useInfiniteQuery({
    queryKey: partnersKeys.adminApplications(status),
    queryFn: ({ pageParam }) => getAdminApplications({ cursor: pageParam, status }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    retry: shouldRetryPartnersQuery,
  });
}
