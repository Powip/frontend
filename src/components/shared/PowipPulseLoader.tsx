import PowipLogoMini from "@/components/layout/logo-mini";

/** Loader con el iso de Powip palpitando (doble pulso, ver .animate-powip-heartbeat en globals.css). */
export function PowipPulseLoader({ label }: { label?: string }) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3">
      <PowipLogoMini className="h-12 w-12 text-primary animate-powip-heartbeat" />
      {label && <p className="text-sm text-muted-foreground">{label}</p>}
    </div>
  );
}
