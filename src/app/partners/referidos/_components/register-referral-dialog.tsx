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
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useRegisterReferral } from "@/features/partners/hooks/use-register-referral";
import { PARTNER_PLAN_OPTIONS } from "@/features/partners/models/plan-option";
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

  const form = useForm<RegisterReferralFormValues>({
    resolver: zodResolver(registerReferralSchema),
    defaultValues: registerReferralDefaultValues,
  });

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    form.reset(registerReferralDefaultValues);
  }, [isOpen, form]);

  function handleSubmit(values: RegisterReferralFormValues) {
    registerReferral.mutate(values, {
      onSuccess: () => {
        form.reset();
        onClose();
      },
    });
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
            El correo es la llave: le llega una invitación para activar su cuenta.
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

            <FormField
              control={form.control}
              name="planValue"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Plan que le interesa</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Selecciona un plan" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {PARTNER_PLAN_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

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
                    Enviando...
                  </>
                ) : (
                  "Enviar invitación"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
