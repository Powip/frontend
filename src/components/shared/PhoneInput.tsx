"use client";

import { useState, type KeyboardEventHandler } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { COUNTRIES, DEFAULT_DIAL, composePhone, normalizePhone, parsePhone } from "@/lib/phone";

export interface PhoneInputProps {
  /** Valor guardado: 9 dígitos si es de Perú, "+código número" si es de otro país. */
  value: string;
  onChange: (value: string) => void;
  id?: string;
  name?: string;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  onKeyDown?: KeyboardEventHandler<HTMLInputElement>;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
  /** Selector corto ("+51 PE") para celdas angostas. */
  compact?: boolean;
}

/**
 * Teléfono con selector de país (Perú +51 por defecto). El valor que emite es el mismo
 * que ya manejaba la app: el peruano de 9 dígitos sin prefijo, y cualquier otro país en
 * formato internacional canónico ("+5491123456789"). También acepta pegar un número ya
 * completo con "+" y detecta el país.
 */
export function PhoneInput({
  value,
  onChange,
  id,
  name,
  disabled,
  placeholder = "Número de teléfono",
  className,
  inputClassName,
  onKeyDown,
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedBy,
  compact = false,
}: PhoneInputProps) {
  const parsed = parsePhone(value);
  // Con el campo vacío el valor no sabe qué país se eligió: se recuerda aparte.
  const [pendingDial, setPendingDial] = useState(DEFAULT_DIAL);
  const dial = value ? parsed.dial : pendingDial;

  const handleDial = (next: string) => {
    setPendingDial(next);
    if (value) onChange(composePhone(next, parsed.national));
  };

  const handleNumber = (typed: string) => {
    if (typed.trim().startsWith("+")) {
      const full = normalizePhone(typed);
      setPendingDial(parsePhone(full).dial);
      onChange(full === "+" ? "" : full);
      return;
    }
    onChange(composePhone(dial, typed));
  };

  return (
    <div className={cn("flex w-full items-stretch gap-2", className)}>
      <select
        aria-label="Código de país"
        value={dial}
        disabled={disabled}
        onChange={(e) => handleDial(e.target.value)}
        className={cn(
          "border-input bg-background h-9 shrink-0 rounded-md border px-2 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50",
          compact ? "w-[5.5rem]" : "w-[8.5rem]",
        )}
      >
        {COUNTRIES.map((country) => (
          <option key={country.iso} value={country.dial}>
            {compact ? `+${country.dial} ${country.iso}` : `${country.name} (+${country.dial})`}
          </option>
        ))}
        <option value="">{compact ? "Otro" : "Otro (+código)"}</option>
      </select>
      <Input
        id={id}
        name={name}
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        placeholder={dial === "" ? "+código y número" : placeholder}
        disabled={disabled}
        value={parsed.national}
        aria-invalid={ariaInvalid}
        aria-describedby={ariaDescribedBy}
        className={inputClassName}
        onChange={(e) => handleNumber(e.target.value)}
        onKeyDown={onKeyDown}
      />
    </div>
  );
}
