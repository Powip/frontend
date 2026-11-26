export type WhatsAppResourceState<T> =
  | { kind: "pending-integration" }
  | { kind: "loading" }
  | { kind: "forbidden" }
  | { kind: "error"; message: string }
  | { kind: "ready"; data: T };
