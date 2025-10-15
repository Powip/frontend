import * as React from "react"
import { cn } from "@/lib/utils"

interface InputProps extends React.ComponentProps<"input"> {
  icon?: React.ElementType
  iconPosition?: "left" | "right"
}

function Input({
  className,
  type,
  icon: Icon,
  iconPosition = "left",
  ...props
}: InputProps) {
  return (
    <div className="relative w-full">
      {Icon && iconPosition === "left" && (
        <Icon className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4 pointer-events-none" />
      )}

      <input
        type={type}
        data-slot="input"
        className={cn(
          "file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input flex h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
          "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
          Icon && iconPosition === "left" ? "pl-8" : "",
          Icon && iconPosition === "right" ? "pr-8" : "",
          className
        )}
        {...props}
      />

      {Icon && iconPosition === "right" && (
        <Icon className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4 pointer-events-none" />
      )}
    </div>
  )
}

export { Input }
