import { useQuery } from "@tanstack/react-query";
import { partnersKeys } from "../keys/partners.keys";
import { getHttpStatus } from "../mappers/to-partner-identity-from-error";
import type { PartnerIdentity } from "../models/partner-identity";
import { getPartnerIdentity } from "../services/get-partner-identity";

export function shouldRetryPartnerIdentity(failureCount: number, error: Error): boolean {
  const status = getHttpStatus(error);
  const isTransient = status === null || status >= 500;

  return isTransient && failureCount < 1;
}

export function usePartnerIdentity() {
  return useQuery<PartnerIdentity, Error>({
    queryKey: partnersKeys.me(),
    queryFn: getPartnerIdentity,
    retry: shouldRetryPartnerIdentity,
  });
}
