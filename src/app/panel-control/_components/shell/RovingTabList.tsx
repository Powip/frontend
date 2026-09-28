"use client";

import { type KeyboardEvent, useRef } from "react";
import { cn } from "@/lib/utils";

export interface RovingTabItem<T extends string> {
  id: T;
  label: string;
}

interface RovingTabListProps<T extends string> {
  items: RovingTabItem<T>[];
  selected: T;
  onSelect: (id: T) => void;
  ariaLabel: string;
  controls: string;
  idPrefix: string;
  variant: "principal" | "secundaria";
  className?: string;
}

export function RovingTabList<T extends string>({
  items,
  selected,
  onSelect,
  ariaLabel,
  controls,
  idPrefix,
  variant,
  className,
}: RovingTabListProps<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const last = items.length - 1;
    const destinos: Record<string, number> = {
      ArrowRight: index === last ? 0 : index + 1,
      ArrowLeft: index === 0 ? last : index - 1,
      Home: 0,
      End: last,
    };
    const destino = destinos[event.key];
    if (destino === undefined) return;
    event.preventDefault();
    refs.current[destino]?.focus();
    onSelect(items[destino].id);
  };

  return (
    <div role="tablist" aria-label={ariaLabel} className={className}>
      {items.map((item, index) => {
        const activo = item.id === selected;
        return (
          <button
            key={item.id}
            ref={(element) => {
              refs.current[index] = element;
            }}
            id={`${idPrefix}-${item.id}`}
            type="button"
            role="tab"
            aria-selected={activo}
            aria-controls={controls}
            tabIndex={activo ? 0 : -1}
            onClick={() => onSelect(item.id)}
            onKeyDown={(event) => onKeyDown(event, index)}
            className={cn(
              "whitespace-nowrap outline-none transition-colors focus-visible:ring-2 focus-visible:ring-pc-primary",
              variant === "principal"
                ? cn(
                    "border-b-[3px] px-3.5 py-3 text-[13px]",
                    activo
                      ? "border-pc-primary font-semibold text-pc-text"
                      : "border-transparent font-medium text-pc-text-muted hover:text-pc-primary",
                  )
                : cn(
                    "rounded-full border px-3.5 py-1.5 text-xs",
                    activo
                      ? "border-pc-primary bg-pc-primary font-semibold text-white"
                      : "border-pc-border bg-pc-card font-medium text-pc-text-muted hover:text-pc-primary",
                  ),
            )}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
