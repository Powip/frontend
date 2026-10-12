"use client";

import { CancelledError, useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { tokenStore } from "@/lib/tokenStore";
import { partnersKeys } from "../keys/partners.keys";
import type { PartnerResource } from "../models/partner-resource";
import { getPartnerResources } from "../services/get-partner-resources";
import { adminReadSessionEpoch } from "../utils/admin-read-session-state";

export function usePartnerResources() {
  const { auth } = useAuth();
  const userId = auth?.user.id;
  const accessToken = auth?.accessToken;
  const epoch = adminReadSessionEpoch(accessToken);
  return useQuery<PartnerResource[], Error>({
    queryKey: partnersKeys.resources(userId, epoch),
    queryFn: async ({ signal }) => {
      if (
        typeof window === "undefined" ||
        !userId ||
        !accessToken ||
        tokenStore.get() !== accessToken ||
        signal.aborted
      ) {
        throw new CancelledError({ silent: true });
      }
      try {
        const resources = await getPartnerResources(accessToken, signal);
        if (tokenStore.get() !== accessToken || signal.aborted) {
          throw new CancelledError({ silent: true });
        }
        return resources;
      } catch (error) {
        if (tokenStore.get() !== accessToken || signal.aborted) {
          throw new CancelledError({ silent: true });
        }
        throw error;
      }
    },
    enabled: Boolean(typeof window !== "undefined" && userId && accessToken),
    retry: false,
  });
}
