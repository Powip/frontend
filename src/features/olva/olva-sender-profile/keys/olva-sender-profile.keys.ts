export const olvaSenderProfileKeys = {
  all: ["olva-sender-profiles"] as const,

  lists: () => [...olvaSenderProfileKeys.all, "list"] as const,

  details: () => [...olvaSenderProfileKeys.all, "detail"] as const,

  detail: (id: string) => [...olvaSenderProfileKeys.details(), id] as const,
};
