import { Badge } from "@/components/ui/badge";
import type { Conversation } from "@/types/crm";
import { TEMPERATURE_BADGE, temperatureOf } from "./temperature";

export default function TemperatureBadge({ conversation }: { conversation: Conversation }) {
  const { label, variant } = TEMPERATURE_BADGE[temperatureOf(conversation)];
  return (
    <Badge variant={variant} data-testid="temperature">
      {label}
    </Badge>
  );
}
