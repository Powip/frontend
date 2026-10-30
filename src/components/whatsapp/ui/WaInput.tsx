import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";
import { waInput } from "./wa-classes";

export function WaInput({ className, ...props }: ComponentProps<"input">) {
  return <input data-slot="input" className={cn(waInput, className)} {...props} />;
}
