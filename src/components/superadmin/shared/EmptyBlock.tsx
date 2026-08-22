import { EmptyState } from "@/components/ui/empty-state";
import { Inbox, type LucideIcon } from "lucide-react";

interface EmptyBlockProps {
  icon?: LucideIcon;
  title?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

/** Empty state estándar de la Sección 6: "mensaje + ícono + CTA". */
export function EmptyBlock({
  icon = Inbox,
  title = "Sin resultados",
  description = "No hay datos para estos filtros.",
  actionLabel,
  onAction,
}: EmptyBlockProps) {
  return (
    <EmptyState
      icon={icon}
      title={title}
      description={description}
      actionLabel={actionLabel}
      onAction={onAction}
      className="my-2"
    />
  );
}
