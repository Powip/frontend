"use client";

import React, { useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Truck } from "lucide-react";
import { cn } from "@/lib/utils";
import { type VariantProps } from "class-variance-authority";
import SendToEvaModal from "./SendToEvaModal";

type ButtonVariantProps = VariantProps<typeof buttonVariants>;

interface SendToEvaButtonProps {
  orderId: string;
  companyId?: string;
  /** Datos del pedido ya cargados por el llamador — se usan para auto-completar el modal. */
  recipientName: string;
  recipientPhone: string;
  district: string;
  address: string;
  amount: number;
  onSuccess?: () => void;
  variant?: ButtonVariantProps["variant"];
  size?: ButtonVariantProps["size"];
  className?: string;
  label?: string;
}

export default function SendToEvaButton({
  orderId,
  companyId,
  recipientName,
  recipientPhone,
  district,
  address,
  amount,
  onSuccess,
  variant = "outline",
  size = "default",
  className,
  label,
}: SendToEvaButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant={variant}
        size={size}
        aria-label={label || "Enviar a EVA"}
        className={cn("gap-2", className)}
        onClick={() => setOpen(true)}
      >
        <Truck className="h-4 w-4" />
        {label ?? "Enviar a EVA"}
      </Button>

      <SendToEvaModal
        open={open}
        onClose={() => setOpen(false)}
        orderId={orderId}
        companyId={companyId}
        recipientName={recipientName}
        recipientPhone={recipientPhone}
        district={district}
        address={address}
        amount={amount}
        onSuccess={onSuccess}
      />
    </>
  );
}
