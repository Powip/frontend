"use client";

import type { ReactNode } from "react";
import { useFormContext } from "react-hook-form";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { OlvaFieldHint } from "./olva-field-hint";
import type { SendToOlvaFieldName, SendToOlvaFormValues } from "./olva-form-types";

export interface OlvaSelectOption {
  value: string;
  label: string;
}

interface OlvaSelectFieldProps {
  name: SendToOlvaFieldName;
  label: string;
  options: readonly OlvaSelectOption[];
  placeholder?: string;
  /** Adds a first option that clears the field. */
  emptyLabel?: string;
  /** Clearing stores `undefined` instead of "" (for fields the schema does not accept blank). */
  clearToUndefined?: boolean;
  disabled?: boolean;
  /** Short help shown in a tooltip next to the label (ⓘ icon). */
  hint?: ReactNode;
  onValueChange?: (value: string) => void;
}

// Radix Select cannot hold value="": a sentinel stands for "nothing chosen"
const EMPTY = "__empty__";

/** A labelled select bound to the lot form. Values are strings; nothing chosen is "" (or undefined). */
export function OlvaSelectField({
  name,
  label,
  options,
  placeholder = "Seleccionar",
  emptyLabel,
  clearToUndefined = false,
  disabled,
  hint,
  onValueChange,
}: OlvaSelectFieldProps) {
  const { control } = useFormContext<SendToOlvaFormValues>();

  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        // min-w-0: a long selected label must shrink inside its grid cell, not spill over the next field
        <FormItem className="min-w-0">
          <FormLabel className="flex items-center gap-1">
            {label}
            {hint ? <OlvaFieldHint>{hint}</OlvaFieldHint> : null}
          </FormLabel>
          <Select
            value={typeof field.value === "string" && field.value ? field.value : EMPTY}
            onValueChange={(value) => {
              const next = value === EMPTY ? "" : value;

              field.onChange(next === "" && clearToUndefined ? undefined : next);
              onValueChange?.(next);
            }}
            disabled={disabled}
          >
            <FormControl>
              <SelectTrigger className="w-full min-w-0" onBlur={field.onBlur} ref={field.ref}>
                <SelectValue placeholder={placeholder} />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              {emptyLabel ? <SelectItem value={EMPTY}>{emptyLabel}</SelectItem> : null}
              {options.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
