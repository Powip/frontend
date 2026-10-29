import { FlaskConical } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

interface SimulatedDataNoticeProps {
  description?: string;
  className?: string;
}

export function SimulatedDataNotice({
  description = "Estos datos son de ejemplo: esta sección todavía no está conectada al servicio de Partners.",
  className,
}: SimulatedDataNoticeProps) {
  return (
    <Alert
      role="note"
      className={cn(
        "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200",
        className,
      )}
    >
      <FlaskConical aria-hidden="true" />
      <AlertDescription className="text-current">
        <span className="font-semibold">Datos simulados.</span> {description}
      </AlertDescription>
    </Alert>
  );
}
