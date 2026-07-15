import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface ProximamenteButtonProps {
  label: React.ReactNode;
  tooltip?: string;
  className?: string;
  variant?: React.ComponentProps<typeof Button>["variant"];
  size?: React.ComponentProps<typeof Button>["size"];
}

export function ProximamenteButton({
  label,
  tooltip = "Todavía no está conectado a SUNAT — próximamente disponible.",
  className,
  variant = "outline",
  size = "sm",
}: ProximamenteButtonProps) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-block">
            <Button
              type="button"
              disabled
              variant={variant}
              size={size}
              className={cn("cursor-not-allowed opacity-60", className)}
            >
              {label}
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent>{tooltip}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
