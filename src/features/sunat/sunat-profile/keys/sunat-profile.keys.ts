export const sunatProfileKeys = {
  all: ["sunat-profiles"] as const,

  lists: () => [...sunatProfileKeys.all, "list"] as const,

  list: (filters?: Record<string, unknown>) => [...sunatProfileKeys.lists(), filters] as const,

  details: () => [...sunatProfileKeys.all, "detail"] as const,

  detail: (id: string) => [...sunatProfileKeys.details(), id] as const,
};
