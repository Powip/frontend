import type { Conversation, Pipeline } from "@/types/crm";

/** Embudo del chat; si no tiene, el de la empresa por defecto. */
export function pipelineOf(
  list: Pipeline[] | undefined,
  conversation: Pick<Conversation, "pipelineId">,
): Pipeline | undefined {
  return (
    list?.find((p) => p.id === conversation.pipelineId) ?? list?.find((p) => p.isDefault) ?? list?.[0]
  );
}
