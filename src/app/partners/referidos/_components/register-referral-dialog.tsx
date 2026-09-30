"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useIdempotencyKey } from "@/features/partners/hooks/use-idempotency-key";
import { useRegisterReferral } from "@/features/partners/hooks/use-register-referral";
import { registerReferralDefaultValues } from "@/features/partners/schemas/register-referral.defaults";
import {
  registerReferralSchema,
  type RegisterReferralFormValues,
} from "@/features/partners/schemas/register-referral.schema";

interface RegisterReferralDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function RegisterReferralDialog({ isOpen, onClose }: RegisterReferralDialogProps) {
  const registerReferral = useRegisterReferral();
  const idempotencyKey = useIdempotencyKey();

  const form = useForm<RegisterReferralFormValues>({
    resolver: zodResolver(registerReferralSchema),
    defaultValues: registerReferralDefaultValues,
  });

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    form.reset(registerReferralDefaultValues);
    idempotencyKey.reset();
  }, [isOpen, form, idempotencyKey]);

  function handleSubmit(values: RegisterReferralFormValues) {
    registerReferral.mutate(
      { values, idempotencyKey: idempotencyKey.resolve(values) },
      {
        onSuccess: () => {
          idempotencyKey.reset();
          form.reset();
          onClose();
        },
      },
    );
  }

  function handleClose() {
    if (registerReferral.isPending) {
      return;
    }
    form.reset();
    onClose();
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>Registrar referido</DialogTitle>
          <DialogDescription>
            El correo es la llave. Revisamos el registro antes de enviarle la invitación para
            activar su cuenta.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="businessName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre del negocio</FormLabel>
                  <FormControl>
                    <Input placeholder="Ej. Zapatería Andes" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Correo del negocio</FormLabel>
                  <FormControl>
                    <Input
                      type="text"
                      inputMode="email"
                      placeholder="correo@negocio.com"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Teléfono / WhatsApp (opcional)</FormLabel>
                  <FormControl>
                    <Input placeholder="+51 9·· ··· ···" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-2">
              <Label htmlFor="register-referral-plan">Plan que le interesa</Label>
              <Select disabled>
                <SelectTrigger
                  id="register-referral-plan"
                  className="w-full"
                  aria-describedby="register-referral-plan-help"
                >
                  <SelectValue placeholder="No disponible por ahora" />
                </SelectTrigger>
                <SelectContent />
              </Select>
              <p id="register-referral-plan-help" className="text-xs text-muted-foreground">
                Todavía no podemos asociar un plan al referido porque falta el identificador del
                plan en el programa de partners. El referido se registra sin plan y el negocio lo
                elige al activar su cuenta.
              </p>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={handleClose}
                disabled={registerReferral.isPending}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={registerReferral.isPending}>
                {registerReferral.isPending ? (
                  <>
                    <Loader2 aria-hidden="true" className="mr-2 h-4 w-4 animate-spin" />
                    Registrando...
                  </>
                ) : (
                  "Registrar referido"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
