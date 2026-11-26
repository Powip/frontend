"use client";
import { useScript } from "@/hooks/useCrmContent";
import { cn } from "@/lib/utils";

/** Pasos del guion cumplidos en la llamada: la vendedora los marca mientras habla. */
export default function CallScript({
  title,
  done,
  onToggle,
}: {
  title: string;
  done: number[];
  /** Sin esto la lista es solo de lectura. */
  onToggle?: (step: number) => void;
}) {
  const steps = useScript(true).data?.steps ?? [];
  if (steps.length === 0) return null;
  return (
    <fieldset className="space-y-1 rounded-lg border p-2 text-xs">
      <legend className="px-1 font-semibold">{title}</legend>
      {steps.map((step, i) => (
        <label key={i} className={cn("flex items-center gap-2", done.includes(i) && "text-teal-700")}>
          <input
            type="checkbox"
            className="accent-teal-600"
            checked={done.includes(i)}
            disabled={!onToggle}
            onChange={() => onToggle?.(i)}
          />
          {i + 1}. {step.name}
        </label>
      ))}
    </fieldset>
  );
}
