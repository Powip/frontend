"use client";
import { useState } from "react";
import { FrontPlan } from "@/app/subscriptions/page";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Check, Loader2, ExternalLink } from "lucide-react";
import { Button } from "../ui/button";
import { useRouter } from "next/navigation";
import axios from "axios";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onClose: () => void;
  plan: FrontPlan | null;
  userId: string;
  userEmail?: string;
}

export default function SubscriptionModal({
  open,
  onClose,
  plan,
  userId,
  userEmail,
}: Props) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  if (!plan) return null;

  const handlePayWithMercadoPago = async () => {
    setIsLoading(true);
    try {
      const body = {
        userId,
        planId: plan.id,
        payerEmail: userEmail,
        autoRenewal: true,
      };

      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_API_SUBS}/subscriptions`,
        body,
      );

      console.log("Respuesta del backend:", response.data);

      if (response.status === 201 && response.data.initPoint) {
        toast.info("Redirigiendo a Mercado Pago...");
        window.location.href = response.data.initPoint;
      } else {
        toast.success("¡Suscripción creada! Revisa tu correo.");
        onClose();
      }
    } catch (error: any) {
      console.log("Error al iniciar pago", error);
      toast.error(
        error.response?.data?.error || "Error al conectar con Mercado Pago",
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-2xl text-primary font-bold">
            Plan {plan?.name}
          </DialogTitle>
          <DialogDescription>{plan?.description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-6 pt-4">
          <div className="rounded-xl bg-muted/50 p-6 border border-border">
            <div className="flex justify-between items-baseline mb-2">
              <span className="text-sm text-muted-foreground uppercase tracking-wider font-semibold">
                Total a pagar
              </span>
              <span className="bg-primary/10 text-primary text-[10px] px-2 py-0.5 rounded-full font-bold">
                SEGURO
              </span>
            </div>
            <div className="text-4xl font-black text-foreground">
              S/ {plan?.price}
              <span className="text-lg font-medium text-muted-foreground ml-1">
                {plan?.period}
              </span>
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="text-sm font-bold text-foreground ml-1">
              Beneficios del plan:
            </h4>
            <ul className="grid grid-cols-1 gap-2">
              {plan?.features.slice(0, 4).map((feature) => (
                <li
                  key={feature}
                  className="flex items-center gap-3 bg-background border p-2 rounded-lg"
                >
                  <div className="bg-primary/10 p-1 rounded-full">
                    <Check className="h-4 w-4 text-primary" />
                  </div>
                  <span className="text-sm text-muted-foreground font-medium">
                    {feature}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="pt-2">
            <Button
              className="w-full h-14 text-lg font-bold shadow-lg hover:shadow-xl transition-all"
              size="lg"
              onClick={handlePayWithMercadoPago}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Conectando...
                </>
              ) : (
                <>
                  Pagar con Mercado Pago
                  <ExternalLink className="ml-2 h-5 w-5 opacity-70" />
                </>
              )}
            </Button>
          </div>

          <div className="text-center">
            <p className="text-[10px] text-muted-foreground px-4 leading-normal">
              Serás redirigido a Mercado Pago para completar tu compra de forma
              segura. Aceptamos tarjetas de crédito, débito y saldo en cuenta.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
