"use client";

import React, { useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Truck } from "lucide-react";
import { cn } from "@/lib/utils";
import { type VariantProps } from "class-variance-authority";
import SendToAliclikModal from "./SendToAliclikModal";

type ButtonVariantProps = VariantProps<typeof buttonVariants>;

interface SendToAliclikButtonProps {
  orderId: string;
  companyId?: string;
  clientId?: string;
  onSuccess?: () => void;
  variant?: ButtonVariantProps["variant"];
  size?: ButtonVariantProps["size"];
  className?: string;
  label?: string;
}

export default function SendToAliclikButton({
  orderId,
  companyId,
  clientId,
  onSuccess,
  variant = "outline",
  size = "default",
  className,
  label,
}: SendToAliclikButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant={variant}
        size={size}
        aria-label={label || "Enviar a Aliclik"}
        className={cn("gap-2", className)}
        onClick={() => setOpen(true)}
      >
        <Truck className="h-4 w-4" />
        {label ?? "Enviar a Aliclik"}
      </Button>

      <SendToAliclikModal
        open={open}
        onClose={() => setOpen(false)}
        orderId={orderId}
        companyId={companyId}
        clientId={clientId}
        onSuccess={onSuccess}
      />
    </>
  );
}
