import type { ComponentProps } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface BlockedActionButtonProps extends ComponentProps<typeof Button> {
  blocked: boolean;
  blockedReasonId: string;
}

export function BlockedActionButton({
  blocked,
  blockedReasonId,
  onClick,
  className,
  ...props
}: BlockedActionButtonProps) {
  return (
    <Button
      type="button"
      {...props}
      aria-disabled={blocked ? true : undefined}
      aria-describedby={blocked ? blockedReasonId : props["aria-describedby"]}
      className={cn(blocked && "cursor-not-allowed opacity-50", className)}
      onClick={(event) => {
        if (blocked) {
          event.preventDefault();
          return;
        }
        onClick?.(event);
      }}
    />
  );
}
