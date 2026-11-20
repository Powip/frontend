import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ConversationChannel } from "@/types/crm";
import { CHANNEL_LABEL } from "./format";

const TONE: Record<ConversationChannel, string> = {
  whatsapp:
    "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300",
  messenger:
    "border-sky-300 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-950/30 dark:text-sky-300",
  instagram:
    "border-fuchsia-300 bg-fuchsia-50 text-fuchsia-700 dark:border-fuchsia-800 dark:bg-fuchsia-950/30 dark:text-fuchsia-300",
};

/** Etiqueta del canal de una conversación (WhatsApp, Messenger o Instagram). */
export default function ChannelBadge({
  channel,
  className,
}: {
  channel: ConversationChannel;
  className?: string;
}) {
  return (
    <Badge
      variant="outline"
      data-testid="channel-badge"
      className={cn("px-1.5 py-0 text-[10px]", TONE[channel], className)}
    >
      {CHANNEL_LABEL[channel]}
    </Badge>
  );
}
