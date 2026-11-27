"use client";

import type { ComponentProps, ReactNode } from "react";
import { useFormContext } from "react-hook-form";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import type { SendToOlvaFieldName, SendToOlvaFormValues } from "./olva-form-types";
import { OlvaFieldHint } from "./olva-field-hint";

interface OlvaTextFieldProps
  extends Omit<
    ComponentProps<typeof Input>,
    "name" | "value" | "defaultValue" | "onChange" | "required"
  > {
  name: SendToOlvaFieldName;
  label: string;
  description?: ReactNode;
  /** Shows the "*" and tells assistive tech. Validation stays in the form schema. */
  required?: boolean;
  /** Cleans what the user types (digits only, for example) before it reaches the form. */
  transform?: (value: string) => string;
  /** Short help shown in a tooltip next to the label (ⓘ icon). */
  hint?: ReactNode;
}

/** A labelled text input bound to the lot form, with its validation message. */
export function OlvaTextField({
  name,
  label,
  description,
  hint,
  required = false,
  transform,
  ...inputProps
}: OlvaTextFieldProps) {
  const { control } = useFormContext<SendToOlvaFormValues>();

  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className="min-w-0">
          <FormLabel className="flex items-center gap-1">
            {label}
            {required ? (
              <span aria-hidden="true" className="text-destructive">
                {" *"}
              </span>
            ) : null}
            {hint ? <OlvaFieldHint>{hint}</OlvaFieldHint> : null}
          </FormLabel>
          <FormControl>
            <Input
              {...inputProps}
              aria-required={required || undefined}
              name={field.name}
              ref={field.ref}
              onBlur={field.onBlur}
              value={
                typeof field.value === "string" || typeof field.value === "number"
                  ? field.value
                  : ""
              }
              onChange={(event) =>
                field.onChange(transform ? transform(event.target.value) : event.target.value)
              }
              autoComplete="off"
            />
          </FormControl>
          {description ? <FormDescription>{description}</FormDescription> : null}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
