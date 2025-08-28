import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default:
          "bg-green text-white shadow-[0px_4px_4px_0px_rgba(0,0,0,0.25)] hover:shadow-none active:shadow-[inset_0px_5px_5px_4px_rgba(0,0,0,0.25)]",
        outline:
          "bg-transparent border-3 border-red text-red font-bold shadow-[0px_4px_4px_0px_rgba(0,0,0,0.25)] hover:shadow-none active:shadow-[inset_0px_5px_5px_4px_rgba(0,0,0,0.25)]",
        lime: 
          "bg-lime text-white shadow-[0px_4px_4px_0px_rgba(0,0,0,0.25)] hover:shadow-none active:shadow-[inset_0px_5px_5px_4px_rgba(0,0,0,0.25)]",
        red: 
          "bg-red text-white shadow-[0px_4px_4px_0px_rgba(0,0,0,0.25)] hover:shadow-none active:shadow-[inset_0px_5px_5px_4px_rgba(0,0,0,0.25)]",
        yellow: 
          "bg-yellow text-gray-800 shadow-[0px_4px_4px_0px_rgba(0,0,0,0.25)] hover:shadow-none active:shadow-[inset_0px_5px_5px_4px_rgba(0,0,0,0.25)]",
        blue: 
          "bg-sky-blue text-white shadow-[0px_4px_4px_0px_rgba(0,0,0,0.25)] hover:shadow-none active:shadow-[inset_0px_5px_5px_4px_rgba(0,0,0,0.25)]",
        table: 
          "bg-sky-blue text-white active:shadow-[inset_0px_5px_5px_4px_rgba(0,0,0,0.25)]",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        sm: "h-8  gap-1.5 px-3 has-[>svg]:px-2.5",
        lg: "h-10  px-6 has-[>svg]:px-4",
        icon: "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
