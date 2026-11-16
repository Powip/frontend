export const sunatIssuerAccessKeys = {
  all: ["sunat-issuer-access"] as const,
  blocks: () => [...sunatIssuerAccessKeys.all, "blocks"] as const,
};
