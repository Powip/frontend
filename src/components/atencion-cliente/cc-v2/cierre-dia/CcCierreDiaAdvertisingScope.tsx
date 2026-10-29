import Link from "next/link";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface Props {
  from: string;
  to: string;
}

/** Company consumption has no store allocation; this notice never changes closing amounts. */
export function CcCierreDiaAdvertisingScope({ from, to }: Props) {
  const search = new URLSearchParams({ from, to });

  return (
    <Alert>
      <AlertTitle>Sin asignación a esta tienda</AlertTitle>
      <AlertDescription className="space-y-2">
        <p>
          El gasto de empresa aún no está distribuido entre tiendas. Este cierre conserva su publicidad manual.
        </p>
        <Link href={`/administracion/pauta?${search.toString()}`} className="inline-block font-medium text-primary underline underline-offset-4">
          Ver gasto de empresa
        </Link>
      </AlertDescription>
    </Alert>
  );
}
