"use client";
import { useId, useMemo, useState } from "react";

const plain = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

/**
 * FEAT-33 A8: selector con búsqueda para el ubigeo del comprador (patrón combobox de WAI-ARIA).
 * Se escribe para filtrar sin importar tildes ni mayúsculas; flechas, Enter y Escape funcionan; salir
 * sin elegir deja el último valor elegido.
 */
export default function LiveSearchSelect({
  label,
  value,
  options,
  placeholder,
  disabled = false,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  placeholder: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState<string | null>(null);
  const [active, setActive] = useState(-1);
  const filtered = useMemo(() => {
    const term = plain(query ?? "");
    return term ? options.filter((option) => plain(option).includes(term)) : options;
  }, [options, query]);
  const close = () => {
    setOpen(false);
    setQuery(null);
    setActive(-1);
  };
  const choose = (option: string) => {
    if (option !== value) onChange(option);
    close();
  };
  const optionId = (index: number) => `${id}-option-${index}`;
  return (
    <div className="relative">
      <label htmlFor={`${id}-input`} className="block text-[13px] font-semibold text-[var(--b-ink2)]">
        {label}
      </label>
      <input
        id={`${id}-input`}
        role="combobox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-autocomplete="list"
        aria-activedescendant={open && active >= 0 ? optionId(active) : undefined}
        autoComplete="off"
        disabled={disabled}
        placeholder={placeholder}
        value={query ?? value}
        className="mt-1.5 min-h-12 w-full rounded-[14px] border-[1.5px] border-[var(--b-line)] bg-[var(--b-in)] px-3.5 py-3 text-base text-[var(--b-ink)] outline-none placeholder:text-[var(--b-mut)] focus:border-[var(--acc)] disabled:opacity-50"
        onFocus={() => setOpen(true)}
        onBlur={close}
        onChange={(event) => {
          setQuery(event.target.value);
          setActive(-1);
          setOpen(true);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setOpen(true);
            const step = event.key === "ArrowDown" ? 1 : -1;
            setActive((current) =>
              filtered.length ? (current + step + filtered.length) % filtered.length : -1,
            );
          } else if (event.key === "Enter") {
            if (!open) return;
            event.preventDefault();
            const exact = filtered.find((option) => plain(option) === plain(query ?? ""));
            const picked = active >= 0 ? filtered[active] : exact ?? (filtered.length === 1 ? filtered[0] : undefined);
            if (picked) choose(picked);
          } else if (event.key === "Escape") {
            close();
          }
        }}
      />
      {open && !disabled ? (
        <ul
          id={`${id}-list`}
          role="listbox"
          aria-label={label}
          className="absolute inset-x-0 top-full z-30 mt-1 max-h-64 overflow-y-auto rounded-[14px] border border-[var(--b-line)] bg-[var(--b-card)] py-1 text-[var(--b-ink)] shadow-xl"
        >
          {filtered.length ? (
            filtered.map((option, index) => (
              <li
                key={option}
                id={optionId(index)}
                role="option"
                aria-selected={option === value}
                // mousedown (no click) para elegir antes de que el blur cierre la lista.
                onMouseDown={(event) => {
                  event.preventDefault();
                  choose(option);
                }}
                onClick={() => choose(option)}
                className={`cursor-pointer px-3.5 py-2.5 text-[15px] ${index === active ? "bg-[var(--acc-soft)]" : ""} ${option === value ? "font-bold text-[var(--acc-tx)]" : ""}`}
              >
                {option}
              </li>
            ))
          ) : (
            <li className="px-3.5 py-2.5 text-sm text-[var(--b-mut)]">No encontramos «{query}»</li>
          )}
        </ul>
      ) : null}
    </div>
  );
}
