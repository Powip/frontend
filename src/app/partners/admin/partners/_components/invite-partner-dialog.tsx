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
import { useInviteAdminPartner } from "@/features/partners/hooks/use-invite-admin-partner";
import {
  PARTNER_PROFILE_OPTIONS,
  inviteAdminPartnerSchema,
  type InviteAdminPartnerFormValues,
} from "@/features/partners/schemas/invite-admin-partner.schema";

const COMMISSION_OPTION_CHOICES = [
  { value: "A", label: "A · 40% 1er mes + 6% recurrente" },
  { value: "C", label: "C · 50% 1er mes + 8% recurrente" },
  { value: "B", label: "B · 70% 1er mes + 3% recurrente" },
] as const;

interface InvitePartnerDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function InvitePartnerDialog({ isOpen, onClose }: InvitePartnerDialogProps) {
  const inviteAdminPartner = useInviteAdminPartner();

  const form = useForm<InviteAdminPartnerFormValues>({
    resolver: zodResolver(inviteAdminPartnerSchema),
    defaultValues: { name: "", email: "", profile: "agencia", suggestedOptionCode: "A" },
  });

  useEffect(() => {
    if (!isOpen) return;
    form.reset({ name: "", email: "", profile: "agencia", suggestedOptionCode: "A" });
  }, [isOpen, form]);

  function handleSubmit(values: InviteAdminPartnerFormValues) {
    inviteAdminPartner.mutate(values, {
      onSuccess: () => {
        form.reset();
        onClose();
      },
    });
  }

  function handleClose() {
    if (inviteAdminPartner.isPending) return;
    form.reset();
    onClose();
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invitar partner</DialogTitle>
          <DialogDescription>
            Le llega un correo para activar su cuenta, link y código.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre / marca</FormLabel>
                  <FormControl>
                    <Input placeholder="Ej. Laura Pérez / @laura.ecom" {...field} />
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
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input inputMode="email" placeholder="correo@ejemplo.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="profile"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Perfil</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {PARTNER_PROFILE_OPTIONS.map((option) => (
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

            <FormField
              control={form.control}
              name="suggestedOptionCode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Opción sugerida</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {COMMISSION_OPTION_CHOICES.map((option) => (
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
                disabled={inviteAdminPartner.isPending}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={inviteAdminPartner.isPending}>
                {inviteAdminPartner.isPending ? (
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
