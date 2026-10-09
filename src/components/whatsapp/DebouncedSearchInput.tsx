"use client";

import { Search } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import {
  CONVERSATION_SEARCH_DEBOUNCE_MS,
  CONVERSATION_SEARCH_MIN_LENGTH,
  isSearchTooShort,
} from "@/features/whatsapp/utils/conversation-filters.util";
import { cn } from "@/lib/utils";

interface DebouncedSearchInputProps {
  value: string;
  onValueChange: (value: string) => void;
  label: string;
  className?: string;
}

export function DebouncedSearchInput({
  value,
  onValueChange,
  label,
  className,
}: DebouncedSearchInputProps) {
  const inputId = useId();
  const hintId = useId();
  const [draft, setDraft] = useState(value);
  const valueRef = useRef(value);
  valueRef.current = value;
  const onValueChangeRef = useRef(onValueChange);
  onValueChangeRef.current = onValueChange;

  useEffect(() => {
    setDraft((current) => (current === value ? current : value));
  }, [value]);

  useEffect(() => {
    if (draft === valueRef.current) return;
    const timeout = setTimeout(
      () => onValueChangeRef.current(draft),
      CONVERSATION_SEARCH_DEBOUNCE_MS,
    );
    return () => clearTimeout(timeout);
  }, [draft]);

  const tooShort = isSearchTooShort(draft);

  return (
    <div className={cn("min-w-0", className)}>
      <label htmlFor={inputId} className="sr-only">
        {label}
      </label>
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          id={inputId}
          type="search"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={label}
          className="pl-8"
          aria-describedby={tooShort ? hintId : undefined}
        />
      </div>
      {tooShort && (
        <p id={hintId} className="mt-1 text-xs text-muted-foreground">
          Escribe al menos {CONVERSATION_SEARCH_MIN_LENGTH} caracteres para buscar.
        </p>
      )}
    </div>
  );
}
