"use client";

import React, { useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { type VariantProps } from "class-variance-authority";
import CancelAliclikModal from "./CancelAliclikModal";

type ButtonVariantProps = VariantProps<typeof buttonVariants>;

interface CancelAliclikButtonProps {
  orderId: string;
  companyId?: string;
  /** Señal de que el pedido fue enviado a Aliclik — si es falsy el botón no se renderiza */
  aliclikDispatchStatus?: string | null;
  onSuccess?: () => void;
  variant?: ButtonVariantProps["variant"];
  size?: ButtonVariantProps["size"];
  className?: string;
  label?: string;
}

export default function CancelAliclikButton({
  orderId,
  companyId,
  aliclikDispatchStatus,
  onSuccess,
  variant = "outline",
  size = "default",
  className,
  label,
}: CancelAliclikButtonProps) {
  const [open, setOpen] = useState(false);

  // Solo mostrar si el pedido fue enviado a Aliclik
  if (!aliclikDispatchStatus) return null;

  return (
    <>
      <Button
        variant={variant}
        size={size}
        aria-label={label || "Cancelar en Aliclik"}
        className={cn("gap-2", className)}
        onClick={() => setOpen(true)}
      >
        <XCircle className="h-4 w-4" />
        {label !== "" && (label ?? "Cancelar en Aliclik")}
      </Button>

      <CancelAliclikModal
        open={open}
        onClose={() => setOpen(false)}
        orderId={orderId}
        companyId={companyId}
        onSuccess={onSuccess}
      />
    </>
  );
}
