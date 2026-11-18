import { type UseQueryResult, useQuery } from "@tanstack/react-query";
import { listSunatIssuerAccessBlocksApi } from "../api/sunat-issuer-access.api";
import { sunatIssuerAccessKeys } from "../keys/sunat-issuer-access.keys";
import type { SunatIssuerAccessBlock } from "../models/sunat-issuer-access-block";

/** RUC and document types SUNAT is currently refusing for the company. */
export function useSunatIssuerAccessBlocks(): UseQueryResult<SunatIssuerAccessBlock[], Error> {
  return useQuery({
    queryKey: sunatIssuerAccessKeys.blocks(),
    queryFn: async () => {
      const blocks = await listSunatIssuerAccessBlocksApi();

      return blocks.map((block) => ({
        ...block,
        blockedAt: new Date(block.blockedAt),
        lastFailedAt: new Date(block.lastFailedAt),
      }));
    },
  });
}
