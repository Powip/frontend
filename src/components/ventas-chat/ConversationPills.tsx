"use client";
import { Badge } from "@/components/ui/badge";
import { pipelineOf } from "@/lib/crmPipelines";
import { usePipelines } from "@/hooks/useCrmPlanning";
import type { Conversation } from "@/types/crm";
import TemperatureBadge from "./TemperatureBadge";
import { isReadyToBuy } from "./temperature";

/** Segunda línea del chat en la lista: «Listo para comprar», etapa y temperatura. */
export default function ConversationPills({ conversation }: { conversation: Conversation }) {
  const pipelines = usePipelines();
  const stage = pipelineOf(pipelines.data, conversation)?.stages.find((s) => s.id === conversation.stageId);
  return (
    <span className="flex flex-wrap items-center gap-1" data-testid="conv-pills">
      {isReadyToBuy(conversation) && (
        <span className="text-[11px] font-semibold text-red-700 dark:text-red-300">🔥 Listo para comprar</span>
      )}
      {stage && <Badge variant="tag">{stage.name}</Badge>}
      {conversation.status === "open" && <TemperatureBadge conversation={conversation} />}
    </span>
  );
}
