import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DialogClose } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { waButton } from "./wa-classes";

export function WaDialogClose({
  label = "Cerrar",
  onClick,
  className,
}: {
  label?: string;
  onClick?: () => void;
  className?: string;
}) {
  const button = (
    <Button
      type="button"
      aria-label={label}
      className={cn(waButton({ variant: "ghost", size: "icon" }), "-my-1.5 -mr-2", className)}
      onClick={onClick}
    >
      <X aria-hidden="true" />
    </Button>
  );
  if (onClick) return button;
  return <DialogClose asChild>{button}</DialogClose>;
}
