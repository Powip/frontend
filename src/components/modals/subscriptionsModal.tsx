"use client";
import { FrontPlan } from "@/app/subscriptions/page";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Check } from "lucide-react";
import { Button } from "../ui/button";
import { useRouter } from "next/navigation";
import axios from "axios";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onClose: () => void;
  plan: FrontPlan | null;
}
export default function SubscriptionModal({ open, onClose, plan }: Props) {
  const router = useRouter();
  if (!plan) return null;
  const handleRedirect = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    try {
      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_API_SUBS}/subscriptions`
      );
      if (response.status === 200) {
        toast.success("Subscripcion comprada con exito!");
        router.push("/new-company");
      }
    } catch (error) {
      console.log("Error la crear la subscripcion");
      router.push("/new-company");
    }
  };
  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-2xl">Plan {plan?.name}</DialogTitle>
          <DialogDescription>{plan?.description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-6">
          <div className="rounded-lg bg-muted p-4">
            <div className="mb-2 text-sm text-muted-foreground">Precio</div>
            <div className="text-3xl font-bold text-foreground">
              ${plan?.price}
              <span className="text-base font-normal text-muted-foreground">
                {plan?.period}
              </span>
            </div>
          </div>
          <div>
            <div className="mb-3 text-sm font-semibold text-foreground">
              Incluye:
            </div>
            <ul className="space-y-2">
              {plan?.features.map((feature) => (
                <li key={feature} className="flex items-start gap-2">
                  <Check className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                  <span className="text-sm text-muted-foreground">
                    {feature}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <Button
            className="w-full"
            size="lg"
            onClick={(e) => handleRedirect(e)}
          >
            Pagar con Mercado Pago
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
