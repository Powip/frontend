import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
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
  const { auth } = useAuth();
  const userId = auth?.user.id;

  return useQuery<PartnerIdentity, Error>({
    queryKey: partnersKeys.me(userId),
    queryFn: getPartnerIdentity,
    enabled: Boolean(userId && auth?.accessToken),
    retry: shouldRetryPartnerIdentity,
  });
}
